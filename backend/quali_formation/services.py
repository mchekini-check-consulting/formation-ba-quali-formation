"""Règles de gestion du module Formations (RG01 à RG38), indépendantes de l'API pour être testées seules."""

from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from quali_formation.blocs import blocs_manquants
from quali_formation.logging.loggable import loggable
from quali_formation.models import (
    Apprenant,
    Formateur,
    Formation,
    FormationHistorique,
    Item,
    Sequence,
    Session,
    Utilisateur,
)
from quali_formation.serializers import ItemSerializer

Statut = Formation.Statut
Publication = Formation.Publication
Action = FormationHistorique.Action


class ErreurMetier(APIException):
    """Règle de gestion non respectée ; `code` permet au frontend d'ouvrir la bonne pop-up.
    Erreur « client » (4xx) : les journaux (@loggable) la classent en avertissement, pas en panne."""

    def __init__(self, code, message, statut_http=400, **details):
        super().__init__(message)
        self.status_code = statut_http
        self.code = code
        self.message = message
        self.statut_http = statut_http
        self.details = details


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


def _meme_intitule(intitule):
    # Majuscules et espaces en trop ignorés : « Excel  avancé » = « excel avancé »
    return ' '.join(intitule.split()).casefold()


def _verifier_intitule_unique(formation, donnees):
    """SCRUM-20 : une autre formation de l'organisme porte déjà cet intitulé (la formation modifiée est exclue)."""
    autres = Formation.objects.filter(organisme=donnees['organisme'])
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


@loggable
class FormationService:
    """Règles de gestion du module Formations (couche service, journalisée par @loggable)."""

    def enregistrer(self, formation, donnees, action, forcer=False, doublon_accepte=False, utilisateur=None):
        """Crée (formation=None) ou modifie une formation.

        action « brouillon » : seul l'intitulé est obligatoire (RG02) ;
        action « valider » : intitulé, durée > 0 et modalité obligatoires (RG01), puis Validée si tous les
        blocs sont complets (RG13), sinon refus sauf `forcer` qui l'enregistre Incomplète (RG14, RG15).
        Même intitulé qu'une autre formation de l'organisme : refus sauf `doublon_accepte` (SCRUM-20).
        Une formation archivée ne se modifie pas : il faut d'abord la restaurer (SCRUM-23).
        """
        if formation is not None and formation.statut == Statut.ARCHIVEE:
            raise ErreurMetier('ARCHIVEE', "Une formation archivée ne se modifie pas : restaurez-la d'abord.", 409)
        if not donnees['intitule'].strip():
            raise ErreurMetier('INTITULE_REQUIS', "L'intitulé est obligatoire.")
        sequences = donnees.pop('sequences')

        statut = _statut_demande(donnees, len(sequences), action, forcer)
        if not doublon_accepte:
            _verifier_intitule_unique(formation, donnees)

        with transaction.atomic():
            nouvelle = formation is None
            if nouvelle:
                formation = Formation()
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


    def archiver(self, formation, utilisateur=None):
        # SCRUM-23 : la formation quitte « Toutes » pour le filtre « Archivées »
        formation.statut = Statut.ARCHIVEE
        with transaction.atomic():
            formation.save()
            _historiser(formation, Action.ARCHIVAGE, utilisateur)
        return formation


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


    def supprimer(self, formation, utilisateur=None):
        # SCRUM-23 : une formation qui a des sessions doit d'abord être archivée
        if formation.sessions.exists() and formation.statut != Statut.ARCHIVEE:
            raise ErreurMetier('A_DES_SESSIONS', 'Cette formation a des sessions : archivez-la avant de la supprimer.', 409)
        with transaction.atomic():
            _historiser(formation, Action.SUPPRESSION, utilisateur)  # la ligne reste, sans lien vers la formation
            formation.delete()


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


    def retirer_publication(self, formation):
        formation.publication = Publication.A_PUBLIER
        formation.save()
        return formation


    def ajouter_session(self, formation, date_debut, date_fin, lieu='', nombre_places=None):
        if formation.statut == Statut.ARCHIVEE:  # SCRUM-23
            raise ErreurMetier('ARCHIVEE', 'Une formation archivée ne reçoit plus de nouvelle session.', 409)
        if date_fin < date_debut:  # RG38
            raise ErreurMetier('DATES_INVALIDES', 'La date de fin ne peut pas être avant la date de début.')
        return Session.objects.create(formation=formation, date_debut=date_debut, date_fin=date_fin,
                                      lieu=lieu, nombre_places=nombre_places)


formation_service = FormationService()


@loggable
class SessionService:
    """Règles de gestion de Sessions et planning (SCRUM-25)."""

    def lister_sessions(self):
        return Session.objects.select_related('formation').prefetch_related('formateurs', 'apprenants')

    def lister_formateurs(self):
        return Formateur.objects.all()

    def lister_apprenants(self):
        return Apprenant.objects.all()

    def creer_formateur(self, prenom, nom, email):
        """Enregistre un formateur (SCRUM-26) ; il est ensuite proposé à l'étape 2 de « Nouvelle session »."""
        return Formateur.objects.create(prenom=prenom, nom=nom, email=email)

    def creer_apprenant(self, prenom, nom, email):
        """Enregistre un apprenant (SCRUM-27) ; il est ensuite proposé à l'étape 3 de « Nouvelle session »."""
        return Apprenant.objects.create(prenom=prenom, nom=nom, email=email)

    def creer_session(self, formateurs, apprenants, **donnees):
        """Crée une session « Prévue » avec ses formateurs et ses apprenants.
        Le nombre d'apprenants n'est pas comparé au nombre de places (pas encore demandé)."""
        if donnees['date_fin'] < donnees['date_debut']:
            raise ErreurMetier('DATES_INVALIDES', 'La date de fin doit être postérieure ou égale à la date de début.')
        if not formateurs:
            raise ErreurMetier('FORMATEUR_REQUIS', 'Une session doit avoir au moins un formateur')
        if not apprenants:
            raise ErreurMetier('APPRENANT_REQUIS', 'Une session doit avoir au moins un apprenant')
        with transaction.atomic():
            session = Session.objects.create(statut=Session.Statut.PREVUE, **donnees)
            session.formateurs.set(formateurs)
            session.apprenants.set(apprenants)
        return session


session_service = SessionService()


@loggable
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
    Erreur « client » (400) : journalisée en avertissement par @loggable."""

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


@loggable
class CompteService:
    """Création du compte d'un organisme de formation (SCRUM-15) et connexion (SCRUM-16). Ni l'e-mail ni le mot de passe ne sont journalisés :
    @loggable ne trace que la méthode, et les messages d'erreur ne reprennent aucune donnée saisie."""

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
