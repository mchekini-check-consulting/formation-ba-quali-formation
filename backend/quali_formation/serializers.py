from rest_framework import serializers

from quali_formation.models import Formation, Item


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


class FormationSerializer(serializers.ModelSerializer):
    dureeHeures = serializers.IntegerField(source="duree_heures", required=False, allow_null=True)
    dateDebut = serializers.DateField(source="date_debut", required=False, allow_null=True)
    creeLe = serializers.DateTimeField(source="cree_le", read_only=True)

    class Meta:
        model = Formation
        fields = ("id", "nom", "description", "dureeHeures", "dateDebut", "creeLe")

    def validate_nom(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("nom obligatoire")
        return value

    def validate_description(self, value):
        value = (value or "").strip()
        return value or None
