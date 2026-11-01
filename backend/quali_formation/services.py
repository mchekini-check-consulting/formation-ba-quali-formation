from rest_framework.exceptions import NotFound

from quali_formation.logging.loggable import loggable
from quali_formation.models import Formation, Item
from quali_formation.serializers import FormationSerializer, ItemSerializer


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


@loggable
class FormationService:
    def list_formations(self):
        return Formation.objects.all()

    def get_formation(self, formation_id):
        return self._find(formation_id)

    def create_formation(self, data):
        serializer = FormationSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return serializer

    def update_formation(self, formation_id, data):
        formation = self._find(formation_id)
        serializer = FormationSerializer(formation, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return serializer

    def delete_formation(self, formation_id):
        formation = self._find(formation_id)
        formation.delete()

    def _find(self, formation_id):
        try:
            return Formation.objects.get(pk=formation_id)
        except Formation.DoesNotExist:
            raise NotFound("formation introuvable")


formation_service = FormationService()
