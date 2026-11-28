import { Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ConnexionDialog from './compte/ConnexionDialog'
import CreerCompte from './pages/CreerCompte'
import PremiereConnexion from './pages/PremiereConnexion'
import TableauDeBord from './pages/TableauDeBord'
import FormationDetail from './pages/FormationDetail'
import FormationForm from './pages/FormationForm'
import FormationsListe from './pages/FormationsListe'
import Items from './pages/Items'
import BientotDisponible from './pages/BientotDisponible'
import NouvelleSession from './pages/NouvelleSession'
import SessionsPlanning from './pages/SessionsPlanning'
import { FicheSession } from './sessions/FicheSession'
import ListePartiesPrenantes from './pages/ListePartiesPrenantes'
import LandingPage from './landing/LandingPage'
import {
  DossierFormation, ModeleFormationNouveau, ModeleFormationOuvert, ModeleOuvert, ModelesAccueil, ModelesGeneriques, ModelesParFormation,
} from './modeles/Modeles'

// Routes de l'application (utilisées par main.jsx et par les tests)
export const routes = [
  // Landing page (SCRUM-14) : première page du site pour un visiteur non connecté
  { path: '/', element: <LandingPage /> },
  // Créer un compte (SCRUM-15) : page plein écran, sans barre latérale
  { path: '/creer-un-compte', element: <CreerCompte /> },
  // Se connecter (SCRUM-16) : pop-up par-dessus la landing page
  { path: '/se-connecter', element: <><LandingPage /><ConnexionDialog /></> },
  // Informations du centre à la première connexion (SCRUM-221) : page plein écran, sans barre latérale
  { path: '/premiere-connexion', element: <PremiereConnexion /> },
  {
    element: <Layout />,
    children: [
      { path: '/tableau-de-bord', element: <TableauDeBord /> },
      { path: '/formations', element: <FormationsListe /> },
      { path: '/formations/nouvelle', element: <FormationForm /> },
      { path: '/formations/:id/modifier', element: <FormationForm /> },
      { path: '/formations/:id', element: <FormationDetail /> },
      // Sessions et planning (SCRUM-25)
      { path: '/sessions', element: <SessionsPlanning /> },
      // Fiche d'une session (SCRUM-168) : remplace la page de la SCRUM-220 (sessions/SessionDetail, plus affichée)
      { path: '/sessions/:id', element: <FicheSession /> },
      { path: '/sessions/nouvelle', element: <><SessionsPlanning key="sous-panneau" /><NouvelleSession /></> }, // panneau par-dessus la liste (SCRUM-166) ; key : liste rechargée à la fermeture
      // Modèles de documents par dossiers (SCRUM-210) : dossiers vides pour l'instant (US suivantes de l'épic)
      { path: '/parties-prenantes', element: <ListePartiesPrenantes /> }, // SCRUM-209
      { path: '/modeles', element: <ModelesAccueil /> },
      { path: '/modeles/generiques', element: <ModelesGeneriques /> },
      // Modèle générique ouvert (SCRUM-211) : texte et variables en étiquettes ; éditeur avec SCRUM-213
      { path: '/modeles/generiques/:type', element: <ModeleOuvert /> },
      // SCRUM-219 : « Modèles par formation », dossier d'une formation, modèle de la formation dans l'éditeur
      { path: '/modeles/formations', element: <ModelesParFormation /> },
      { path: '/modeles/formations/:formation', element: <DossierFormation /> },
      { path: '/modeles/formations/:formation/:type', element: <ModeleFormationOuvert /> },
      // SCRUM-218 : nouveau modèle de la formation, créé seulement à « Enregistrer » (RG8)
      { path: '/modeles/formations/:formation/:type/nouveau', element: <ModeleFormationNouveau /> },
      // Fonctionnalités du menu ou du profil pas encore développées (SCRUM-19)
      { path: '/bientot-disponible/:code', element: <BientotDisponible /> },
      // Écran d'exemple de l'équipe (GET / POST /items)
      { path: '/items', element: <Items /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
