"""Règles de gestion du module Formations (RG01 à RG38), indépendantes de l'API pour être testées seules."""

import logging
import re
from pathlib import Path

import mammoth
import nh3
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Value
from django.db.models.functions import Concat, Lower
from django.utils import timezone
from rest_framework.exceptions import APIException

from quali_formation.blocs import blocs_manquants
from quali_formation.logging.log_metier import log_metier
from quali_formation.logging.loggable import error_fields
from quali_formation.models import (
    Apprenant,
    Entreprise,
    Formateur,
    FormateurDocument,
    Formation,
    FormationHistorique,
    Item,
    ModeleFormation,
    ModeleGenerique,
    ModeleOrigine,
    Organisme,
    Sequence,
    Session,
    TypeModele,
    Utilisateur,
    Variable,
)
from quali_formation.serializers import ItemSerializer
from quali_formation.word_export import docx_depuis_html

Statut = Formation.Statut
Publication = Formation.Publication
Action = FormationHistorique.Action


class ErreurMetier(APIException):
    """Règle de gestion non respectée ; `code` permet au frontend d'ouvrir la bonne pop-up.
    Erreur « client » (4xx) : les journaux (@log_metier) la classent en avertissement, pas en panne."""

    def __init__(self, code, message, statut_http=400, **details):
        super().__init__(message)
        self.status_code = statut_http
        self.code = code
        self.message = message
        self.statut_http = statut_http
        self.details = details


class FormationIntrouvable(ErreurMetier):
    """404 : formation inexistante ou appartenant à un autre compte (sans dire laquelle des deux)."""

    def __init__(self):
        super().__init__('FORMATION_INTROUVABLE', 'Formation introuvable', 404)


def _prochaine_reference():
    # RG03 : FOR-AAAA-NNN, numéro suivant pour l'année en cours
    annee = timezone.localdate().year
    prefixe = f'FOR-{annee}-'
    refs = Formation.objects.filter(reference__startswith=prefixe).values_list('reference', flat=True)
    numeros = [int(r[len(prefixe):]) for r in refs if r[len(prefixe):].isdigit()]
    return f'{prefixe}{max(numeros, default=0) + 1:03d}'


def _remplacer_sequences(formation, sequences):
    formation.sequences.all().delete()
    Sequence.objects.bulk_create(
        Sequence(formation=formation, ordre=i, **s) for i, s in enumerate(sequences)
    )


def _statut_demande(donnees, nb_sequences, action, forcer):
    """Statut visé par l'enregistrement : Brouillon (RG02), ou Validée / Incomplète (RG01, RG13 à RG15)."""
    if action != 'valider':
        return Statut.BROUILLON
    duree = donnees.get('duree_heures')
    if duree is None or duree <= 0 or not donnees.get('modalite'):
        raise ErreurMetier('BASE_INCOMPLETE', "Renseignez l'intitulé et une durée supérieure à 0.")
    manque = blocs_manquants(donnees['valeurs'], donnees['modalite'], nb_sequences)
    if manque and not forcer:
        raise ErreurMetier('BLOCS_MANQUANTS', f'{len(manque)} bloc(s) ne sont pas remplis.', 409,
                           blocs=[b.id for b in manque])
    return Statut.INCOMPLETE if manque else Statut.VALIDEE


def formations_visibles(utilisateur):
    """Formations que ce compte voit et modifie : celles créées par les comptes de son centre (SCRUM-221) ;
    aucune si personne n'est connecté ou si le centre n'est pas encore renseigné.
    Seul endroit qui décide « qui voit quoi » pour les formations (et donc leurs sessions)."""
    if utilisateur is None or utilisateur.organisme_id is None:
        return Formation.objects.none()
    return Formation.objects.filter(proprietaire__organisme_id=utilisateur.organisme_id)


def _organisme_requis(utilisateur):
    """SCRUM-221 : rien ne se crée tant que le centre n'est pas renseigné (formulaire de première connexion)."""
    if utilisateur.organisme_id is None:
        raise ErreurMetier('ORGANISME_A_RENSEIGNER',
                           'Renseignez d’abord les informations de votre centre.', 403)
    return utilisateur.organisme


def _meme_intitule(intitule):
    # Majuscules et espaces en trop ignorés : « Excel  avancé » = « excel avancé »
    return ' '.join(intitule.split()).casefold()


def _verifier_intitule_unique(formation, donnees, utilisateur):
    """SCRUM-20 : une autre formation du compte porte déjà cet intitulé (la formation modifiée est exclue)."""
    autres = formations_visibles(utilisateur)
    if formation is not None:
        autres = autres.exclude(pk=formation.pk)
    cherche = _meme_intitule(donnees['intitule'])
    if any(_meme_intitule(i) == cherche for i in autres.values_list('intitule', flat=True)):
        raise ErreurMetier('INTITULE_EXISTANT', 'Une formation portant le même nom existe déjà.', 409)


def _historiser(formation, action, utilisateur):
    # formation_historique : une ligne par action, avec l'utilisateur connecté et la date
    FormationHistorique.objects.create(formation=formation, reference=formation.reference, intitule=formation.intitule,
                                       utilisateur=utilisateur, action=action)


def _ajuster_publication(formation):
    # RG28 : une formation publiée qui repasse en brouillon redevient « À publier »
    if formation.statut == Statut.BROUILLON:
        if formation.publication == Publication.PUBLIEE:
            formation.publication = Publication.A_PUBLIER
    elif not formation.publication:
        formation.publication = Publication.A_PUBLIER  # RG24 : validée ou incomplète


def _enregistrer_avec_reference(formation):
    # RG03 + RG04 ; en cas d'enregistrements simultanés, le numéro suivant est repris
    for _ in range(5):
        formation.reference = _prochaine_reference()
        formation.version = 1
        try:
            with transaction.atomic():
                formation.save()
            return
        except IntegrityError:
            continue
    raise ErreurMetier('REFERENCE', "Impossible d'attribuer une référence, réessayez.", 409)


class FormationService:
    """Règles de gestion du module Formations (couche service, logs métier par @log_metier)."""

    @log_metier("service", champs=["action", "forcer", "doublon_accepte", "resultat.statut"])
    def enregistrer(self, formation, donnees, action, forcer=False, doublon_accepte=False, utilisateur=None):
        """Crée (formation=None) ou modifie une formation.

        action « brouillon » : seul l'intitulé est obligatoire (RG02) ;
        action « valider » : intitulé, durée > 0 et modalité obligatoires (RG01), puis Validée si tous les
        blocs sont complets (RG13), sinon refus sauf `forcer` qui l'enregistre Incomplète (RG14, RG15).
        Même intitulé qu'une autre formation du compte : refus sauf `doublon_accepte` (SCRUM-20).
        Une nouvelle formation appartient au compte `utilisateur` qui la crée.
        Une formation archivée ne se modifie pas : il faut d'abord la restaurer (SCRUM-23).
        """
        if formation is not None and formation.statut == Statut.ARCHIVEE:
            raise ErreurMetier('ARCHIVEE', "Une formation archivée ne se modifie pas : restaurez-la d'abord.", 409)
        if not donnees['intitule'].strip():
            raise ErreurMetier('INTITULE_REQUIS', "L'intitulé est obligatoire.")
        sequences = donnees.pop('sequences')

        statut = _statut_demande(donnees, len(sequences), action, forcer)
        if not doublon_accepte:
            _verifier_intitule_unique(formation, donnees, utilisateur)

        with transaction.atomic():
            nouvelle = formation is None
            if nouvelle:
                formation = Formation(proprietaire=utilisateur)
            else:
                formation.version += 1  # RG04
            for champ, valeur in donnees.items():
                setattr(formation, champ, valeur)
            formation.statut = statut
            _ajuster_publication(formation)
            if nouvelle:
                _enregistrer_avec_reference(formation)
            else:
                formation.save()
            _remplacer_sequences(formation, sequences)
            _historiser(formation, Action.CREATION if nouvelle else Action.MODIFICATION, utilisateur)
        return formation


    @log_metier("service", champs=["formation.id", "formation.statut"])
    def archiver(self, formation, utilisateur=None):
        # SCRUM-23 : la formation quitte « Toutes » pour le filtre « Archivées »
        formation.statut = Statut.ARCHIVEE
        with transaction.atomic():
            formation.save()
            _historiser(formation, Action.ARCHIVAGE, utilisateur)
        return formation


    @log_metier("service", champs=["formation.id", "formation.statut"])
    def restaurer(self, formation, utilisateur=None):
        # SCRUM-23 : retour en brouillon (et donc « À publier », RG28)
        if formation.statut != Statut.ARCHIVEE:
            raise ErreurMetier('NON_ARCHIVEE', "Seule une formation archivée peut être restaurée.", 409)
        formation.statut = Statut.BROUILLON
        _ajuster_publication(formation)
        with transaction.atomic():
            formation.save()
            _historiser(formation, Action.RESTAURATION, utilisateur)
        return formation


    @log_metier("service", champs=["formation.id", "formation.statut"])
    def supprimer(self, formation, utilisateur=None):
        # SCRUM-23 : une formation qui a des sessions doit d'abord être archivée
        if formation.sessions.exists() and formation.statut != Statut.ARCHIVEE:
            raise ErreurMetier('A_DES_SESSIONS', 'Cette formation a des sessions : archivez-la avant de la supprimer.', 409)
        with transaction.atomic():
            _historiser(formation, Action.SUPPRESSION, utilisateur)  # la ligne reste, sans lien vers la formation
            formation.delete()


    @log_metier("service", champs=["formation.id", "formation.statut"])
    def publier(self, formation, confirmer=False):
        # RG24 : un brouillon ne peut pas être publié
        if formation.statut not in (Statut.VALIDEE, Statut.INCOMPLETE):
            raise ErreurMetier('NON_PUBLIABLE', 'Seule une formation validée ou incomplète peut être publiée.', 409)
        # RG26
        if not formation.sequences.exists():
            raise ErreurMetier('PROGRAMME_REQUIS', 'Une formation ne peut pas être publiée sans son programme.', 409)
        # RG27
        if formation.statut == Statut.INCOMPLETE and not confirmer:
            raise ErreurMetier('CONFIRMATION_REQUISE', "Confirmez la publication d'une formation incomplète.", 409)
        formation.publication = Publication.PUBLIEE
        formation.save()
        return formation


    @log_metier("service", champs=["formation.id", "formation.statut"])
    def retirer_publication(self, formation):
        formation.publication = Publication.A_PUBLIER
        formation.save()
        return formation


    @log_metier("service", champs=["formation.id"])
    def ajouter_session(self, formation, date_debut, date_fin, lieu='', nombre_places=None):
        if formation.statut == Statut.ARCHIVEE:  # SCRUM-23
            raise ErreurMetier('ARCHIVEE', 'Une formation archivée ne reçoit plus de nouvelle session.', 409)
        if date_fin < date_debut:  # RG38
            raise ErreurMetier('DATES_INVALIDES', 'La date de fin ne peut pas être avant la date de début.')
        return Session.objects.create(formation=formation, date_debut=date_debut, date_fin=date_fin,
                                      lieu=lieu, nombre_places=nombre_places)


formation_service = FormationService()


MSG_ENTREPRISE_DEJA_ENREGISTREE = 'Cette entreprise est déjà enregistrée'  # SCRUM-113

# SCRUM-119 : documents d'un formateur (CV, diplômes)
FORMATS_DOCUMENT = ('pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx')
TAILLE_MAX_DOCUMENT = 10 * 1024 * 1024
MAX_CV = 1
MAX_DIPLOMES = 5


class SessionService:
    """Règles de gestion de Sessions et planning (SCRUM-25)."""

    @log_metier("service", champs=["resultat.taille"])
    def lister_sessions(self, utilisateur):
        # Seulement les sessions des formations du compte
        return (Session.objects.filter(formation__in=formations_visibles(utilisateur))
                .select_related('formation').prefetch_related('formateurs', 'apprenants'))

    @log_metier("service", champs=["resultat.taille"])
    def lister_formateurs(self, utilisateur, recherche=''):
        """Formateurs du centre (SCRUM-221 ; aucun tant que le centre n'est pas renseigné), triés par nom, avec leur
        nombre de sessions (SCRUM-119). `recherche` : garde ceux dont le prénom et nom ou l'e-mail contient ce texte."""
        if not utilisateur.organisme_id:
            return Formateur.objects.none()
        formateurs = (Formateur.objects.filter(organisme_id=utilisateur.organisme_id)
                      .annotate(nombre_sessions=Count('sessions', distinct=True),
                                nom_complet=Concat('prenom', Value(' '), 'nom'))
                      .order_by(Lower('nom'), Lower('prenom'), 'id'))
        recherche = (recherche or '').strip()
        if recherche:
            formateurs = formateurs.filter(Q(nom_complet__icontains=recherche) | Q(email__icontains=recherche))
        return formateurs

    @log_metier("service", champs=["resultat.taille"])
    def lister_apprenants(self, utilisateur, recherche=''):
        """Apprenants du centre (SCRUM-221), triés par nom, avec leur nombre de sessions (SCRUM-112).
        `recherche` : garde ceux dont le prénom et nom, l'e-mail ou l'entreprise contient ce texte."""
        if not utilisateur.organisme_id:
            return Apprenant.objects.none()
        apprenants = (Apprenant.objects.filter(organisme_id=utilisateur.organisme_id)
                      .select_related('entreprise_cliente')
                      .annotate(nombre_sessions=Count('sessions', distinct=True),
                                nom_complet=Concat('prenom', Value(' '), 'nom'))
                      .order_by(Lower('nom'), Lower('prenom'), 'id'))
        recherche = (recherche or '').strip()
        if recherche:
            apprenants = apprenants.filter(
                Q(nom_complet__icontains=recherche) | Q(email__icontains=recherche)
                | Q(entreprise_cliente__raison_sociale__icontains=recherche)
                | Q(entreprise_cliente__isnull=True, entreprise__icontains=recherche))
        return apprenants

    @log_metier("service", champs=["resultat.taille"])
    def lister_entreprises(self, utilisateur, recherche=''):
        """Entreprises clientes du centre (SCRUM-112 ; aucune tant que le centre n'est pas renseigné), triées par raison
        sociale, avec leur nombre de salariés : apprenants du centre qui y sont rattachés (SCRUM-120).
        `recherche` : garde celles dont la raison sociale, le SIRET (espaces ignorés) ou la ville contient ce texte."""
        if not utilisateur.organisme_id:
            return Entreprise.objects.none()
        entreprises = (Entreprise.objects.filter(organisme_id=utilisateur.organisme_id)
                       .annotate(nombre_salaries=Count('apprenants', distinct=True,
                                                       filter=Q(apprenants__organisme_id=utilisateur.organisme_id)))
                       .order_by(Lower('raison_sociale'), 'id'))
        recherche = (recherche or '').strip()
        if recherche:
            filtre = Q(raison_sociale__icontains=recherche) | Q(ville__icontains=recherche)
            siret = recherche.replace(' ', '')
            if siret:
                filtre |= Q(siret__icontains=siret)
            entreprises = entreprises.filter(filtre)
        return entreprises

    @log_metier("service", champs=["utilisateur.organisme.raison_sociale", "resultat.id"],
                message="La société {utilisateur.organisme.raison_sociale} a créé le formateur "
                        "n° {resultat.id} : création réussie",
                message_echec="La société {utilisateur.organisme.raison_sociale} n'a pas pu créer de formateur")
    def creer_formateur(self, utilisateur, prenom, nom, email, entreprise='', statut='', numero_nda=''):
        """Enregistre un formateur du centre (SCRUM-26) ; il est ensuite proposé à l'étape 2 de « Nouvelle session ».
        SCRUM-119 : statut facultatif ; le NDA n'est gardé que pour un sous-traitant."""
        if statut != Formateur.Statut.SOUS_TRAITANT:
            numero_nda = ''
        return Formateur.objects.create(organisme=_organisme_requis(utilisateur), prenom=prenom, nom=nom,
                                        email=email, entreprise=entreprise, statut=statut, numero_nda=numero_nda)

    def ajouter_document(self, utilisateur, formateur_id, type_document, fichier):
        """SCRUM-119 : enregistre un document (CV ou diplôme) d'un formateur du centre, appelé pour chaque fichier
        juste après sa création. PDF, JPG, PNG ou Word, 10 Mo au plus ; 1 CV et 5 diplômes au plus.
        404 FORMATEUR_INTROUVABLE (absent ou d'un autre centre) ; 400 sinon, avec un message qui nomme le fichier."""
        formateur = (Formateur.objects.filter(pk=formateur_id, organisme_id=utilisateur.organisme_id).first()
                     if utilisateur.organisme_id else None)
        if formateur is None:
            raise ErreurMetier('FORMATEUR_INTROUVABLE', 'Formateur introuvable', 404)
        if type_document not in FormateurDocument.Type.values:
            raise ErreurMetier('TYPE_INVALIDE', 'Indiquez le type du document : CV ou DIPLOME.')
        if fichier is None:
            raise ErreurMetier('FICHIER_REQUIS', 'Ajoutez un fichier.')
        nom = fichier.name[:255]
        extension = Path(nom).suffix.lower().lstrip('.')
        if extension not in FORMATS_DOCUMENT:
            raise ErreurMetier('FORMAT_INVALIDE', f'« {nom} » refusé : format non accepté (PDF, JPG, PNG ou Word)')
        if fichier.size > TAILLE_MAX_DOCUMENT:
            raise ErreurMetier('FICHIER_TROP_VOLUMINEUX', f'« {nom} » refusé : plus de 10 Mo')
        deja = formateur.documents.filter(type=type_document).count()
        if type_document == FormateurDocument.Type.CV and deja >= MAX_CV:
            raise ErreurMetier('CV_DEJA_PRESENT', f'« {nom} » refusé : 1 CV maximum')
        if type_document == FormateurDocument.Type.DIPLOME and deja >= MAX_DIPLOMES:
            raise ErreurMetier('TROP_DE_DIPLOMES', f'« {nom} » refusé : 5 diplômes maximum')
        return FormateurDocument.objects.create(formateur=formateur, type=type_document, nom_fichier=nom,
                                                format=extension, taille=fichier.size, contenu=fichier.read())

    def creer_entreprise(self, utilisateur, **donnees):
        """SCRUM-113 : enregistre une entreprise cliente du centre. Un SIRET une seule fois par centre :
        409 SIRET_DEJA_ENREGISTRE sinon (un autre centre peut enregistrer la même entreprise).
        Pas de log métier pour l'instant (à décider par la BA)."""
        organisme = _organisme_requis(utilisateur)
        if Entreprise.objects.filter(organisme=organisme, siret=donnees['siret']).exists():
            raise ErreurMetier('SIRET_DEJA_ENREGISTRE', MSG_ENTREPRISE_DEJA_ENREGISTREE, 409,
                               siret=[MSG_ENTREPRISE_DEJA_ENREGISTREE])
        try:
            with transaction.atomic():
                return Entreprise.objects.create(organisme=organisme, **donnees)
        except IntegrityError as e:  # deux enregistrements simultanés du même SIRET
            raise ErreurMetier('SIRET_DEJA_ENREGISTRE', MSG_ENTREPRISE_DEJA_ENREGISTREE, 409,
                               siret=[MSG_ENTREPRISE_DEJA_ENREGISTREE]) from e

    @log_metier("service", champs=["resultat.id"])
    def creer_apprenant(self, utilisateur, prenom, nom, email, statut, entreprise='', telephone='',
                        entreprise_id=None, poste=''):
        """Enregistre un apprenant du centre (SCRUM-27, SCRUM-112) ; il est ensuite proposé à l'étape 3 de
        « Nouvelle session ». Entreprise cliente et poste ne sont gardés que pour un salarié ; l'entreprise doit être
        une entreprise cliente du centre (400 ENTREPRISE_INTROUVABLE sinon)."""
        organisme = _organisme_requis(utilisateur)
        entreprise_cliente = None
        if statut != Apprenant.Statut.SALARIE:
            poste = ''
        elif entreprise_id is not None:
            entreprise_cliente = Entreprise.objects.filter(pk=entreprise_id, organisme=organisme).first()
            if entreprise_cliente is None:
                raise ErreurMetier('ENTREPRISE_INTROUVABLE', 'Cette entreprise n’existe pas parmi vos entreprises clientes.',
                                   champs={'entreprise_id': ['Cette entreprise n’existe pas parmi vos entreprises clientes.']})
        return Apprenant.objects.create(organisme=organisme, prenom=prenom, nom=nom, email=email,
                                        entreprise=entreprise, telephone=telephone, statut=statut,
                                        entreprise_cliente=entreprise_cliente, poste=poste)

    @log_metier("service", champs=["donnees.modalite", "formateurs.taille", "apprenants.taille"])
    def creer_session(self, utilisateur, formateurs, apprenants, **donnees):
        """Crée une session « Prévue » avec ses formateurs et ses apprenants, sur une formation du compte,
        sans dépasser le nombre de places (SCRUM-166)."""
        if not formations_visibles(utilisateur).filter(pk=donnees['formation'].pk).exists():
            raise FormationIntrouvable()
        if donnees['date_fin'] < donnees['date_debut']:
            raise ErreurMetier('DATES_INVALIDES', 'La date de fin doit être postérieure ou égale à la date de début.')
        if not formateurs:
            raise ErreurMetier('FORMATEUR_REQUIS', 'Une session doit avoir au moins un formateur.')
        if not apprenants:
            raise ErreurMetier('APPRENANT_REQUIS', 'Une session doit avoir au moins un apprenant.')
        # SCRUM-221 : formateurs et apprenants du centre seulement
        if any(p.organisme_id != utilisateur.organisme_id for p in [*formateurs, *apprenants]):
            raise ErreurMetier('PERSONNE_INTROUVABLE', 'Un formateur ou un apprenant choisi n’existe pas dans votre centre.')
        if len(apprenants) > donnees['nombre_places']:
            raise ErreurMetier('TROP_APPRENANTS',
                               f"Trop d’apprenants : {len(apprenants)} cochés pour {donnees['nombre_places']} places.")
        with transaction.atomic():
            session = Session.objects.create(statut=Session.Statut.PREVUE, **donnees)
            session.formateurs.set(formateurs)
            session.apprenants.set(apprenants)
        return session


session_service = SessionService()


class ModeleIntrouvable(ErreurMetier):
    """404 : type de modèle inconnu (RG2 : seuls les 4 types de TypeModele existent)."""

    def __init__(self):
        super().__init__('MODELE_INTROUVABLE', 'Modèle introuvable', 404)


# SCRUM-213 : seule limite technique d'un document enregistré (RG12 : aucun contrôle de son contenu)
TAILLE_MAX_CONTENU = 1_000_000


class ContenuModeleInvalide(ErreurMetier):
    """400 : le document envoyé n'est pas un texte ou dépasse la taille maximale."""

    def __init__(self, message):
        super().__init__('CONTENU_INVALIDE', message)


# SCRUM-215 « Importer son propre document Word » (RG11) : .docx de 10 Mo au plus
FORMAT_WORD = '.docx'
TAILLE_MAX_WORD = 10 * 1024 * 1024
# Styles Word -> styles de l'éditeur (Titre 1 = h1, Titre 2 = h3, comme les modèles d'origine)
STYLES_WORD = (
    "p[style-name='Title'] => h1:fresh\n"
    "p[style-name='Heading 1'] => h1:fresh\n"
    "p[style-name='Heading 2'] => h3:fresh\n"
    "p[style-name='Heading 3'] => h3:fresh\n"
    "u => u\n"
    "strike => s"
)
# Seules balises gardées : ni script, ni lien, ni image, ni attribut. Tableaux : chaque case devient un paragraphe
BALISES_WORD = {'p', 'h1', 'h3', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'br'}


class ImportWordRefuse(ErreurMetier):
    """400 : FORMAT_INVALIDE, FICHIER_TROP_VOLUMINEUX ou FICHIER_ILLISIBLE (motif dans les logs)."""


def html_depuis_word(fichier):
    """Le texte du .docx avec sa mise en forme principale (mammoth), nettoyé (nh3) avant d'être affiché."""
    try:
        resultat = mammoth.convert_to_html(fichier, style_map=STYLES_WORD)
    except Exception as exc:  # pas un vrai .docx (archive ou XML illisible)
        raise ImportWordRefuse('FICHIER_ILLISIBLE',
                               'Ce fichier Word n’a pas pu être lu. Vérifiez qu’il s’ouvre dans Word.') from exc
    return nh3.clean(resultat.value, tags=BALISES_WORD, attributes={}, link_rel=None, strip_comments=True)


class ExportWordImpossible(ErreurMetier):
    """500 : le fichier Word n'a pas pu être créé (SCRUM-216)."""

    def __init__(self):
        super().__init__('EXPORT_IMPOSSIBLE', 'Le fichier Word n’a pas pu être créé. Réessayez.', 500)


logger_metier = logging.getLogger('quali_formation.metier')
# Champs des logs métier des modèles (identifiants seulement, jamais de contenu)
CHAMP_TYPE_MODELE = 'type_modele'
CHAMP_ORGANISME = 'utilisateur.organisme_id'


def fichier_word(contenu, nom, champs_log):
    """SCRUM-216 : un modèle (générique, ou de la formation avec SCRUM-219) en .docx : {fichier, nom_fichier}.
    Pas de log pour un téléchargement réussi ; en cas d'échec, une ligne ERROR avec seulement les identifiants
    de `champs_log` (organisme, type de modèle), jamais le contenu du document."""
    try:
        fichier = docx_depuis_html(contenu, nom)
    except Exception as exc:
        logger_metier.exception('Export Word en échec', extra={'layer': 'service', **champs_log, **error_fields(exc)})
        raise ExportWordImpossible() from exc
    return {'fichier': fichier, 'nom_fichier': f'Modèle - {nom}.docx'}


# Dictionnaire des variables {{code}} (code, libellé, catégorie...) ; table Variable avec SCRUM-214
VARIABLE = re.compile(r'\{\{\s*([A-Za-z0-9_]+)\s*\}\}')


def dictionnaire_variables():
    """{code: libellé} des variables du dictionnaire de données (table Variable, SCRUM-214)."""
    return dict(Variable.objects.values_list('code', 'libelle'))


def variables_du_contenu(contenu):
    """Codes {{code}} d'un document, dans l'ordre d'apparition, sans doublon."""
    return list(dict.fromkeys(VARIABLE.findall(contenu)))


def _verifier_contenu(contenu, nom_fichier_importe):
    """RG12 : aucun contrôle ni blocage sur le contenu (mentions légales, variables) ; seulement un texte lisible
    de taille raisonnable."""
    if not isinstance(contenu, str):
        raise ContenuModeleInvalide('Le document envoyé est vide ou illisible.')
    if len(contenu) > TAILLE_MAX_CONTENU:
        raise ContenuModeleInvalide('Le document est trop volumineux pour être enregistré.')
    if nom_fichier_importe is not None and not isinstance(nom_fichier_importe, str):
        raise ContenuModeleInvalide('Le nom du document importé est illisible.')


class ModeleFormationExistant(ErreurMetier):
    """409 : la formation a déjà son modèle pour ce document (RG16, SCRUM-218)."""

    def __init__(self):
        super().__init__('MODELE_FORMATION_EXISTANT', 'Cette formation a déjà son modèle pour ce document.', 409)


class FormationArchivee(ErreurMetier):
    """400 : une formation archivée ne reçoit plus de nouveau modèle (RG27)."""

    def __init__(self):
        super().__init__('FORMATION_ARCHIVEE', 'Cette formation est archivée : elle ne peut plus recevoir de modèle.')


class ModeleService:
    """Modèles de documents (épic Modèles SCRUM-125). Le modèle d'origine n'est jamais écrit (RG3) : un compte
    utilise son modèle générique s'il en a un, sinon le modèle d'origine (statut ORIGINE)."""

    def _modeles_du_compte(self, utilisateur):
        # Seulement les modèles génériques de ce compte (RGT1)
        return {m.type: m for m in ModeleGenerique.objects.filter(proprietaire=utilisateur)}

    @staticmethod
    def _decrire(origine, generique, dictionnaire):
        """Le modèle du compte, avec le libellé de chacune de ses variables (étiquettes du document).
        Une variable absente du dictionnaire garde son code comme libellé : aucun blocage (RG12).
        Jamais modifié : le modèle d'origine, sans date de mise à jour (RG4)."""
        if generique is None:
            modele = {'type': origine.type, 'nom': origine.nom, 'statut': ModeleGenerique.Statut.ORIGINE,
                      'contenu': origine.contenu, 'date_maj': None, 'nom_fichier_importe': None}
        else:
            modele = {'type': origine.type, 'nom': origine.nom, 'statut': generique.statut,
                      'contenu': generique.contenu, 'date_maj': generique.date_maj,
                      'nom_fichier_importe': generique.nom_fichier_importe}
        modele['variables'] = [{'code': c, 'libelle': dictionnaire.get(c, c)}
                               for c in variables_du_contenu(modele['contenu'])]
        return modele

    def lister(self, utilisateur):
        """SCRUM-211/212 : les 4 modèles génériques du compte (RG1, RG2), dans l'ordre de TypeModele
        (contenu pour la miniature). Plus de message « Pensez à remplir… » (RG13 retirée : l'organisme renseigne
        ses informations à sa première connexion)."""
        generiques = self._modeles_du_compte(utilisateur)
        origines = {m.type: m for m in ModeleOrigine.objects.all()}
        dictionnaire = dictionnaire_variables()
        modeles = [self._decrire(origines[t], generiques.get(t), dictionnaire) for t in TypeModele.values if t in origines]
        return {'modeles': modeles}

    def obtenir(self, utilisateur, type_modele):
        """Un modèle du compte, avec le libellé de chacune de ses variables."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        return self._decrire(origine, self._modeles_du_compte(utilisateur).get(origine.type), dictionnaire_variables())

    @log_metier("service", champs=["utilisateur.id", CHAMP_TYPE_MODELE, "resultat.statut"])
    def enregistrer(self, utilisateur, type_modele, contenu, nom_fichier_importe=None):
        """Enregistre le modèle générique du compte, créé à partir du modèle d'origine à la première fois (RG3).
        RG12 : aucun contrôle ni blocage sur le contenu (mentions légales, variables) ; seulement un texte
        de taille raisonnable. RG4 : « Mon document » (IMPORTE) après un import Word (SCRUM-215), et le reste
        quand il est retouché sans nouvel import (même nom de fichier) ; sinon « Personnalisé »."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        _verifier_contenu(contenu, nom_fichier_importe)
        existant = ModeleGenerique.objects.filter(proprietaire=utilisateur, type=origine.type).first()
        if nom_fichier_importe:
            statut, nom_fichier = ModeleGenerique.Statut.IMPORTE, nom_fichier_importe[:255]
        elif existant is not None and existant.statut == ModeleGenerique.Statut.IMPORTE:
            statut, nom_fichier = existant.statut, existant.nom_fichier_importe
        else:
            statut, nom_fichier = ModeleGenerique.Statut.PERSONNALISE, None
        modele, _ = ModeleGenerique.objects.update_or_create(
            proprietaire=utilisateur, type=origine.type,
            defaults={'contenu': contenu, 'statut': statut, 'nom_fichier_importe': nom_fichier})
        return modele

    @log_metier("service", champs=[CHAMP_ORGANISME, CHAMP_TYPE_MODELE, "extension", "taille"])
    def importer_word(self, utilisateur, type_modele, fichier, extension, taille):
        """SCRUM-215 : le contenu d'un .docx converti pour l'éditeur (RG11). RG8 : rien n'est enregistré, et le
        fichier n'est jamais gardé (lu en mémoire ou dans un fichier temporaire effacé par Django).
        Logs : jamais le nom du fichier ni son contenu (seulement extension et taille)."""
        if not ModeleOrigine.objects.filter(type=str(type_modele).upper()).exists():
            raise ModeleIntrouvable()
        if fichier is None or extension != FORMAT_WORD:
            raise ImportWordRefuse('FORMAT_INVALIDE', 'Seuls les fichiers Word (.docx) sont acceptés.')
        if taille > TAILLE_MAX_WORD:
            raise ImportWordRefuse('FICHIER_TROP_VOLUMINEUX',
                                   'Le fichier dépasse 10 Mo : choisissez un document plus léger.')
        return {'contenu': html_depuis_word(fichier)}

    def exporter_word(self, utilisateur, type_modele):
        """SCRUM-216 : la dernière version ENREGISTRÉE du modèle du compte (le modèle d'origine s'il n'a jamais été
        enregistré) en .docx, nommé « Modèle - <nom du document>.docx », variables écrites {{code}} (RG9)."""
        modele = self.obtenir(utilisateur, type_modele)
        champs_log = {'class': 'ModeleService', 'method': 'exporter_word',
                      CHAMP_TYPE_MODELE: modele['type']}
        if utilisateur.organisme_id is not None:
            champs_log[CHAMP_ORGANISME] = str(utilisateur.organisme_id)
        return fichier_word(modele['contenu'], modele['nom'], champs_log)

    def origine(self, type_modele):
        """SCRUM-217 : le modèle d'origine (lecture seule), avec le libellé de chacune de ses variables."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        return self._decrire(origine, None, dictionnaire_variables())

    @log_metier("service", champs=[CHAMP_ORGANISME, CHAMP_TYPE_MODELE], message="Modèle générique rétabli")
    def retablir(self, utilisateur, type_modele):
        """SCRUM-217 : « Rétablir le modèle d'origine », après confirmation dans la fenêtre (RG5, RG8 : sans passer
        par « Enregistrer »). Le modèle générique du compte est supprimé : le compte utilise de nouveau le modèle
        d'origine (statut ORIGINE, plus de document importé) et les formations sans leur propre modèle aussi (RG6).
        RG5 : les modèles de la formation (SCRUM-218) ne sont jamais touchés."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        ModeleGenerique.objects.filter(proprietaire=utilisateur, type=origine.type).delete()
        return self._decrire(origine, None, dictionnaire_variables())

    def formations_pour_duplication(self, utilisateur, type_modele):
        """SCRUM-218 : fenêtre « Dupliquer » : les formations de l'organisme sans modèle pour ce document
        (`disponibles`, seules proposées, RG16) et celles qui en ont déjà un (`deja_crees`), hors archivées (RG27)."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        formations = formations_visibles(utilisateur).exclude(statut=Formation.Statut.ARCHIVEE).order_by('intitule', 'id')
        avec_modele = set(ModeleFormation.objects.filter(formation__in=formations, type=origine.type)
                          .values_list('formation_id', flat=True))
        resultat = {'disponibles': [], 'deja_crees': []}
        for f in formations:
            resultat['deja_crees' if f.pk in avec_modele else 'disponibles'].append({'id': f.pk, 'intitule': f.intitule})
        return resultat

    @log_metier("service", champs=[CHAMP_ORGANISME, "formation_id", CHAMP_TYPE_MODELE],
                message="Modèle de la formation créé")
    def creer_modele_formation(self, utilisateur, formation_id, type_modele, contenu, nom_fichier_importe=None):
        """SCRUM-218 : « Enregistrer » le nouveau modèle de la formation (RG8 : rien n'est créé avant). RG17 : le
        contenu envoyé part du modèle générique, puis il est indépendant. RG16 : 409 si la formation a déjà le sien.
        404 : formation d'un autre organisme ou document inconnu."""
        formation = formations_visibles(utilisateur).filter(pk=formation_id).first()
        if formation is None:
            raise FormationIntrouvable()
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        if formation.statut == Formation.Statut.ARCHIVEE:
            raise FormationArchivee()
        _verifier_contenu(contenu, nom_fichier_importe)
        if ModeleFormation.objects.filter(formation=formation, type=origine.type).exists():
            raise ModeleFormationExistant()
        try:
            with transaction.atomic():
                modele = ModeleFormation.objects.create(formation=formation, type=origine.type, contenu=contenu,
                                                        nom_fichier_importe=nom_fichier_importe[:255] if nom_fichier_importe else None)
        except IntegrityError as exc:  # deux créations en même temps : la contrainte d'unicité tranche (RG16)
            raise ModeleFormationExistant() from exc
        return {'id': modele.pk, 'formation': {'id': formation.pk, 'intitule': formation.intitule},
                'type': modele.type, 'nom': origine.nom, 'statut': 'FORMATION', 'contenu': modele.contenu,
                'nom_fichier_importe': modele.nom_fichier_importe, 'date_creation': modele.date_creation,
                'date_maj': modele.date_maj}

    def formations_utilisant(self, utilisateur, type_modele):
        """RG6 : (formations qui utilisent le modèle générique de ce type, formations du compte), hors archivées.
        Tant que les modèles de la formation n'existent pas (SCRUM-219), toutes l'utilisent."""
        nb_formations = formations_visibles(utilisateur).exclude(statut=Formation.Statut.ARCHIVEE).count()
        return nb_formations, nb_formations

    def modifier(self, utilisateur, type_modele, contenu, nom_fichier_importe=None):
        """SCRUM-213 : « Enregistrer » dans l'éditeur. Le modèle enregistré (statut PERSONNALISE, ou IMPORTE
        après un import Word) et, pour le message de confirmation, le nombre de formations qui utilisent cette
        nouvelle version (RG6)."""
        modele = self.enregistrer(utilisateur, type_modele, contenu, nom_fichier_importe)
        utilisant, total = self.formations_utilisant(utilisateur, modele.type)
        return {**self.obtenir(utilisateur, modele.type), 'nb_formations_utilisant': utilisant, 'nb_formations': total}

    def resume(self, utilisateur):
        """SCRUM-210 : nombre de modèles proposés (RG2 : ceux de TypeModele) et de formations du compte,
        hors formations archivées (plus de nouveaux documents pour elles)."""
        formations = formations_visibles(utilisateur).exclude(statut=Formation.Statut.ARCHIVEE)
        return {'nb_modeles': len(TypeModele), 'nb_formations': formations.count()}


modele_service = ModeleService()


class VariableService:
    def lister(self):
        """SCRUM-214 : variables du panneau de l'éditeur (code, libellé, catégorie, exemple). RG10 : catégories
        dans l'ordre Session, Formation, Apprenant, Client, Prix, Fin de formation, Document, Organisme
        (ordre de Variable.Categorie), puis l'ordre de chaque variable dans sa catégorie."""
        rang = {categorie: i for i, categorie in enumerate(Variable.Categorie.values)}
        variables = sorted(Variable.objects.all(), key=lambda v: (rang.get(v.categorie, len(rang)), v.ordre, v.code))
        return [{'code': v.code, 'libelle': v.libelle, 'categorie': v.categorie, 'exemple': v.exemple} for v in variables]


variable_service = VariableService()


class ItemService:
    def list_items(self):
        return Item.objects.all()

    def create_item(self, data):
        serializer = ItemSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return serializer


item_service = ItemService()


# ---- Créer un compte (SCRUM-15) ----

# RG-CC-03 et RG-CC-04 : mêmes règles que les indicateurs cochés en direct dans l'écran
REGLES_MOT_DE_PASSE = (
    ('8 caractères minimum', lambda m: len(m) >= 8),
    ('une majuscule', lambda m: any(c.isupper() for c in m)),
    ('une minuscule', lambda m: any(c.islower() for c in m)),
    ('un chiffre', lambda m: any(c.isdigit() for c in m)),
    ('un caractère spécial', lambda m: any(not c.isalnum() and not c.isspace() for c in m)),
)


class DonneesInvalides(APIException):
    """Une ou plusieurs informations du formulaire sont invalides : liste de {champ, code, message}.
    Erreur « client » (400) : journalisée en avertissement par @log_metier."""

    status_code = 400

    def __init__(self, erreurs, siret=None):
        super().__init__(f'{len(erreurs)} information(s) invalide(s)')
        self.erreurs = erreurs
        self.siret = siret  # SIRET déjà utilisé par un autre centre (SCRUM-221, critère 8), pour les logs

    @property
    def champs(self):
        """Noms des champs refusés (ex. ['siret', 'nom']), sans les valeurs saisies : lisible dans les logs."""
        return [e['champ'] for e in self.erreurs]

    @property
    def code(self):
        """Code du log (errorCode) : SIRET_DEJA_UTILISE si le refus vient d'un SIRET déjà inscrit."""
        return SIRET_DEJA_UTILISE if any(e['code'] == SIRET_DEJA_UTILISE for e in self.erreurs) else None


SIRET_DEJA_UTILISE = 'SIRET_DEJA_UTILISE'


def _erreur_champ(champ, code, message):
    return {'champ': champ, 'code': code, 'message': message}


def _erreur_email(email):
    # RG-CC-01
    if not email:
        return _erreur_champ('email', 'EMAIL_REQUIS', "L'adresse e-mail est obligatoire.")
    try:
        validate_email(email)
    except ValidationError:
        return _erreur_champ('email', 'EMAIL_INVALIDE', "L'adresse e-mail n'est pas au bon format (ex. vous@organisme.fr).")
    return None


def _erreur_mot_de_passe(mot_de_passe):
    # RG-CC-03 et RG-CC-04
    if not mot_de_passe:
        return _erreur_champ('mot_de_passe', 'MOT_DE_PASSE_REQUIS', 'Le mot de passe est obligatoire.')
    manquantes = [libelle for libelle, respectee in REGLES_MOT_DE_PASSE if not respectee(mot_de_passe)]
    if manquantes:
        return _erreur_champ('mot_de_passe', 'MOT_DE_PASSE_NON_CONFORME',
                       f"Le mot de passe doit contenir : {', '.join(manquantes)}.")
    return None


def _erreurs_inscription(email, mot_de_passe, confirmation, cgu_acceptees):
    erreurs = [_erreur_email(email), _erreur_mot_de_passe(mot_de_passe)]
    if confirmation != mot_de_passe:  # RG-CC-05
        erreurs.append(_erreur_champ('confirmation', 'CONFIRMATION_DIFFERENTE',
                               'La confirmation ne correspond pas au mot de passe.'))
    if cgu_acceptees is not True:  # RG-CC-06
        erreurs.append(_erreur_champ('cgu_acceptees', 'CGU_NON_ACCEPTEES',
                               'Vous devez accepter les CGU / CGV et la politique de confidentialité.'))
    return [e for e in erreurs if e]


class CompteService:
    """Création du compte d'un organisme de formation (SCRUM-15) et connexion (SCRUM-16). Ni l'e-mail ni le mot de passe ne sont journalisés :
    @log_metier n'écrit que le numéro du compte (resultat.id), et les messages d'erreur ne reprennent aucune donnée saisie."""

    @log_metier("service", champs=["resultat.id"])
    def creer_compte(self, email, mot_de_passe, confirmation, cgu_acceptees):
        email = str(email or '').strip().lower()  # RG-CC-02 : majuscules et espaces autour ignorés
        mot_de_passe = str(mot_de_passe or '')
        confirmation = str(confirmation or '')
        erreurs = _erreurs_inscription(email, mot_de_passe, confirmation, cgu_acceptees)
        if erreurs:
            raise DonneesInvalides(erreurs)  # RG-CC-10 : rien n'est créé
        deja = ErreurMetier('EMAIL_DEJA_UTILISE', 'Un compte existe déjà avec cet e-mail.', 409)
        if Utilisateur.objects.filter(email__iexact=email).exists():
            raise deja
        try:
            # RG-CC-07 : seul le hash du mot de passe est enregistré
            return Utilisateur.objects.create(email=email, mot_de_passe=make_password(mot_de_passe),
                                              cgu_acceptees_le=timezone.now())
        except IntegrityError:  # deux inscriptions simultanées avec la même adresse
            raise deja from None

    @log_metier("service", champs=["resultat.id"])
    def connecter(self, email, mot_de_passe):
        """SCRUM-16 « Se connecter » : renvoie l'utilisateur dont l'e-mail (majuscules et espaces ignorés, comme
        à la création) et le mot de passe (comparé au hash) correspondent."""
        email = str(email or '').strip().lower()
        mot_de_passe = str(mot_de_passe or '')
        erreurs = []  # RG-CX-03 : champs obligatoires
        if not email:
            erreurs.append(_erreur_champ('email', 'EMAIL_REQUIS', "L'adresse e-mail est obligatoire."))
        if not mot_de_passe:
            erreurs.append(_erreur_champ('mot_de_passe', 'MOT_DE_PASSE_REQUIS', 'Le mot de passe est obligatoire.'))
        if erreurs:
            raise DonneesInvalides(erreurs)
        utilisateur = Utilisateur.objects.filter(email=email).first()  # RG-CX-04
        # Hash vérifié même pour un e-mail inconnu : même temps de réponse, on ne devine pas quels comptes existent
        hash_attendu = utilisateur.mot_de_passe if utilisateur else _hash_factice()
        if not check_password(mot_de_passe, hash_attendu) or utilisateur is None:
            # RG-CX-05 : un seul message, sans dire si c'est l'e-mail ou le mot de passe qui est faux
            raise ErreurMetier('IDENTIFIANTS_INVALIDES', 'E-mail ou mot de passe incorrect', 401)
        return utilisateur


_HASH_FACTICE = []


def _hash_factice():
    if not _HASH_FACTICE:
        _HASH_FACTICE.append(make_password('compte-inexistant'))
    return _HASH_FACTICE[0]


compte_service = CompteService()


# ---- Informations du centre à la première connexion (SCRUM-221) ----

# Champs du formulaire, dans l'ordre de l'écran : (champ, message s'il est obligatoire et vide)
# Champs du formulaire (maquettes SCRUM-221 du 25/11) ; les autres colonnes de la table organisme (représentant,
# contacts, conditions de vente) restent vides et facultatives : elles seront renseignées plus tard dans Paramètres.
CHAMPS_ORGANISME = (
    ('siret', 'Le SIRET est obligatoire'),
    ('raison_sociale', 'La raison sociale est obligatoire'),
    ('adresse', 'L’adresse est obligatoire'),
    ('numero_declaration_activite', None),
    ('region_nda', None),
    ('ville_signature', None),
)
CHAMPS_GESTIONNAIRE = (('prenom', 'Le prénom est obligatoire'), ('nom', 'Le nom est obligatoire'))


def _texte(donnees, champ):
    valeur = donnees.get(champ) if isinstance(donnees, dict) else None
    return valeur.strip() if isinstance(valeur, str) else ''


def _erreurs_organisme(valeurs):
    """Champs obligatoires et formats : SIRET 14 chiffres, N° de déclaration d'activité 11 chiffres."""
    erreurs = [_erreur_champ(champ, 'CHAMP_REQUIS', message)
               for champ, message in (*CHAMPS_ORGANISME, *CHAMPS_GESTIONNAIRE) if message and not valeurs[champ]]
    requis = {e['champ'] for e in erreurs}
    for champ, valeur in valeurs.items():
        modele = Utilisateur if champ in ('prenom', 'nom') else Organisme
        longueur = modele._meta.get_field(champ).max_length
        if len(valeur) > longueur:
            erreurs.append(_erreur_champ(champ, 'TROP_LONG', f'{longueur} caractères maximum'))
            requis.add(champ)
    if 'siret' not in requis and not re.fullmatch(r'\d{14}', valeurs['siret']):
        erreurs.append(_erreur_champ('siret', 'SIRET_INVALIDE', 'Le SIRET doit contenir 14 chiffres'))
    if 'numero_declaration_activite' not in requis and valeurs['numero_declaration_activite'] and not re.fullmatch(r'\d{11}', valeurs['numero_declaration_activite']):
        erreurs.append(_erreur_champ('numero_declaration_activite', 'NDA_INVALIDE',
                                     'Le N° de déclaration d’activité doit contenir 11 chiffres'))
    return erreurs


class OrganismeService:
    """Formulaire de première connexion (SCRUM-221) : crée le centre et fait du compte connecté son gestionnaire.
    Log métier : identifiant de l'utilisateur ; réussite (info) : identifiant du centre créé (resultat.id) et rôle
    attribué ; refus (warn) : noms des champs en erreur (erreur.champs), jamais les valeurs saisies ; erreur technique
    (error) : son type ; SIRET déjà inscrit (warn, errorCode SIRET_DEJA_UTILISE) : ce SIRET (erreur.siret). Aucune autre
    donnée saisie n'est journalisée."""

    @log_metier("service", champs=["utilisateur.id", "utilisateur.role", "resultat.id", "erreur.champs", "erreur.siret"])
    def enregistrer(self, utilisateur, donnees):
        if utilisateur.organisme_id is not None:
            raise ErreurMetier('ORGANISME_DEJA_RENSEIGNE', 'Les informations de votre centre sont déjà enregistrées.', 409)
        valeurs = {champ: _texte(donnees, champ) for champ, _ in (*CHAMPS_ORGANISME, *CHAMPS_GESTIONNAIRE)}
        # Espaces ignorés dans les numéros : « 123 456 789 00012 » = « 12345678900012 »
        for champ in ('siret', 'numero_declaration_activite'):
            valeurs[champ] = valeurs[champ].replace(' ', '')
        erreurs = _erreurs_organisme(valeurs)
        # Critère 8 : un seul centre par SIRET (vérifié avec les autres champs : tous les messages d'un coup)
        deja_utilise = not any(e['champ'] == 'siret' for e in erreurs)             and Organisme.objects.filter(siret=valeurs['siret']).exists()
        if deja_utilise:
            erreurs.append(_erreur_champ('siret', SIRET_DEJA_UTILISE,
                                         'Ce centre est déjà inscrit sur Quali-formation. Contactez son gestionnaire.'))
        if erreurs:
            raise DonneesInvalides(erreurs, siret=valeurs['siret'] if deja_utilise else None)  # rien n'est enregistré
        # Le centre et le gestionnaire ensemble : si une étape échoue, rien n'est enregistré
        with transaction.atomic():
            organisme = Organisme.objects.create(**{champ: valeurs[champ] for champ, _ in CHAMPS_ORGANISME})
            utilisateur.prenom, utilisateur.nom = valeurs['prenom'], valeurs['nom']
            utilisateur.role = Utilisateur.Role.GESTIONNAIRE
            utilisateur.organisme = organisme
            utilisateur.save(update_fields=['prenom', 'nom', 'role', 'organisme'])
        return organisme


organisme_service = OrganismeService()
