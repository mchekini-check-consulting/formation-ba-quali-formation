import { useCallback, useEffect, useRef, useState } from 'react'
import Icone from './Icone'
import { ToastContext } from './toastContext'

// Message de confirmation en bas de l'écran, masqué après 4,2 s (comme la maquette)
export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null)
  const minuteur = useRef(null)

  const afficher = useCallback((texte) => {
    setMessage(texte)
    clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => setMessage(null), 4200)
  }, [])

  useEffect(() => () => clearTimeout(minuteur.current), [])

  return (
    <ToastContext.Provider value={afficher}>
      {children}
      <div className="toast" role="status" hidden={!message}>
        {message && <><Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span></>}
      </div>
    </ToastContext.Provider>
  )
}
