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

    class Meta:
        model = Formation
        fields = ('id', 'reference', 'version', 'intitule', 'duree_heures', 'modalite', 'statut', 'publication',
                  'organisme', 'preparee_par', 'valeurs', 'autres_informations', 'date_creation', 'date_mise_a_jour',
                  'sequences', 'sessions', 'blocs_manquants')

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
    organisme = serializers.CharField(required=False, default='Cap Compétences')
    preparee_par = serializers.CharField(required=False, default='Camille Laurent')
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
    """Entreprise cliente proposée dans la fenêtre « Nouvel apprenant » (SCRUM-112)."""

    class Meta:
        model = Entreprise
        fields = ('id', 'raison_sociale')


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


class SessionPlanningSerializer(serializers.ModelSerializer):
    """Lecture : une session de la page Sessions et planning."""

    formation_intitule = serializers.CharField(source='formation.intitule', read_only=True)
    nombre_apprenants = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ('id', 'formation', 'formation_intitule', 'date_debut', 'date_fin', 'heure_debut', 'heure_fin',
                  'duree_heures', 'modalite', 'lieu', 'lien_classe_virtuelle', 'nombre_places', 'statut',
                  'formateurs', 'apprenants', 'nombre_apprenants')

    def get_nombre_apprenants(self, session):
        return len(session.apprenants.all())  # apprenants préchargés par la vue


# Champs obligatoires selon la modalité de la session (SCRUM-166)
CHAMPS_MODALITE = {
    Session.Modalite.PRESENTIEL: ('lieu',),
    Session.Modalite.DISTANCIEL: ('lien_classe_virtuelle',),
    Session.Modalite.MIXTE: ('lieu', 'lien_classe_virtuelle'),
}


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
