from django.urls import path, register_converter

from quali_formation import views


class SiretConverter:
    """Chiffres et espaces seulement : toute autre adresse répond 404 sans atteindre la recherche (rien d'autre
    qu'un numéro ne peut ainsi arriver dans les logs)."""

    regex = '[0-9 ]{1,32}'

    def to_python(self, valeur):
        return valeur

    def to_url(self, valeur):
        return valeur


register_converter(SiretConverter, 'siret')

# Routes de l'API, montées sous /api/ dans config/urls.py
urlpatterns = [
    path('sante/', views.sante),
    # Créer un compte (SCRUM-15) : POST /auth/register
    path('auth/register', views.inscription),
    # Se connecter (SCRUM-16) : POST /auth/login
    path('auth/login', views.connexion),
    # Compte connecté (connexion mémorisée par la session) : GET /auth/moi
    path('auth/moi', views.moi),
    # Se déconnecter (SCRUM-17, menu du profil SCRUM-19) : POST /auth/logout
    path('auth/logout', views.deconnexion),
    path('formations/', views.formations),
    path('formations/<int:pk>/', views.formation),
    path('formations/<int:pk>/publier/', views.publier),
    path('formations/<int:pk>/retirer-publication/', views.retirer_publication),
    path('formations/<int:pk>/archiver/', views.archiver),
    path('formations/<int:pk>/restaurer/', views.restaurer),
    path('formations/<int:pk>/sessions/', views.sessions),
    # Sessions et planning (SCRUM-25)
    path('sessions/', views.sessions_planning),
    path('formateurs/', views.formateurs),
    path('apprenants/', views.apprenants),
    # Entreprises clientes du centre (SCRUM-112)
    path('entreprises/', views.entreprises),
    # Informations du centre à la première connexion (SCRUM-221)
    path('organisme/', views.organisme),
    # Recherche d'une entreprise par SIRET (service partagé : SCRUM-221, puis SCRUM-113)
    path('entreprises/<siret:siret>/', views.entreprise),
    # Modèles par dossiers (SCRUM-210)
    path('modeles/resume', views.modeles_resume),
    # Modèles d'origine et modèles génériques du compte (SCRUM-211)
    path('modeles/', views.modeles),
    path('modeles/<str:type_modele>', views.modele),
]
