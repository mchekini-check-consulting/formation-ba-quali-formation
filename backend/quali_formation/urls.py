from django.urls import path

from quali_formation import views

# Routes de l'API, montées sous /api/ dans config/urls.py
urlpatterns = [
    path('sante/', views.sante),
    # Créer un compte (SCRUM-15) : POST /auth/register
    path('auth/register', views.inscription),
    # Se connecter (SCRUM-16) : POST /auth/login
    path('auth/login', views.connexion),
    path('formations/', views.formations),
    path('formations/<int:pk>/', views.formation),
    path('formations/<int:pk>/publier/', views.publier),
    path('formations/<int:pk>/retirer-publication/', views.retirer_publication),
    path('formations/<int:pk>/sessions/', views.sessions),
    # Sessions et planning (SCRUM-25)
    path('sessions/', views.sessions_planning),
    path('formateurs/', views.formateurs),
    path('apprenants/', views.apprenants),
]
