from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.serializers import ItemSerializer
from quali_formation.services import item_service


@api_view(["GET"])
def hello(request):
    return Response("Hello, World!")


# GET /items : liste ; POST /items {nom, description} : création (nom obligatoire).
# Exposé par la passerelle :
# https://gateway.formation-ba-quali-formation.<env>.check-consulting.net/backend/items
@api_view(["GET", "POST"])
def items(request):
    if request.method == "POST":
        serializer = item_service.create_item(request.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(ItemSerializer(item_service.list_items(), many=True).data)
