from quali_formation.logging.loggable import loggable
from quali_formation.models import Item
from quali_formation.serializers import ItemSerializer


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
