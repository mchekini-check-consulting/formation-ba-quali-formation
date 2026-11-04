from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.models import Formation, Utilisateur
from quali_formation.serializers import (
    ApprenantSerializer,
    FormateurSerializer,
    FormationEcritureSerializer,
    FormationSerializer,
    ItemSerializer,
    PersonneCreationSerializer,
    SessionCreationSerializer,
    SessionPlanningSerializer,
    SessionSerializer,
)
from quali_formation.services import (
    DonneesInvalides,
    ErreurMetier,
    compte_service,
    formation_service,
    item_service,
    session_service,
)


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


# ---- Sessions et planning (SCRUM-25) ----

@api_view(["GET", "POST"])
def sessions_planning(request):
    """GET : toutes les sessions, par date de début. POST : création d'une session « Prévue »
    (201 ; 400 si une donnée est invalide, sans formateur ou sans apprenant)."""
    if request.method == 'POST':
        entree = SessionCreationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        try:
            session = session_service.creer_session(**entree.validated_data)
        except ErreurMetier as e:
            return _erreur(e)
        session = session_service.lister_sessions().get(pk=session.pk)
        return Response(SessionPlanningSerializer(session).data, status=status.HTTP_201_CREATED)
    return Response(SessionPlanningSerializer(session_service.lister_sessions(), many=True).data)


def _personnes(request, lister, creer, serializer):
    """GET : la liste. POST : création ; 201, ou 400 si un champ manque ou si l'e-mail est invalide."""
    if request.method == 'POST':
        entree = PersonneCreationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        return Response(serializer(creer(**entree.validated_data)).data, status=status.HTTP_201_CREATED)
    return Response(serializer(lister(), many=True).data)


@api_view(["GET", "POST"])
def formateurs(request):
    """Formateurs (création : SCRUM-26)."""
    return _personnes(request, session_service.lister_formateurs, session_service.creer_formateur, FormateurSerializer)


@api_view(["GET", "POST"])
def apprenants(request):
    """Apprenants (création : SCRUM-27)."""
    return _personnes(request, session_service.lister_apprenants, session_service.creer_apprenant, ApprenantSerializer)


# ---- Créer un compte (SCRUM-15) et se connecter (SCRUM-16) ----

def _formulaire_invalide(e):
    """400 : le premier champ en erreur (code, champ, detail) et la liste complète."""
    premiere = e.erreurs[0]
    return Response({'code': premiere['code'], 'champ': premiere['champ'], 'detail': premiere['message'],
                     'erreurs': e.erreurs}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def inscription(request):
    """POST /auth/register {email, mot_de_passe, confirmation, cgu_acceptees} : création du compte.
    201 compte créé (sans le mot de passe) ; 400 donnée invalide (champ + code) ; 409 EMAIL_DEJA_UTILISE."""
    d = request.data
    try:
        utilisateur = compte_service.creer_compte(d.get('email'), d.get('mot_de_passe'), d.get('confirmation'),
                                                  d.get('cgu_acceptees'))
    except DonneesInvalides as e:
        return _formulaire_invalide(e)
    except ErreurMetier as e:
        return Response({'code': e.code, 'champ': 'email', 'detail': e.message}, status=e.statut_http)
    return Response({'id': utilisateur.id, 'email': utilisateur.email,
                     'date_creation': utilisateur.date_creation}, status=status.HTTP_201_CREATED)


# Mémorisation de la connexion : session Django. Le navigateur garde un cookie de session (HttpOnly, illisible
# par le JavaScript) qui ne contient qu'un numéro ; le compte connecté est retenu côté serveur (table django_session).
SESSION_UTILISATEUR = 'utilisateur_id'


def _compte(utilisateur):
    return Response({'id': utilisateur.id, 'email': utilisateur.email})


@api_view(["POST"])
def connexion(request):
    """POST /auth/login {email, mot_de_passe} : 200 connecté ({id, email}) et session ouverte ; 400 champ manquant ;
    401 IDENTIFIANTS_INVALIDES (« E-mail ou mot de passe incorrect », sans dire lequel)."""
    try:
        utilisateur = compte_service.connecter(request.data.get('email'), request.data.get('mot_de_passe'))
    except DonneesInvalides as e:
        return _formulaire_invalide(e)
    except ErreurMetier as e:
        return _erreur(e)
    request.session.cycle_key()  # nouveau numéro de session à chaque connexion
    request.session[SESSION_UTILISATEUR] = utilisateur.id
    return _compte(utilisateur)


@api_view(["GET"])
def moi(request):
    """GET /auth/moi : le compte connecté ({id, email}), ou 401 NON_CONNECTE."""
    utilisateur = Utilisateur.objects.filter(pk=request.session.get(SESSION_UTILISATEUR)).first()
    if utilisateur is None:
        return Response({'code': 'NON_CONNECTE', 'detail': "Vous n'êtes pas connecté."},
                        status=status.HTTP_401_UNAUTHORIZED)
    return _compte(utilisateur)
