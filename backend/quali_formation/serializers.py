import re
from decimal import Decimal
from typing import ClassVar

from rest_framework import serializers

from quali_formation.blocs import blocs_manquants
from quali_formation.models import (
    Apprenant,
    Entreprise,
    Formateur,
    FormateurDocument,
    Formation,
    Item,
    Sequence,
    Session,
)


class ItemSerializer(serializers.ModelSerializer):
    # Mêmes noms de champs JSON que les autres backends (id, nom, description, creeLe)
    creeLe = serializers.DateTimeField(source="cree_le", read_only=True)

    class Meta:
        model = Item
        fields = ("id", "nom", "description", "creeLe")

    def validate_nom(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("nom obligatoire")
        return value

    def validate_description(self, value):
        value = (value or "").strip()
        return value or None


class SequenceSerializer(serializers.ModelSerializer):
    """RG18 : titre, durée, objectif, modalité, contenu, méthodes obligatoires ; supports et évaluation facultatifs."""

    duree_heures = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=0)

    class Meta:
        model = Sequence
        fields = ('titre', 'duree_heures', 'objectif_vise', 'modalite', 'contenu', 'methodes_activites', 'supports', 'evaluation')
        extra_kwargs: ClassVar = {'supports': {'required': False}, 'evaluation': {'required': False}}


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ('id', 'date_debut', 'date_fin', 'lieu', 'nombre_places')
        extra_kwargs: ClassVar = {'lieu': {'required': False}, 'nombre_places': {'required': False}}


class AutreInformationSerializer(serializers.Serializer):
    # RG12 : le titre est obligatoire
    titre = serializers.CharField()
    contenu = serializers.CharField(allow_blank=True, required=False, default='')


class FormationSerializer(serializers.ModelSerializer):
    """Lecture : la formation avec son programme, ses sessions et les blocs Qualiopi manquants."""

    sequences = SequenceSerializer(many=True, read_only=True)
    sessions = SessionSerializer(many=True, read_only=True)
    blocs_manquants = serializers.SerializerMethodField()
    # Lus depuis le compte qui a créé la formation (son centre, son prénom et son nom), y compris pour les formations
    # enregistrées avec les anciennes valeurs du prototype ; à défaut de compte, la valeur enregistrée.
    organisme = serializers.SerializerMethodField()
    preparee_par = serializers.SerializerMethodField()

    class Meta:
        model = Formation
        fields = ('id', 'reference', 'version', 'intitule', 'duree_heures', 'modalite', 'statut', 'publication',
                  'organisme', 'preparee_par', 'valeurs', 'autres_informations', 'date_creation', 'date_mise_a_jour',
                  'sequences', 'sessions', 'blocs_manquants')

    def get_organisme(self, formation):
        centre = formation.proprietaire.organisme if formation.proprietaire else None
        return centre.raison_sociale if centre else formation.organisme

    def get_preparee_par(self, formation):
        if formation.proprietaire is None:
            return formation.preparee_par
        return formation.proprietaire.nom_complet

    def get_blocs_manquants(self, formation):
        return [b.id for b in blocs_manquants(formation.valeurs, formation.modalite, formation.sequences.count())]


class FormationEcritureSerializer(serializers.Serializer):
    """Écriture : le contenu du formulaire et l'action demandée (brouillon ou valider)."""

    action = serializers.ChoiceField(choices=['brouillon', 'valider'])
    forcer = serializers.BooleanField(required=False, default=False)  # « Valider quand même » (RG14)
    doublon_accepte = serializers.BooleanField(required=False, default=False)  # même intitulé accepté (SCRUM-20)
    intitule = serializers.CharField(allow_blank=True, max_length=255)
    duree_heures = serializers.DecimalField(max_digits=7, decimal_places=2, allow_null=True, required=False, default=None)
    modalite = serializers.ChoiceField(choices=Formation.Modalite.choices)
    # Organisme et « Préparée par » ne sont pas saisis : ils viennent du compte connecté (FormationService.enregistrer)
    valeurs = serializers.DictField(required=False, default=dict)
    autres_informations = AutreInformationSerializer(many=True, required=False, default=list)
    sequences = SequenceSerializer(many=True, required=False, default=list)


# ---- Sessions et planning (SCRUM-25) ----

class FormateurSerializer(serializers.ModelSerializer):
    """Lecture d'un formateur ; statut, NDA et nombre de sessions : SCRUM-119 (`nombre_sessions` : annotation posée
    quand la liste est lue par le service)."""

    nombre_sessions = serializers.SerializerMethodField()

    class Meta:
        model = Formateur
        fields = ('id', 'prenom', 'nom', 'email', 'specialites', 'entreprise', 'statut', 'numero_nda', 'nombre_sessions')

    def get_nombre_sessions(self, formateur):
        nombre = getattr(formateur, 'nombre_sessions', None)
        return formateur.sessions.count() if nombre is None else nombre


class FormateurDocumentSerializer(serializers.ModelSerializer):
    """Document enregistré d'un formateur (SCRUM-119), sans son contenu."""

    class Meta:
        model = FormateurDocument
        fields = ('id', 'type', 'nom_fichier', 'format', 'taille', 'date_ajout')


class ApprenantSerializer(serializers.ModelSerializer):
    """Lecture d'un apprenant (SCRUM-112). `entreprise` : raison sociale de son entreprise cliente, à défaut l'ancien
    texte libre (SCRUM-166). `nombre_sessions` : présent quand la liste est lue par le service."""

    entreprise = serializers.SerializerMethodField()
    entreprise_id = serializers.IntegerField(source='entreprise_cliente_id', read_only=True, allow_null=True)
    nombre_sessions = serializers.SerializerMethodField()

    class Meta:
        model = Apprenant
        fields = ('id', 'prenom', 'nom', 'email', 'telephone', 'statut', 'entreprise', 'entreprise_id', 'poste',
                  'nombre_sessions')

    def get_entreprise(self, apprenant):
        return apprenant.entreprise_cliente.raison_sociale if apprenant.entreprise_cliente_id else apprenant.entreprise

    def get_nombre_sessions(self, apprenant):
        nombre = getattr(apprenant, 'nombre_sessions', None)
        return apprenant.sessions.count() if nombre is None else nombre


class EntrepriseSerializer(serializers.ModelSerializer):
    """Entreprise cliente du centre : proposée dans la fenêtre « Nouvel apprenant » (SCRUM-112) et affichée dans l'onglet
    Entreprises clientes (SCRUM-120). `interlocuteur` : prénom et nom de l'interlocuteur principal (vide s'il n'y en a
    pas) ; `nombre_salaries` : apprenants du centre rattachés à l'entreprise (annotation posée par le service)."""

    interlocuteur = serializers.SerializerMethodField()
    nombre_salaries = serializers.SerializerMethodField()

    class Meta:
        model = Entreprise
        fields = ('id', 'raison_sociale', 'siret', 'ville', 'opco', 'interlocuteur', 'nombre_salaries')  # liste SCRUM-120

    def get_interlocuteur(self, entreprise):
        return f'{entreprise.interlocuteur_prenom} {entreprise.interlocuteur_nom}'.strip()

    def get_nombre_salaries(self, entreprise):
        nombre = getattr(entreprise, 'nombre_salaries', None)
        return entreprise.apprenants.filter(organisme_id=entreprise.organisme_id).count() if nombre is None else nombre


class PersonneCreationSerializer(serializers.Serializer):
    """Écriture d'un formateur (SCRUM-26) ou d'un apprenant (SCRUM-27) :
    prénom, nom et e-mail obligatoires, e-mail au format valide."""

    prenom = serializers.CharField(max_length=100, error_messages={'blank': 'Indiquez le prénom.', 'required': 'Indiquez le prénom.'})
    nom = serializers.CharField(max_length=100, error_messages={'blank': 'Indiquez le nom.', 'required': 'Indiquez le nom.'})
    email = serializers.EmailField(max_length=255, error_messages={
        'blank': "Indiquez l'e-mail.", 'required': "Indiquez l'e-mail.", 'invalid': "Format d'e-mail invalide"})
    # SCRUM-166 : facultative, vide = « Individuel »
    entreprise = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


MSG_TELEPHONE = 'Le téléphone doit contenir 10 chiffres'
MSG_STATUT = 'Le statut est obligatoire'


class ApprenantCreationSerializer(PersonneCreationSerializer):
    """Écriture d'un apprenant (SCRUM-27, complétée par SCRUM-112) : téléphone facultatif (10 chiffres, espaces,
    points et tirets ignorés), statut obligatoire, entreprise cliente et poste facultatifs."""

    telephone = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    statut = serializers.ChoiceField(choices=Apprenant.Statut.choices, error_messages={
        'required': MSG_STATUT, 'blank': MSG_STATUT, 'null': MSG_STATUT, 'invalid_choice': MSG_STATUT})
    entreprise_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    poste = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate_telephone(self, telephone):
        chiffres = re.sub(r'[\s.-]', '', telephone)
        if chiffres and not re.fullmatch(r'\d{10}', chiffres):
            raise serializers.ValidationError(MSG_TELEPHONE)
        return chiffres


MSG_NDA = 'Le NDA doit contenir 11 chiffres'


class FormateurCreationSerializer(PersonneCreationSerializer):
    """Écriture d'un formateur (SCRUM-26, complétée par SCRUM-119) : statut et NDA facultatifs ; le NDA, s'il est
    renseigné, a 11 chiffres (espaces ignorés)."""

    statut = serializers.ChoiceField(choices=Formateur.Statut.choices, required=False, allow_blank=True, default='')
    numero_nda = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')

    def validate_numero_nda(self, numero_nda):
        chiffres = re.sub(r'\s', '', numero_nda)
        if chiffres and not re.fullmatch(r'\d{11}', chiffres):
            raise serializers.ValidationError(MSG_NDA)
        return chiffres


MSG_OBLIGATOIRE = 'Champ obligatoire'
MSG_SIRET = 'Le SIRET doit contenir 14 chiffres'
MSG_EMAIL = "Format d'e-mail invalide"


def _obligatoire(longueur):
    return serializers.CharField(max_length=longueur, error_messages={
        'required': MSG_OBLIGATOIRE, 'blank': MSG_OBLIGATOIRE, 'null': MSG_OBLIGATOIRE})


def _facultatif(longueur):
    return serializers.CharField(max_length=longueur, required=False, allow_blank=True, default='')


def _email_facultatif():
    return serializers.EmailField(max_length=255, required=False, allow_blank=True, default='',
                                  error_messages={'invalid': MSG_EMAIL})


class EntrepriseCreationSerializer(serializers.Serializer):
    """SCRUM-113 : écriture d'une entreprise cliente. Obligatoires : raison sociale, SIRET (14 chiffres, espaces
    ignorés), adresse, code postal, ville, et l'adresse de facturation si elle n'est pas identique. Facultatifs : forme
    juridique, code NAF, e-mail de l'entreprise, interlocuteur principal (e-mail valide, téléphone à 10 chiffres)."""

    raison_sociale = _obligatoire(255)
    siret = _obligatoire(30)
    forme_juridique = _facultatif(100)
    code_naf = _facultatif(10)
    adresse = _obligatoire(255)
    code_postal = _obligatoire(10)
    ville = _obligatoire(255)
    adresse_facturation_identique = serializers.BooleanField(required=False, default=True)
    adresse_facturation = _facultatif(255)
    email = _email_facultatif()
    interlocuteur_prenom = _facultatif(100)
    interlocuteur_nom = _facultatif(100)
    interlocuteur_role = serializers.ChoiceField(choices=Entreprise.Role.choices, required=False, allow_blank=True, default='')
    interlocuteur_email = _email_facultatif()
    interlocuteur_telephone = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')

    def validate_siret(self, siret):
        chiffres = re.sub(r'\s', '', siret)
        if not re.fullmatch(r'\d{14}', chiffres):
            raise serializers.ValidationError(MSG_SIRET)
        return chiffres

    def validate_interlocuteur_telephone(self, telephone):
        chiffres = re.sub(r'[\s.-]', '', telephone)
        if chiffres and not re.fullmatch(r'\d{10}', chiffres):
            raise serializers.ValidationError(MSG_TELEPHONE)
        return chiffres

    def validate(self, attrs):
        identique = attrs.pop('adresse_facturation_identique')
        if identique:
            attrs['adresse_facturation'] = ''
        elif not attrs['adresse_facturation'].strip():
            raise serializers.ValidationError({'adresse_facturation': [MSG_OBLIGATOIRE]})
        return attrs


class SessionPlanningSerializer(serializers.ModelSerializer):
    """Lecture : une session de la page Sessions et planning (liste par onglets : SCRUM-167).

    Le classement par onglet (en cours, à venir, passées) se fait à l'écran, à partir des dates."""

    formation_intitule = serializers.CharField(source='formation.intitule', read_only=True)
    nombre_apprenants = serializers.SerializerMethodField()
    # SCRUM-167 : colonne « Formateur » de la liste (prénom et nom, triés par nom)
    formateurs_noms = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ('id', 'formation', 'formation_intitule', 'date_debut', 'date_fin', 'heure_debut', 'heure_fin',
                  'duree_heures', 'modalite', 'lieu', 'lien_classe_virtuelle', 'nombre_places', 'statut',
                  'formateurs', 'formateurs_noms', 'apprenants', 'nombre_apprenants')

    def get_nombre_apprenants(self, session):
        return len(session.apprenants.all())  # apprenants préchargés par la vue

    def get_formateurs_noms(self, session):
        formateurs = sorted(session.formateurs.all(), key=lambda f: (f.nom.lower(), f.prenom.lower(), f.pk))
        return [{'id': f.pk, 'prenom': f.prenom, 'nom': f.nom} for f in formateurs]  # formateurs préchargés


# Champs obligatoires selon la modalité de la session (SCRUM-166)
CHAMPS_MODALITE = {
    Session.Modalite.PRESENTIEL: ('lieu',),
    Session.Modalite.DISTANCIEL: ('lien_classe_virtuelle',),
    Session.Modalite.MIXTE: ('lieu', 'lien_classe_virtuelle'),
}


class ApprenantInscritSerializer(serializers.ModelSerializer):
    """SCRUM-179 : un apprenant inscrit à une session (onglet Apprenants). `entreprise` : raison sociale de son
    entreprise cliente, à défaut l'ancien texte libre ; vide = « Individuel »."""

    entreprise = serializers.SerializerMethodField()

    class Meta:
        model = Apprenant
        fields = ('id', 'prenom', 'nom', 'email', 'statut', 'entreprise', 'poste')

    def get_entreprise(self, apprenant):
        return apprenant.entreprise_cliente.raison_sociale if apprenant.entreprise_cliente_id else apprenant.entreprise


class AjoutApprenantsSerializer(serializers.Serializer):
    """SCRUM-179 : POST /sessions/<id>/apprenants/ -> {"apprenants": [identifiants]} (au moins un)."""

    apprenants = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class SessionCreationSerializer(serializers.Serializer):
    """Écriture : étape 1 (tous les champs obligatoires, plus d'heures depuis SCRUM-166), formateurs (étape 2)
    et apprenants (étape 3).
    Les listes vides sont acceptées ici : la règle « au moins un » est dans le service (message dédié)."""

    formation = serializers.PrimaryKeyRelatedField(queryset=Formation.objects.all())
    date_debut = serializers.DateField()
    date_fin = serializers.DateField()
    duree_heures = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=Decimal('0.01'))
    modalite = serializers.ChoiceField(choices=Session.Modalite.choices)
    lieu = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    lien_classe_virtuelle = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    nombre_places = serializers.IntegerField(min_value=1)
    formateurs = serializers.PrimaryKeyRelatedField(queryset=Formateur.objects.all(), many=True, required=False, default=list)
    apprenants = serializers.PrimaryKeyRelatedField(queryset=Apprenant.objects.all(), many=True, required=False, default=list)

    def validate(self, attrs):
        # SCRUM-166 : présentiel -> lieu ; distanciel -> lien de classe virtuelle ; mixte -> les deux
        erreurs = {}
        for champ in CHAMPS_MODALITE[attrs['modalite']]:
            attrs[champ] = attrs[champ].strip()
            if not attrs[champ]:
                erreurs[champ] = ['Ce champ est obligatoire.']
        if erreurs:
            raise serializers.ValidationError(erreurs)
        return attrs
