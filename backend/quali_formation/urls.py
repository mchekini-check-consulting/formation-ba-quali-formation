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
    # Fiche d'une session (SCRUM-168) : en-tête et nombres des onglets
    path('sessions/<int:pk>/', views.fiche_session),
    # Documents d'une session (SCRUM-220) : liste et modèle utilisé, génération (un PDF par apprenant ou par
    # entreprise cliente), téléchargement du PDF figé (organisme connecté seulement)
    path('sessions/<int:pk>/documents/', views.documents_session),
    path('sessions/<int:pk>/documents/<str:type_modele>/generer', views.generer_documents_session),
    path('sessions/<int:pk>/documents/<int:document>/pdf', views.pdf_document_session),
    path('formateurs/', views.formateurs),
    path('formateurs/<int:pk>/documents/', views.formateur_documents),
    path('apprenants/', views.apprenants),
    # Entreprises clientes du centre (SCRUM-112)
    path('entreprises/', views.entreprises),
    path('annuaire-entreprises/', views.annuaire_entreprises),
    # Informations du centre à la première connexion (SCRUM-221)
    path('organisme/', views.organisme),
    # Recherche d'une entreprise par SIRET (service partagé : SCRUM-221, puis SCRUM-113)
    path('entreprises/<siret:siret>/', views.entreprise),
    # Modèles par dossiers (SCRUM-210)
    path('modeles/resume', views.modeles_resume),
    path('modeles/formations/', views.modeles_par_formation),
    # Modèles d'origine et modèles génériques du compte (SCRUM-211)
    path('modeles/', views.modeles),
    path('modeles/<str:type_modele>', views.modele),
    # Importer son propre document Word (SCRUM-215) : POST /modeles/<type>/import (rien n'est enregistré)
    path('modeles/<str:type_modele>/import', views.importer_modele),
    # Télécharger un modèle en Word (SCRUM-216) : GET /modeles/<type>/export.docx (dernière version enregistrée)
    path('modeles/<str:type_modele>/export.docx', views.exporter_modele),
    # Rétablir le modèle d'origine (SCRUM-217) : GET /modeles/<type>/origine (lecture seule),
    # POST /modeles/<type>/reinitialiser (le modèle générique du compte redevient celui d'origine)
    path('modeles/<str:type_modele>/origine', views.modele_origine),
    path('modeles/<str:type_modele>/reinitialiser', views.retablir_modele),
    # Dupliquer un modèle générique pour une formation (SCRUM-218) : GET /modeles/<type>/formations (fenêtre
    # « Dupliquer »), POST /formations/<id>/modeles/<type>/ (création au clic sur « Enregistrer », RG8)
    path('modeles/<str:type_modele>/formations', views.formations_pour_duplication),
    path('formations/<int:pk>/modeles/<str:type_modele>/', views.modele_formation),
    # Modèles de la formation (SCRUM-219) : liste « Modèles par formation », dossier d'une formation, modèle de la
    # formation (GET / PUT ci-dessus), « Rétablir le modèle générique » (RG19 : contenu remplacé par le modèle
    # générique actuel) et téléchargement en Word
    path('formations/<int:pk>/modeles/', views.dossier_formation),
    path('formations/<int:pk>/modeles/<str:type_modele>/reinitialiser', views.retablir_modele_formation),
    path('formations/<int:pk>/modeles/<str:type_modele>/export.docx', views.exporter_modele_formation),
    # Variables du panneau de l'éditeur (SCRUM-214) : GET /variables/
    path('variables/', views.variables),
]
