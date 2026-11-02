import { Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import TableauDeBord from './pages/TableauDeBord'
import FormationDetail from './pages/FormationDetail'
import FormationForm from './pages/FormationForm'
import FormationsListe from './pages/FormationsListe'
import Items from './pages/Items'
import LandingPage from './landing/LandingPage'

// Routes de l'application (utilisées par main.jsx et par les tests)
export const routes = [
  // Landing page (SCRUM-14) : première page du site pour un visiteur non connecté
  { path: '/', element: <LandingPage /> },
  {
    element: <Layout />,
    children: [
      { path: '/tableau-de-bord', element: <TableauDeBord /> },
      { path: '/formations', element: <FormationsListe /> },
      { path: '/formations/nouvelle', element: <FormationForm /> },
      { path: '/formations/:id/modifier', element: <FormationForm /> },
      { path: '/formations/:id', element: <FormationDetail /> },
      // Écran d'exemple de l'équipe (GET / POST /items)
      { path: '/items', element: <Items /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
