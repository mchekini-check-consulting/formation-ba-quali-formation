import { useEffect, useRef, useState } from 'react'
import PanneauApprenant from '../apprenants/PanneauApprenant'
import PanneauFormateur from '../formateurs/PanneauFormateur'
import Icone from '../components/Icone'
import { PARTIES_PRENANTES } from './typesPersonnes'

// Bouton « Parties prenantes » et sa liste déroulante. onChoisir(type) : 'formateur' ou 'apprenant'.
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
        <Icone nom="apprenants" taille={18} />Parties prenantes<span className={`pp-chev${ouvert ? ' ouvert' : ''}`}><Icone nom="chev" taille={16} /></span>
      </button>
      {ouvert && (
        <div className="pp-menu" role="menu">
          {Object.entries(PARTIES_PRENANTES).map(([type, t]) => (
            <button type="button" role="menuitem" key={type} onClick={() => choisir(type)}>
              <span className={`pp-ic ${t.classe}`}><Icone nom={t.icone} taille={18} /></span>
              <span><b>{t.titre}</b><small>{t.aide}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Panneau latéral « Nouveau formateur » (SCRUM-26, complété par SCRUM-119) ou « Nouvel apprenant » (SCRUM-27, complété
// par SCRUM-112). « Annuler », la croix, Échap ou un clic à côté le ferment.
// onCree(personne, nonEnregistres) : appelé après l'enregistrement (formateur : noms des fichiers non enregistrés).
export function PanneauPartiePrenante({ type, onFermer, onCree }) {
  return type === 'apprenant'
    ? <PanneauApprenant onFermer={onFermer} onCree={onCree} />
    : <PanneauFormateur onFermer={onFermer} onCree={onCree} />
}
