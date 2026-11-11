import { useState } from 'react'

// Outils des formulaires « Nouvelle session » (SCRUM-25) et « Modifier la session » (SCRUM-36).

// Libellé « N apprenant(s) sélectionné(s) »
export const compteur = (n) => (n > 1 ? `${n} apprenants sélectionnés` : `${n} apprenant sélectionné`)

// Saisie des informations : valeurs, erreurs par champ, propriétés des champs.
// Choisir une formation reprend sa durée, qui reste ensuite modifiable.
export function useSaisieSession(initial, formations) {
  const [s, setS] = useState(initial)
  const [erreurs, setErreurs] = useState({})
  const changer = (k, v) => {
    const suite = { ...s, [k]: v }
    if (k === 'formation') suite.duree = formations.find((f) => String(f.id) === v)?.duree || ''
    setS(suite)
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined })
  }
  const saisie = (k) => ({
    id: `ns-${k}`, value: s[k], onChange: (e) => changer(k, e.target.value),
    className: `inp${erreurs[k] ? ' err' : ''}`, 'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `ns-${k}-err` : undefined,
  })
  return { s, erreurs, setErreurs, changer, saisie }
}

// Bascule d'une case : ajoute ou retire l'identifiant de la liste
export const basculerDans = (liste, id) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])
