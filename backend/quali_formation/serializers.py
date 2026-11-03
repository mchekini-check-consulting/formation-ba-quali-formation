from decimal import Decimal
from typing import ClassVar

from rest_framework import serializers

from quali_formation.blocs import blocs_manquants
from quali_formation.models import (
    Apprenant,
    Formateur,
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
    class Meta:
        model = Formateur
        fields = ('id', 'prenom', 'nom', 'email', 'specialites')


class ApprenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Apprenant
        fields = ('id', 'prenom', 'nom', 'email')


class ApprenantCreationSerializer(serializers.Serializer):
    """Écriture (SCRUM-27) : prénom, nom et e-mail obligatoires, e-mail au format valide."""

    prenom = serializers.CharField(max_length=100, error_messages={'blank': 'Indiquez le prénom.', 'required': 'Indiquez le prénom.'})
    nom = serializers.CharField(max_length=100, error_messages={'blank': 'Indiquez le nom.', 'required': 'Indiquez le nom.'})
    email = serializers.EmailField(max_length=255, error_messages={
        'blank': "Indiquez l'e-mail.", 'required': "Indiquez l'e-mail.", 'invalid': "Format d'e-mail invalide"})


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


class SessionCreationSerializer(serializers.Serializer):
    """Écriture : étape 1 (tous les champs obligatoires), formateurs (étape 2) et apprenants (étape 3).
    Les listes vides sont acceptées ici : la règle « au moins un » est dans le service (message dédié)."""

    formation = serializers.PrimaryKeyRelatedField(queryset=Formation.objects.all())
    date_debut = serializers.DateField()
    date_fin = serializers.DateField()
    heure_debut = serializers.TimeField()
    heure_fin = serializers.TimeField()
    duree_heures = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=Decimal('0.01'))
    modalite = serializers.ChoiceField(choices=Session.Modalite.choices)
    lieu = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    lien_classe_virtuelle = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    nombre_places = serializers.IntegerField(min_value=1)
    formateurs = serializers.PrimaryKeyRelatedField(queryset=Formateur.objects.all(), many=True, required=False, default=list)
    apprenants = serializers.PrimaryKeyRelatedField(queryset=Apprenant.objects.all(), many=True, required=False, default=list)

    def validate(self, attrs):
        # Lieu (présentiel) ou lien de classe virtuelle : celui qui correspond à la modalité est obligatoire
        champ = 'lieu' if attrs['modalite'] == Session.Modalite.PRESENTIEL else 'lien_classe_virtuelle'
        attrs[champ] = attrs[champ].strip()
        if not attrs[champ]:
            raise serializers.ValidationError({champ: ['Ce champ est obligatoire.']})
        return attrs
