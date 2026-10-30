import { Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import TableauDeBord from './pages/TableauDeBord'
import FormationForm from './pages/FormationForm'
import FormationsListe from './pages/FormationsListe'

// Écran pas encore livré (remplacé aux étapes suivantes)
const EnConstruction = () => <div className="wrap"><div className="card empty"><p className="sub">Cet écran arrive à l’étape suivante.</p></div></div>

// Routes de l'application (utilisées par main.jsx et par les tests)
export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TableauDeBord /> },
      { path: '/formations', element: <FormationsListe /> },
      { path: '/formations/nouvelle', element: <FormationForm /> },
      { path: '/formations/:id/modifier', element: <FormationForm /> },
      { path: '/formations/:id', element: <EnConstruction /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
