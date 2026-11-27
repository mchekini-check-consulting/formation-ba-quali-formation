import { useEffect, useRef, useState } from 'react'
import PanneauApprenant from '../apprenants/PanneauApprenant'
import PanneauEntreprise from '../entreprises/PanneauEntreprise'
import PanneauFormateur from '../formateurs/PanneauFormateur'
import Icone from '../components/Icone'
import { CHOIX_PARTIES_PRENANTES } from './typesPersonnes'

// Bouton « Parties prenantes » et sa liste de 3 choix (maquette SCRUM-167).
// onChoisir(type) : 'apprenant', 'formateur' ou 'entreprise'.
export function MenuPartiesPrenantes({ onChoisir }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef(null)

  // Un clic en dehors du menu le referme
  useEffect(() => {
    if (!ouvert) return undefined
    const fermer = (e) => { if (!zone.current.contains(e.target)) setOuvert(false) }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [ouvert])

  const choisir = (type) => { setOuvert(false); onChoisir(type) }

  return (
    <div className="pp" ref={zone}>
      <button type="button" className="btn btn-outline" aria-expanded={ouvert} aria-haspopup="menu" onClick={() => setOuvert(!ouvert)}>
        Parties prenantes<span className={`pp-chev${ouvert ? ' ouvert' : ''}`}><Icone nom="chev" taille={16} /></span>
      </button>
      {ouvert && (
        <div className="pp-menu" role="menu">
          {CHOIX_PARTIES_PRENANTES.map(({ type, titre }) => (
            <button type="button" role="menuitem" key={type} onClick={() => choisir(type)}>{titre}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Panneau latéral « Nouveau formateur » (SCRUM-26, complété par SCRUM-119), « Nouvel apprenant » (SCRUM-27, complété
// par SCRUM-112) ou « Nouvelle entreprise cliente » (SCRUM-113). « Annuler », la croix, Échap ou un clic à côté le ferment.
// onCree(partie, nonEnregistres) : appelé après l'enregistrement (formateur : noms des fichiers non enregistrés).
export function PanneauPartiePrenante({ type, onFermer, onCree }) {
  if (type === 'entreprise') return <PanneauEntreprise onFermer={onFermer} onCree={onCree} />
  return type === 'apprenant'
    ? <PanneauApprenant onFermer={onFermer} onCree={onCree} />
    : <PanneauFormateur onFermer={onFermer} onCree={onCree} />
}
