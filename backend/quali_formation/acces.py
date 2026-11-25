"""SCRUM-221 : « le formulaire bloque tout l'accès ». Tant que le compte connecté n'a pas enregistré son centre
(organisme vide), le serveur refuse toutes ses demandes, sauf celles du formulaire de première connexion :
lecture du compte, recherche par SIRET, enregistrement du centre, connexion, déconnexion, création de compte.

Chaque refus écrit un log métier « accès bloqué » (layer controller, warn) : identifiant de l'utilisateur, route
demandée (modèle, jamais ses valeurs) et code ACCES_BLOQUE_CENTRE_NON_RENSEIGNE.
"""

import logging
import time

from django.http import JsonResponse

from quali_formation.logging.middleware import DEJA_ECRIT
from quali_formation.models import Utilisateur

logger = logging.getLogger("quali_formation.metier")

SESSION_UTILISATEUR = 'utilisateur_id'  # même clé que views.py
CODE_LOG = 'ACCES_BLOQUE_CENTRE_NON_RENSEIGNE'

# Routes autorisées sans centre (modèles de quali_formation/urls.py et config/urls.py)
ROUTES_SANS_CENTRE = frozenset({
    'auth/register', 'auth/login', 'auth/moi', 'auth/logout',  # compte, connexion, déconnexion
    'organisme/',  # enregistrement du formulaire
    'entreprises/<siret:siret>/',  # recherche par SIRET
    '', 'sante/',  # routes techniques (« Hello World », état de santé), sans données
})


def _autorisee(route):
    return route in ROUTES_SANS_CENTRE or route.startswith('admin/')  # administration Django : son propre accès


class CentreRequisMiddleware:
    """À placer après SessionMiddleware. Agit avant la vue (process_view) : une demande refusée n'atteint jamais
    les données."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request._debut_acces = time.monotonic()
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        route = request.resolver_match.route if request.resolver_match else ''
        identifiant = request.session.get(SESSION_UTILISATEUR)
        if identifiant is None or _autorisee(route):
            return None
        if not Utilisateur.objects.filter(pk=identifiant, organisme__isnull=True).exists():
            return None  # centre renseigné (ou compte supprimé : la vue répondra 401)
        logger.warning(f"{request.method} {route} 403", extra={
            "layer": "controller",
            "httpMethod": request.method,
            "route": route,
            "status": 403,
            "durationMs": round((time.monotonic() - getattr(request, '_debut_acces', time.monotonic())) * 1000),
            "errorCode": CODE_LOG,
            "utilisateur.id": str(identifiant),
        })
        setattr(request, DEJA_ECRIT, True)
        return JsonResponse({'code': 'ORGANISME_A_RENSEIGNER',
                             'detail': 'Renseignez d’abord les informations de votre centre.'}, status=403)
