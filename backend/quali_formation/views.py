from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.models import Item
from quali_formation.serializers import ItemSerializer


@api_view(["GET"])
def hello(request):
    return Response("Hello, World!")


# GET /items : liste ; POST /items {nom, description} : création (nom obligatoire).
# Exposé par la passerelle :
# https://api.<env>.check-consulting.net/formation-ba-quali-formation/backend/items
@api_view(["GET", "POST"])
def items(request):
    if request.method == "POST":
        serializer = ItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(ItemSerializer(Item.objects.all(), many=True).data)
