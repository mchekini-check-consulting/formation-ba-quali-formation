from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.models import Formation
from quali_formation.serializers import (
    FormationEcritureSerializer,
    FormationSerializer,
    ItemSerializer,
    SessionSerializer,
)
from quali_formation.services import ErreurMetier, formation_service, item_service


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


@api_view(["GET"])
def sante(request):
    """Contrôle de vie : le frontend l'appelle pour savoir si l'API répond."""
    return Response({"statut": "ok"})


def _erreur(e):
    return Response({"code": e.code, "detail": e.message, **e.details}, status=e.statut_http)


def _lire(formation):
    return Response(FormationSerializer(formation).data)


def _formations():
    return Formation.objects.prefetch_related('sequences', 'sessions')


def _enregistrer(request, formation):
    entree = FormationEcritureSerializer(data=request.data)
    entree.is_valid(raise_exception=True)
    donnees = dict(entree.validated_data)
    action, forcer = donnees.pop('action'), donnees.pop('forcer')
    donnees['autres_informations'] = [dict(o) for o in donnees['autres_informations']]
    donnees['sequences'] = [dict(s) for s in donnees['sequences']]
    try:
        formation = formation_service.enregistrer(formation, donnees, action, forcer)
    except ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations().get(pk=formation.pk)).data,
                    status=status.HTTP_201_CREATED if request.method == 'POST' else status.HTTP_200_OK)


@api_view(["GET", "POST"])
def formations(request):
    """GET : toutes les formations, de la plus récente à la plus ancienne (RG29). POST : création."""
    if request.method == 'POST':
        return _enregistrer(request, None)
    return Response(FormationSerializer(_formations(), many=True).data)


@api_view(["GET", "PUT"])
def formation(request, pk):
    f = get_object_or_404(_formations(), pk=pk)
    if request.method == 'PUT':
        return _enregistrer(request, f)
    return _lire(f)


def _action(fonction):
    """Vue POST /api/formations/<id>/<action>/ qui applique une règle et renvoie la formation."""
    @api_view(["POST"])
    def vue(request, pk):
        f = get_object_or_404(_formations(), pk=pk)
        try:
            fonction(f, request)
        except ErreurMetier as e:
            return _erreur(e)
        return _lire(_formations().get(pk=pk))
    return vue


publier = _action(lambda f, request: formation_service.publier(f, confirmer=bool(request.data.get('confirmer'))))
retirer_publication = _action(lambda f, request: formation_service.retirer_publication(f))


@api_view(["POST"])
def sessions(request, pk):
    """Ajout d'une session (RG38 : début et fin obligatoires, fin ≥ début)."""
    f = get_object_or_404(Formation, pk=pk)
    entree = SessionSerializer(data=request.data)
    entree.is_valid(raise_exception=True)
    try:
        formation_service.ajouter_session(f, **entree.validated_data)
    except ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations().get(pk=pk)).data, status=status.HTTP_201_CREATED)
