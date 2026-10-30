from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def sante(request):
    """Contrôle de vie : le frontend l'appelle pour savoir si l'API répond."""
    return Response({"statut": "ok"})
