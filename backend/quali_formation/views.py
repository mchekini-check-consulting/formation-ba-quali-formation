from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation import services
from quali_formation.models import Formation
from quali_formation.serializers import (
    FormationEcritureSerializer,
    FormationSerializer,
    SessionSerializer,
)


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
        formation = services.enregistrer(formation, donnees, action, forcer)
    except services.ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations().get(pk=formation.pk)).data,
                    status=status.HTTP_201_CREATED if request.method == 'POST' else status.HTTP_200_OK)


@api_view(["GET", "POST"])
def formations(request):
    """GET : toutes les formations, de la plus récente à la plus ancienne (RG29). POST : création."""
    if request.method == 'POST':
        return _enregistrer(request, None)
    return Response(FormationSerializer(_formations(), many=True).data)


@api_view(["GET", "PUT", "DELETE"])
def formation(request, pk):
    f = get_object_or_404(_formations(), pk=pk)
    if request.method == 'PUT':
        return _enregistrer(request, f)
    if request.method == 'DELETE':
        try:
            services.supprimer(f, request.query_params.get('confirmation'))
        except services.ErreurMetier as e:
            return _erreur(e)
        return Response(status=status.HTTP_204_NO_CONTENT)
    return _lire(f)


def _action(fonction):
    """Vue POST /api/formations/<id>/<action>/ qui applique une règle et renvoie la formation."""
    @api_view(["POST"])
    def vue(request, pk):
        f = get_object_or_404(_formations(), pk=pk)
        try:
            fonction(f, request)
        except services.ErreurMetier as e:
            return _erreur(e)
        return _lire(_formations().get(pk=pk))
    return vue


publier = _action(lambda f, request: services.publier(f, confirmer=bool(request.data.get('confirmer'))))
retirer_publication = _action(lambda f, request: services.retirer_publication(f))
archiver = _action(lambda f, request: services.archiver(f))
restaurer = _action(lambda f, request: services.restaurer(f))


@api_view(["POST"])
def sessions(request, pk):
    """Ajout d'une session (RG38 : début et fin obligatoires, fin ≥ début)."""
    f = get_object_or_404(Formation, pk=pk)
    entree = SessionSerializer(data=request.data)
    entree.is_valid(raise_exception=True)
    try:
        services.ajouter_session(f, **entree.validated_data)
    except services.ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations().get(pk=pk)).data, status=status.HTTP_201_CREATED)
