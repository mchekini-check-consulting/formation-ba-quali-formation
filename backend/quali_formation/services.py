"""Règles de gestion du module Formations (RG01 à RG38), indépendantes de l'API pour être testées seules."""

import json
import re
from functools import cache
from pathlib import Path

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from quali_formation.blocs import blocs_manquants
from quali_formation.logging.log_metier import log_metier
from quali_formation.models import (
    Apprenant,
    Formateur,
    Formation,
    FormationHistorique,
    Item,
    ModeleGenerique,
    ModeleOrigine,
    Sequence,
    Session,
    TypeModele,
    Utilisateur,
)
from quali_formation.serializers import ItemSerializer

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
    """Formations que ce compte voit et modifie : celles qu'il a créées ; aucune si personne n'est connecté.
    Seul endroit qui décide « qui voit quoi » : le partage entre comptes d'un même organisme (US à venir)
    ne changera que ce filtre."""
    if utilisateur is None:
        return Formation.objects.none()
    return Formation.objects.filter(proprietaire=utilisateur)


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


class SessionService:
    """Règles de gestion de Sessions et planning (SCRUM-25)."""

    @log_metier("service", champs=["resultat.taille"])
    def lister_sessions(self, utilisateur):
        # Seulement les sessions des formations du compte
        return (Session.objects.filter(formation__in=formations_visibles(utilisateur))
                .select_related('formation').prefetch_related('formateurs', 'apprenants'))

    @log_metier("service", champs=["resultat.taille"])
    def lister_formateurs(self):
        return Formateur.objects.all()

    @log_metier("service", champs=["resultat.taille"])
    def lister_apprenants(self):
        return Apprenant.objects.all()

    @log_metier("service", champs=["resultat.id"])
    def creer_formateur(self, prenom, nom, email, entreprise=''):
        """Enregistre un formateur (SCRUM-26) ; il est ensuite proposé à l'étape 2 de « Nouvelle session »."""
        return Formateur.objects.create(prenom=prenom, nom=nom, email=email, entreprise=entreprise)

    @log_metier("service", champs=["resultat.id"])
    def creer_apprenant(self, prenom, nom, email, entreprise=''):
        """Enregistre un apprenant (SCRUM-27) ; il est ensuite proposé à l'étape 3 de « Nouvelle session »."""
        return Apprenant.objects.create(prenom=prenom, nom=nom, email=email, entreprise=entreprise)

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


# Dictionnaire des variables {{code}} (code, libellé, catégorie...) ; table Variable avec SCRUM-214
FICHIER_VARIABLES = Path(__file__).resolve().parent / 'donnees_modeles' / 'variables.json'
VARIABLE = re.compile(r'\{\{\s*([A-Za-z0-9_]+)\s*\}\}')


@cache
def dictionnaire_variables():
    """{code: libellé} des variables du dictionnaire de données."""
    return {v['code']: v['libelle'] for v in json.loads(FICHIER_VARIABLES.read_text(encoding='utf-8'))}


def variables_du_contenu(contenu):
    """Codes {{code}} d'un document, dans l'ordre d'apparition, sans doublon."""
    return list(dict.fromkeys(VARIABLE.findall(contenu)))


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
                      'contenu': origine.contenu, 'date_maj': None}
        else:
            modele = {'type': origine.type, 'nom': origine.nom, 'statut': generique.statut,
                      'contenu': generique.contenu, 'date_maj': generique.date_maj}
        modele['variables'] = [{'code': c, 'libelle': dictionnaire.get(c, c)}
                               for c in variables_du_contenu(modele['contenu'])]
        return modele

    def parametres_complets(self, utilisateur):
        """RG13 : vrai quand toutes les informations de l'organisme sont remplies dans Paramètres.
        Ces informations arrivent avec SCRUM-221 : d'ici là, aucune n'est remplie pour aucun compte."""
        return False

    def lister(self, utilisateur):
        """SCRUM-211/212 : les 4 modèles génériques du compte (RG1, RG2), dans l'ordre de TypeModele
        (contenu pour la miniature), et si le message orange « Pensez à remplir… » est à afficher (RG13)."""
        generiques = self._modeles_du_compte(utilisateur)
        origines = {m.type: m for m in ModeleOrigine.objects.all()}
        dictionnaire = dictionnaire_variables()
        modeles = [self._decrire(origines[t], generiques.get(t), dictionnaire) for t in TypeModele.values if t in origines]
        return {'modeles': modeles, 'parametres_complets': self.parametres_complets(utilisateur)}

    def obtenir(self, utilisateur, type_modele):
        """Un modèle du compte, avec le libellé de chacune de ses variables."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        return self._decrire(origine, self._modeles_du_compte(utilisateur).get(origine.type), dictionnaire_variables())

    @log_metier("service", champs=["utilisateur.id", "type_modele", "resultat.statut"])
    def enregistrer(self, utilisateur, type_modele, contenu):
        """Enregistre le modèle générique du compte, créé à partir du modèle d'origine à la première fois (RG3).
        RG12 : aucun contrôle ni blocage sur le contenu (mentions légales, variables) ; seulement un texte
        de taille raisonnable."""
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        if not isinstance(contenu, str):
            raise ContenuModeleInvalide('Le document envoyé est vide ou illisible.')
        if len(contenu) > TAILLE_MAX_CONTENU:
            raise ContenuModeleInvalide('Le document est trop volumineux pour être enregistré.')
        modele, _ = ModeleGenerique.objects.update_or_create(
            proprietaire=utilisateur, type=origine.type,
            defaults={'contenu': contenu, 'statut': ModeleGenerique.Statut.PERSONNALISE})
        return modele

    def formations_utilisant(self, utilisateur, type_modele):
        """RG6 : (formations qui utilisent le modèle générique de ce type, formations du compte), hors archivées.
        Tant que les modèles de la formation n'existent pas (SCRUM-219), toutes l'utilisent."""
        nb_formations = formations_visibles(utilisateur).exclude(statut=Formation.Statut.ARCHIVEE).count()
        return nb_formations, nb_formations

    def modifier(self, utilisateur, type_modele, contenu):
        """SCRUM-213 : « Enregistrer » dans l'éditeur. Le modèle enregistré (statut PERSONNALISE) et, pour le
        message de confirmation, le nombre de formations qui utilisent cette nouvelle version (RG6)."""
        modele = self.enregistrer(utilisateur, type_modele, contenu)
        utilisant, total = self.formations_utilisant(utilisateur, modele.type)
        return {**self.obtenir(utilisateur, modele.type), 'nb_formations_utilisant': utilisant, 'nb_formations': total}

    def resume(self, utilisateur):
        """SCRUM-210 : nombre de modèles proposés (RG2 : ceux de TypeModele) et de formations du compte,
        hors formations archivées (plus de nouveaux documents pour elles)."""
        formations = formations_visibles(utilisateur).exclude(statut=Formation.Statut.ARCHIVEE)
        return {'nb_modeles': len(TypeModele), 'nb_formations': formations.count()}


modele_service = ModeleService()


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

    def __init__(self, erreurs):
        super().__init__(f'{len(erreurs)} information(s) invalide(s)')
        self.erreurs = erreurs


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
