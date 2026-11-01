from django.urls import path

from quali_formation import views

# Routes de l'API, montées sous /api/ dans config/urls.py
urlpatterns = [
    path('sante/', views.sante),
    path('formations/', views.formations),
    path('formations/<int:pk>/', views.formation),
    path('formations/<int:pk>/publier/', views.publier),
    path('formations/<int:pk>/retirer-publication/', views.retirer_publication),
    path('formations/<int:pk>/sessions/', views.sessions),
]
