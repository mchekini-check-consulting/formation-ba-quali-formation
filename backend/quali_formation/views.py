from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.serializers import FormationSerializer, ItemSerializer
from quali_formation.services import formation_service, item_service


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


# GET /formations : liste ; POST /formations {nom, description, dureeHeures, dateDebut}
# (nom obligatoire) : création.
# Exposé par la passerelle :
# https://gateway.formation-ba-quali-formation.<env>.check-consulting.net/backend/formations
@api_view(["GET", "POST"])
def formations(request):
    if request.method == "POST":
        serializer = formation_service.create_formation(request.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(FormationSerializer(formation_service.list_formations(), many=True).data)


# GET /formations/<id> : détail ; PUT : modification partielle ; DELETE : suppression.
@api_view(["GET", "PUT", "DELETE"])
def formation_detail(request, formation_id):
    if request.method == "PUT":
        serializer = formation_service.update_formation(formation_id, request.data)
        return Response(serializer.data)
    if request.method == "DELETE":
        formation_service.delete_formation(formation_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(FormationSerializer(formation_service.get_formation(formation_id)).data)
