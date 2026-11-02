import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icone from './Icone'

// Fond assombri + pop-up. Un clic sur le fond ou la touche Échap appellent onFermer (comme la maquette).
export function Modal({ children, onFermer, classeFond = '' }) {
  const precedent = useRef(null)
  const fond = useRef(null)
  const fermer = useRef(onFermer)
  useEffect(() => { fermer.current = onFermer })

  // Une seule fois à l'ouverture : on retient l'élément actif pour lui rendre le focus à la fermeture
  useEffect(() => {
    precedent.current = document.activeElement
    const echap = (e) => { if (e.key === 'Escape') fermer.current?.() }
    const clicFond = (e) => { if (e.target === fond.current) fermer.current?.() }
    document.addEventListener('keydown', echap)
    document.addEventListener('mousedown', clicFond)
    return () => {
      document.removeEventListener('keydown', echap)
      document.removeEventListener('mousedown', clicFond)
      if (precedent.current && document.contains(precedent.current)) precedent.current.focus()
    }
  }, [])

  return createPortal(
    <div className={`overlay ${classeFond}`} ref={fond}>
      {children}
    </div>,
    document.body,
  )
}

// Pop-up de confirmation générique (confirmDlg de la maquette)
export function ConfirmDialog({ titre, texte, action, danger, icone, fondIcone, couleurIcone, onOk, onAnnuler }) {
  return (
    <Modal onFermer={onAnnuler}>
      <dialog open className="dialog" aria-modal="true" aria-labelledby="dc">
        <span className="dlg-ic" style={{ background: fondIcone, color: couleurIcone }}><Icone nom={icone} taille={26} /></span>
        <h2 id="dc">{titre}</h2>
        <p>{texte}</p>
        <div className="foot">
          <button type="button" className="btn btn-line" onClick={onAnnuler}>Annuler</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onOk} autoFocus>{action}</button>
        </div>
      </dialog>
    </Modal>
  )
}

export default Modal
