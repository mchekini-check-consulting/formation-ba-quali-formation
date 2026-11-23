import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageEnChargement } from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { pluriel } from '../formations/catalogue'
import { resumeModeles } from './serviceApi'
import '../styles/modeles.css'

// Carte d'un dossier : icône, nom en gras, compteur en gris, chevron à droite
function CarteDossier({ lien, icone, nom, compteur }) {
  return (
    <Link className="mod-carte" to={lien}>
      <span className="mod-carte-ic" aria-hidden="true"><Icone nom={icone} taille={20} /></span>
      <span className="mod-carte-t"><b>{nom}</b><span>{compteur}</span></span>
      <span className="mod-carte-chev" aria-hidden="true"><Icone nom="chevDroite" taille={16} /></span>
    </Link>
  )
}

// SCRUM-210 « Accéder aux modèles par dossiers » (maquette SCRUM-210-1-Accueil-Modeles) : deux dossiers et leur compteur
export function ModelesAccueil() {
  const [resume, setResume] = useState(null)
  const [erreur, setErreur] = useState(null)
  useEffect(() => {
    let actif = true
    resumeModeles().then((r) => { if (actif) setResume(r) }).catch((e) => { if (actif) setErreur(e) })
    return () => { actif = false }
  }, [])

  if (!resume) return <PageEnChargement erreur={erreur} texte="Chargement des modèles…" />
  const { nb_modeles: modeles, nb_formations: formations } = resume
  return (
    <div className="wrap modeles">
      <div className="page-head"><h1>Modèles</h1></div>
      <div className="mod-dossiers">
        <CarteDossier lien="/modeles/generiques" icone="doc" nom="Modèles génériques" compteur={`${modeles} ${pluriel(modeles, 'modèle')}`} />
        <CarteDossier lien="/modeles/formations" icone="dossier" nom="Modèles par formation" compteur={`${formations} ${pluriel(formations, 'formation')}`} />
      </div>
    </div>
  )
}

// Un dossier ouvert : vide pour l'instant (contenu dans les US suivantes de l'épic Modèles)
export function DossierModeles({ titre }) {
  const navigate = useNavigate()
  return (
    <div className="wrap modeles">
      <div className="page-head"><h1>Modèles</h1></div>
      <div className="mod-fil">
        <button type="button" className="btn btn-line btn-sm" onClick={() => navigate('/modeles')}>← Retour</button>
        <nav aria-label="Fil d'Ariane"><Link to="/modeles">Modèles</Link><span aria-hidden="true"> › </span><b aria-current="page">{titre}</b></nav>
      </div>
    </div>
  )
}
