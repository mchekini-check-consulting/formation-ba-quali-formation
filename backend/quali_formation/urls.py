from django.urls import path

from quali_formation.views import sante

# Routes de l'API, montées sous /api/ dans config/urls.py
urlpatterns = [
    path('sante/', sante),
]
