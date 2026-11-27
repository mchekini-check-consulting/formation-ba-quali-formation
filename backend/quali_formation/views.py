from functools import wraps
from pathlib import Path

from django.http import HttpResponse
from django.utils.http import content_disposition_header
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from quali_formation.entreprises import (
    RechercheTropCourte,
    ServiceEntreprisesIndisponible,
    SiretInvalide,
    recherche_entreprises,
)
from quali_formation.logging.log_metier import log_metier
from quali_formation.logging.middleware import DEJA_ECRIT
from quali_formation.models import Utilisateur
from quali_formation.serializers import (
    ApprenantCreationSerializer,
    ApprenantSerializer,
    EntrepriseCreationSerializer,
    EntrepriseSerializer,
    FormateurCreationSerializer,
    FormateurDocumentSerializer,
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
    FormationIntrouvable,
    compte_service,
    formation_service,
    formations_visibles,
    item_service,
    modele_service,
    organisme_service,
    session_service,
    variable_service,
)
from quali_formation.word_export import DOCX_MIME


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


def _formations(utilisateur):
    # Seulement les formations du compte connecté
    return formations_visibles(utilisateur).prefetch_related('sequences', 'sessions')


def _trouver(utilisateur, pk):
    # 404 « Formation introuvable » aussi pour la formation d'un autre compte : on ne dit pas qu'elle existe
    formation = _formations(utilisateur).filter(pk=pk).first()
    if formation is None:
        raise FormationIntrouvable()
    return formation


def _utilisateur_connecte(request):
    # Compte de la session (SCRUM-16) ; None si personne n'est connecté
    return Utilisateur.objects.select_related('organisme').filter(pk=request.session.get(SESSION_UTILISATEUR)).first()


def _non_connecte():
    return Response({'code': 'NON_CONNECTE', 'detail': "Vous n'êtes pas connecté."},
                    status=status.HTTP_401_UNAUTHORIZED)


def _non_renseigne():
    return Response({'code': 'ORGANISME_A_RENSEIGNER', 'detail': 'Renseignez d’abord les informations de votre centre.'},
                    status=status.HTTP_403_FORBIDDEN)


def _connexion_requise(vue):
    """Vue réservée à un compte connecté : 401 NON_CONNECTE sinon ; le compte est passé à la vue après `request`."""
    @wraps(vue)
    def avec_compte(request, *args, **kwargs):
        utilisateur = _utilisateur_connecte(request)
        if utilisateur is None:
            return _non_connecte()
        return vue(request, utilisateur, *args, **kwargs)
    return avec_compte


def _enregistrer(request, utilisateur, formation):
    if utilisateur.organisme_id is None:  # SCRUM-221 : centre pas encore renseigné
        return _non_renseigne()
    entree = FormationEcritureSerializer(data=request.data)
    entree.is_valid(raise_exception=True)
    donnees = dict(entree.validated_data)
    action, forcer, doublon_accepte = donnees.pop('action'), donnees.pop('forcer'), donnees.pop('doublon_accepte')
    donnees['autres_informations'] = [dict(o) for o in donnees['autres_informations']]
    donnees['sequences'] = [dict(s) for s in donnees['sequences']]
    try:
        formation = formation_service.enregistrer(formation, donnees, action, forcer, doublon_accepte, utilisateur)
    except ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations(utilisateur).get(pk=formation.pk)).data,
                    status=status.HTTP_201_CREATED if request.method == 'POST' else status.HTTP_200_OK)


# Formations : réservées au compte connecté (401 sinon), qui ne voit et ne modifie que les siennes (404 sinon)

@api_view(["GET", "POST"])
@log_metier("controller", champs=["request.data.action", "resultat.statut"])
@_connexion_requise
def formations(request, utilisateur):
    """GET : les formations du compte, de la plus récente à la plus ancienne (RG29). POST : création."""
    if request.method == 'POST':
        return _enregistrer(request, utilisateur, None)
    return Response(FormationSerializer(_formations(utilisateur), many=True).data)


@api_view(["GET", "PUT", "DELETE"])
@log_metier("controller", champs=["pk", "request.data.action", "resultat.statut"])
@_connexion_requise
def formation(request, utilisateur, pk):
    """GET : la formation ; PUT : modification (200/400/404) ; DELETE : suppression (204, 409 si elle a des sessions)."""
    try:
        f = _trouver(utilisateur, pk)
        if request.method == 'PUT':
            return _enregistrer(request, utilisateur, f)
        if request.method == 'DELETE':
            formation_service.supprimer(f, utilisateur)
            return Response(status=status.HTTP_204_NO_CONTENT)
    except ErreurMetier as e:
        return _erreur(e)
    return _lire(f)


def _action(fonction, methode='POST'):
    """Vue POST (ou PATCH) /api/formations/<id>/<action>/ qui applique une règle et renvoie la formation."""
    @api_view([methode])
    @log_metier("controller", champs=["pk", "resultat.publication"])
    @_connexion_requise
    def vue(request, utilisateur, pk):
        try:
            fonction(_trouver(utilisateur, pk), request, utilisateur)
        except ErreurMetier as e:
            return _erreur(e)
        return _lire(_formations(utilisateur).get(pk=pk))
    return vue


publier = _action(lambda f, request, u: formation_service.publier(f, confirmer=bool(request.data.get('confirmer'))))
retirer_publication = _action(lambda f, request, u: formation_service.retirer_publication(f))
# SCRUM-23 : PATCH /formations/<id>/archiver/ et /restaurer/ (200)
archiver = _action(lambda f, request, u: formation_service.archiver(f, u), 'PATCH')
restaurer = _action(lambda f, request, u: formation_service.restaurer(f, u), 'PATCH')


@api_view(["POST"])
@log_metier("controller", champs=["pk"])
@_connexion_requise
def sessions(request, utilisateur, pk):
    """Ajout d'une session (RG38 : début et fin obligatoires, fin ≥ début)."""
    entree = SessionSerializer(data=request.data)
    try:
        f = _trouver(utilisateur, pk)
        entree.is_valid(raise_exception=True)
        formation_service.ajouter_session(f, **entree.validated_data)
    except ErreurMetier as e:
        return _erreur(e)
    return Response(FormationSerializer(_formations(utilisateur).get(pk=pk)).data, status=status.HTTP_201_CREATED)


# ---- Sessions et planning (SCRUM-25) ----

@api_view(["GET", "POST"])
@log_metier("controller", champs=["request.data.modalite", "request.data.nombre_places", "request.data.apprenants.taille"])
@_connexion_requise
def sessions_planning(request, utilisateur):
    """GET : toutes les sessions, par date de début. POST : création d'une session « Prévue »
    (201 ; 400 si une donnée est invalide, sans formateur ou sans apprenant)."""
    if request.method == 'POST':
        entree = SessionCreationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        try:
            session = session_service.creer_session(utilisateur, **entree.validated_data)
        except ErreurMetier as e:
            return _erreur(e)
        session = session_service.lister_sessions(utilisateur).get(pk=session.pk)
        return Response(SessionPlanningSerializer(session).data, status=status.HTTP_201_CREATED)
    return Response(SessionPlanningSerializer(session_service.lister_sessions(utilisateur), many=True).data)


def _personnes(request, utilisateur, lister, creer, serializer, creation=PersonneCreationSerializer, **filtres):
    """GET : les personnes du centre (SCRUM-221). POST : création dans le centre ; 201, 400 si un champ manque
    ou si l'e-mail est invalide, 403 ORGANISME_A_RENSEIGNER si le centre n'est pas encore renseigné."""
    if request.method == 'POST':
        entree = creation(data=request.data)
        entree.is_valid(raise_exception=True)
        try:
            personne = creer(utilisateur, **entree.validated_data)
        except ErreurMetier as e:
            return _erreur(e)
        return Response(serializer(personne).data, status=status.HTTP_201_CREATED)
    return Response(serializer(lister(utilisateur, **filtres), many=True).data)


@api_view(["GET", "POST"])
@log_metier("controller", champs=["resultat.id"])
@_connexion_requise
def formateurs(request, utilisateur):
    """Formateurs du centre (création : SCRUM-26 ; liste, recherche ?recherche=, statut et NDA : SCRUM-119) ;
    401 NON_CONNECTE."""
    filtres = {'recherche': request.query_params.get('recherche', '')} if request.method == 'GET' else {}
    return _personnes(request, utilisateur, session_service.lister_formateurs, session_service.creer_formateur,
                      FormateurSerializer, FormateurCreationSerializer, **filtres)


@api_view(["POST"])
@_connexion_requise
def formateur_documents(request, utilisateur, pk):
    """SCRUM-119 : POST /formateurs/<id>/documents/ (multipart : « fichier » et « type » CV ou DIPLOME), un fichier par
    appel -> 201 le document enregistré (sans son contenu) ; 400 (format, taille, nombre), 401, 404. Pas de log
    métier pour l'instant (à décider par la BA)."""
    try:
        document = session_service.ajouter_document(utilisateur, pk, request.data.get('type', ''),
                                                    request.FILES.get('fichier'))
    except ErreurMetier as e:
        return _erreur(e)
    return Response(FormateurDocumentSerializer(document).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@log_metier("controller", champs=["resultat.id"])
@_connexion_requise
def apprenants(request, utilisateur):
    """Apprenants du centre (création : SCRUM-27 ; liste, recherche ?recherche=, téléphone, statut, entreprise et
    poste : SCRUM-112) ; 401 NON_CONNECTE."""
    filtres = {'recherche': request.query_params.get('recherche', '')} if request.method == 'GET' else {}
    return _personnes(request, utilisateur, session_service.lister_apprenants, session_service.creer_apprenant,
                      ApprenantSerializer, ApprenantCreationSerializer, **filtres)


@api_view(["GET", "POST"])
@_connexion_requise
def entreprises(request, utilisateur):
    """Entreprises clientes du centre (SCRUM-112 : liste « Entreprise » de « Nouvel apprenant » ; SCRUM-120 : onglet
    Entreprises clientes, recherche ?recherche=, nombre de salariés) ; 401 NON_CONNECTE.
    POST (SCRUM-113) : création ; 201, 400 champ manquant ou format invalide, 409 SIRET_DEJA_ENREGISTRE (ce centre)."""
    if request.method == 'POST':
        entree = EntrepriseCreationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        try:
            entreprise = session_service.creer_entreprise(utilisateur, **entree.validated_data)
        except ErreurMetier as e:
            return _erreur(e)
        return Response(EntrepriseSerializer(entreprise).data, status=status.HTTP_201_CREATED)
    entreprises = session_service.lister_entreprises(utilisateur, request.query_params.get('recherche', ''))
    return Response(EntrepriseSerializer(entreprises, many=True).data)


@api_view(["GET"])
@_connexion_requise
def annuaire_entreprises(request, utilisateur):
    """SCRUM-113 : GET /annuaire-entreprises/?recherche= → jusqu'à 10 établissements de l'annuaire officiel (raison
    sociale, SIRET, forme juridique, code NAF, adresse, code postal, ville) ; [] si rien n'est trouvé. 400
    RECHERCHE_TROP_COURTE (moins de 3 caractères) ; 503 SERVICE_INDISPONIBLE ; 401. Log métier écrit par le service."""
    try:
        resultat = recherche_entreprises.chercher(request.query_params.get('recherche', ''), utilisateur)
    except RechercheTropCourte:
        return Response({'code': 'RECHERCHE_TROP_COURTE', 'detail': 'Saisissez au moins 3 caractères.'},
                        status=status.HTTP_400_BAD_REQUEST)
    except ServiceEntreprisesIndisponible:
        setattr(request._request, DEJA_ECRIT, True)  # panne déjà journalisée par le service
        return Response({'code': 'SERVICE_INDISPONIBLE', 'detail': 'La recherche d’entreprises ne répond pas.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(resultat['etablissements'])


# ---- Informations du centre à la première connexion (SCRUM-221) ----

@api_view(["POST"])
@log_metier("controller", champs=["resultat.id"])
@_connexion_requise
def organisme(request, utilisateur):
    """POST /organisme/ {siret, raison_sociale, adresse, prenom, nom, …} : crée le centre et fait du compte connecté
    son gestionnaire, en une seule opération. 201 : le compte connecté (comme GET /auth/moi) ; 400 champs invalides
    (liste « erreurs ») ; 401 NON_CONNECTE ; 409 ORGANISME_DEJA_RENSEIGNE."""
    try:
        organisme_service.enregistrer(utilisateur, request.data)
    except DonneesInvalides as e:
        return _formulaire_invalide(e)
    except ErreurMetier as e:
        return _erreur(e)
    return Response(_donnees_compte(utilisateur), status=status.HTTP_201_CREATED)



@api_view(["GET"])
@_connexion_requise
def entreprise(request, utilisateur, siret):
    """GET /entreprises/<siret>/ : raison sociale et adresse d'un établissement, d'après l'API publique Recherche
    d'entreprises. Service partagé (SCRUM-221, SCRUM-113) ; log métier écrit par le service (entreprises.py).
    200 {siret, raison_sociale, adresse} ; 400 SIRET_INVALIDE ; 404 ENTREPRISE_INTROUVABLE ; 503 SERVICE_INDISPONIBLE ;
    401 NON_CONNECTE."""
    try:
        resultat = recherche_entreprises.rechercher(siret, utilisateur)
    except SiretInvalide:
        return Response({'code': 'SIRET_INVALIDE', 'detail': 'Le SIRET doit contenir 14 chiffres'},
                        status=status.HTTP_400_BAD_REQUEST)
    except ServiceEntreprisesIndisponible:
        # Panne déjà journalisée par le service (avec son code) : pas de deuxième ligne d'erreur (middleware.py)
        setattr(request._request, DEJA_ECRIT, True)
        return Response({'code': 'SERVICE_INDISPONIBLE', 'detail': 'La recherche d’entreprises ne répond pas.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if resultat['entreprise'] is None:
        return Response({'code': 'ENTREPRISE_INTROUVABLE', 'detail': 'Aucune entreprise trouvée pour ce SIRET.'},
                        status=status.HTTP_404_NOT_FOUND)
    return Response(resultat['entreprise'])

# ---- Modèles (épic SCRUM-125) ----

@api_view(["GET"])
@log_metier("controller", champs=["resultat.nb_formations"])
@_connexion_requise
def modeles_resume(request, utilisateur):
    """SCRUM-210 : GET /modeles/resume -> {nb_modeles, nb_formations} du compte connecté ; 401 NON_CONNECTE."""
    return Response(modele_service.resume(utilisateur))


@api_view(["GET"])
@_connexion_requise
def modeles(request, utilisateur):
    """SCRUM-211/212 : GET /modeles/ -> {modeles: les 4 modèles génériques du compte (type, nom, statut, contenu,
    date_maj, variables)} ; 401. Simple lecture : pas de log métier."""
    return Response(modele_service.lister(utilisateur))


@api_view(["GET", "PUT"])
def modele(request, type_modele):
    """GET : ouvrir un modèle (SCRUM-211) ; PUT : l'enregistrer depuis l'éditeur (SCRUM-213)."""
    if request.method == 'PUT':
        return _modifier_modele(request, type_modele=type_modele)
    return _ouvrir_modele(request, type_modele=type_modele)


@log_metier("controller", champs=["type_modele", "resultat.statut"])
@_connexion_requise
def _ouvrir_modele(request, utilisateur, type_modele):
    """GET /modeles/<type> -> le modèle du compte et les libellés de ses variables ; 401, 404."""
    try:
        return Response(modele_service.obtenir(utilisateur, type_modele))
    except ErreurMetier as e:
        return _erreur(e)


@_connexion_requise
def _modifier_modele(request, utilisateur, type_modele):
    """PUT /modeles/<type> {contenu} -> le modèle enregistré (PERSONNALISE) et nb_formations_utilisant /
    nb_formations (RG6) ; 400 CONTENU_INVALIDE, 401, 404. Journalisé par le service (jamais le contenu)."""
    donnees = request.data if isinstance(request.data, dict) else {}
    try:
        return Response(modele_service.modifier(utilisateur, type_modele, donnees.get('contenu'),
                                                donnees.get('nom_fichier_importe')))
    except ErreurMetier as e:
        return _erreur(e)


@api_view(["POST"])
@_connexion_requise
def importer_modele(request, utilisateur, type_modele):
    """SCRUM-215 : POST /modeles/<type>/import (multipart, champ « fichier ») -> {contenu, nom_fichier} : le .docx
    converti pour l'éditeur, rien n'est enregistré (RG8) ; 400 FORMAT_INVALIDE / FICHIER_TROP_VOLUMINEUX /
    FICHIER_ILLISIBLE, 401, 404. Journalisé par le service (sans le nom du fichier)."""
    fichier = request.FILES.get('fichier')
    nom = fichier.name if fichier is not None else ''
    taille = fichier.size if fichier is not None else 0
    try:
        resultat = modele_service.importer_word(utilisateur, type_modele, fichier, Path(nom).suffix.lower(), taille)
    except ErreurMetier as e:
        return _erreur(e)
    return Response({**resultat, 'nom_fichier': nom[:255]})


def fichier_word_reponse(resultat):
    """Le .docx à télécharger ; nom avec accents gardés (filename* en UTF-8). Réutilisable (SCRUM-219)."""
    reponse = HttpResponse(resultat['fichier'], content_type=DOCX_MIME)
    reponse['Content-Disposition'] = content_disposition_header(True, resultat['nom_fichier'])
    return reponse


@api_view(["GET"])
@_connexion_requise
def exporter_modele(request, utilisateur, type_modele):
    """SCRUM-216 : GET /modeles/<type>/export.docx -> « Modèle - <nom>.docx » ; 401, 404. Pas de log métier,
    sauf une ligne ERROR si le fichier n'a pas pu être créé (service)."""
    try:
        return fichier_word_reponse(modele_service.exporter_word(utilisateur, type_modele))
    except ErreurMetier as e:
        return _erreur(e)


@api_view(["GET"])
@_connexion_requise
def modele_origine(request, utilisateur, type_modele):
    """SCRUM-217 : GET /modeles/<type>/origine -> le modèle d'origine en lecture seule (contenu, variables) ;
    401, 404. Simple lecture : pas de log métier."""
    try:
        return Response(modele_service.origine(type_modele))
    except ErreurMetier as e:
        return _erreur(e)


@api_view(["POST"])
@_connexion_requise
def retablir_modele(request, utilisateur, type_modele):
    """SCRUM-217 : POST /modeles/<type>/reinitialiser -> le modèle rétabli (statut ORIGINE) ; 401, 404.
    Journalisé par le service (« Modèle générique rétabli »)."""
    try:
        return Response(modele_service.retablir(utilisateur, type_modele))
    except ErreurMetier as e:
        return _erreur(e)


@api_view(["GET"])
@_connexion_requise
def variables(request, utilisateur):
    """SCRUM-214 : GET /variables/ -> [{code, libelle, categorie, exemple}] triées selon RG10 ; 401.
    Simple lecture : pas de log métier."""
    return Response(variable_service.lister())


# ---- Créer un compte (SCRUM-15) et se connecter (SCRUM-16) ----

def _formulaire_invalide(e):
    """400 : le premier champ en erreur (code, champ, detail) et la liste complète."""
    premiere = e.erreurs[0]
    return Response({'code': premiere['code'], 'champ': premiere['champ'], 'detail': premiere['message'],
                     'erreurs': e.erreurs}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@log_metier("controller", champs=["resultat.id"])
def inscription(request):
    """POST /auth/register {email, mot_de_passe, confirmation, cgu_acceptees} : création du compte.
    201 compte créé (sans le mot de passe) et connecté : la session d'un compte déjà connecté dans ce navigateur
    est remplacée ; 400 donnée invalide (champ + code) ; 409 EMAIL_DEJA_UTILISE."""
    d = request.data
    try:
        utilisateur = compte_service.creer_compte(d.get('email'), d.get('mot_de_passe'), d.get('confirmation'),
                                                  d.get('cgu_acceptees'))
    except DonneesInvalides as e:
        return _formulaire_invalide(e)
    except ErreurMetier as e:
        return Response({'code': e.code, 'champ': 'email', 'detail': e.message}, status=e.statut_http)
    _ouvrir_session(request, utilisateur)
    return Response({'id': utilisateur.id, 'email': utilisateur.email,
                     'date_creation': utilisateur.date_creation}, status=status.HTTP_201_CREATED)


# Mémorisation de la connexion : session Django. Le navigateur garde un cookie de session (HttpOnly, illisible
# par le JavaScript) qui ne contient qu'un numéro ; le compte connecté est retenu côté serveur (table django_session).
SESSION_UTILISATEUR = 'utilisateur_id'


def _ouvrir_session(request, utilisateur):
    # Nouveau numéro de session à chaque connexion ou création de compte : rien n'est repris du compte précédent
    request.session.cycle_key()
    request.session[SESSION_UTILISATEUR] = utilisateur.id


def _donnees_compte(utilisateur):
    """Le compte connecté ; SCRUM-221 : prénom, nom, rôle et centre (null tant que le formulaire de première
    connexion n'est pas enregistré : l'écran affiche alors ce formulaire)."""
    centre = utilisateur.organisme
    return {'id': utilisateur.id, 'email': utilisateur.email, 'prenom': utilisateur.prenom, 'nom': utilisateur.nom,
            'role': utilisateur.role,
            'organisme': {'id': centre.id, 'raison_sociale': centre.raison_sociale} if centre else None}


def _compte(utilisateur):
    return Response(_donnees_compte(utilisateur))


@api_view(["POST"])
@log_metier("controller", champs=["resultat.id"])
def connexion(request):
    """POST /auth/login {email, mot_de_passe} : 200 connecté ({id, email}) et session ouverte ; 400 champ manquant ;
    401 IDENTIFIANTS_INVALIDES (« E-mail ou mot de passe incorrect », sans dire lequel)."""
    try:
        utilisateur = compte_service.connecter(request.data.get('email'), request.data.get('mot_de_passe'))
    except DonneesInvalides as e:
        return _formulaire_invalide(e)
    except ErreurMetier as e:
        return _erreur(e)
    _ouvrir_session(request, utilisateur)
    return _compte(utilisateur)


@api_view(["GET"])
def moi(request):
    """GET /auth/moi : le compte connecté ({id, email, prenom, nom, role, organisme}), ou 401 NON_CONNECTE."""
    utilisateur = _utilisateur_connecte(request)
    if utilisateur is None:
        return _non_connecte()
    return _compte(utilisateur)


@api_view(["POST"])
def deconnexion(request):
    """POST /auth/logout (SCRUM-17, menu du profil SCRUM-19) : ferme la session côté serveur et efface le cookie.
    204, que quelqu'un soit connecté ou non ; ensuite les pages protégées répondent 401 NON_CONNECTE."""
    request.session.flush()
    return Response(status=status.HTTP_204_NO_CONTENT)
