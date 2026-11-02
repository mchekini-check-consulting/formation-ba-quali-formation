import { createContext, useContext } from 'react'

// Fonction d'affichage d'un toast, fournie par ToastProvider
export const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)
