import { Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import TableauDeBord from './pages/TableauDeBord'
import FormationsListe from './pages/FormationsListe'

// Routes de l'application (utilisées par main.jsx et par les tests)
export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TableauDeBord /> },
      { path: '/formations', element: <FormationsListe /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
