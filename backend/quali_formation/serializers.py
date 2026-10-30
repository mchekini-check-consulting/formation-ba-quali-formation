from typing import ClassVar

from rest_framework import serializers

from quali_formation.models import Formation, Sequence, Session
from quali_formation.services import manquants


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
        return [b.id for b in manquants(formation)]


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
