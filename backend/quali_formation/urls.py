from django.urls import path

from quali_formation import views

# Routes de l'API, montées sous /api/ dans config/urls.py
urlpatterns = [
    path('sante/', views.sante),
    # Créer un compte (SCRUM-15) : POST /auth/register
    path('auth/register', views.inscription),
    # Se connecter (SCRUM-16) : POST /auth/login
    path('auth/login', views.connexion),
    # Compte connecté (connexion mémorisée par la session) : GET /auth/moi
    path('auth/moi', views.moi),
    path('formations/', views.formations),
    path('formations/<int:pk>/', views.formation),
    path('formations/<int:pk>/publier/', views.publier),
    path('formations/<int:pk>/retirer-publication/', views.retirer_publication),
    path('formations/<int:pk>/archiver/', views.archiver),
    path('formations/<int:pk>/restaurer/', views.restaurer),
    path('formations/<int:pk>/sessions/', views.sessions),
    # Sessions et planning (SCRUM-25)
    path('sessions/', views.sessions_planning),
    # Fiche et modification d'une session (SCRUM-36)
    path('sessions/<int:pk>/', views.session_fiche),
    path('formateurs/', views.formateurs),
    path('apprenants/', views.apprenants),
]
