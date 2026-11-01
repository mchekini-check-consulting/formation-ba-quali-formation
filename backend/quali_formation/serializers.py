from rest_framework import serializers

from quali_formation.models import Item


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
