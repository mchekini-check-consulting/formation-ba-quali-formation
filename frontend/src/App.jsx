import { Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ConnexionDialog from './compte/ConnexionDialog'
import CreerCompte from './pages/CreerCompte'
import TableauDeBord from './pages/TableauDeBord'
import FormationDetail from './pages/FormationDetail'
import FormationForm from './pages/FormationForm'
import FormationsListe from './pages/FormationsListe'
import Items from './pages/Items'
import BientotDisponible from './pages/BientotDisponible'
import NouvelleSession from './pages/NouvelleSession'
import SessionsPlanning from './pages/SessionsPlanning'
import LandingPage from './landing/LandingPage'
import { DossierModeles, ModeleOuvert, ModelesAccueil, ModelesGeneriques } from './modeles/Modeles'

// Routes de l'application (utilisées par main.jsx et par les tests)
export const routes = [
  // Landing page (SCRUM-14) : première page du site pour un visiteur non connecté
  { path: '/', element: <LandingPage /> },
  // Créer un compte (SCRUM-15) : page plein écran, sans barre latérale
  { path: '/creer-un-compte', element: <CreerCompte /> },
  // Se connecter (SCRUM-16) : pop-up par-dessus la landing page
  { path: '/se-connecter', element: <><LandingPage /><ConnexionDialog /></> },
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
      { path: '/sessions/nouvelle', element: <><SessionsPlanning key="sous-panneau" /><NouvelleSession /></> }, // panneau par-dessus la liste (SCRUM-166) ; key : liste rechargée à la fermeture
      // Modèles de documents par dossiers (SCRUM-210) : dossiers vides pour l'instant (US suivantes de l'épic)
      { path: '/modeles', element: <ModelesAccueil /> },
      { path: '/modeles/generiques', element: <ModelesGeneriques /> },
      // Modèle générique ouvert (SCRUM-211) : texte et variables en étiquettes ; éditeur avec SCRUM-213
      { path: '/modeles/generiques/:type', element: <ModeleOuvert /> },
      { path: '/modeles/formations', element: <DossierModeles titre="Modèles par formation" /> },
      // Fonctionnalités du menu ou du profil pas encore développées (SCRUM-19)
      { path: '/bientot-disponible/:code', element: <BientotDisponible /> },
      // Écran d'exemple de l'équipe (GET / POST /items)
      { path: '/items', element: <Items /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
