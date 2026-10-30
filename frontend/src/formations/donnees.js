// Source des formations pour les écrans : l'API Django par défaut,
// ou les données de démo du navigateur quand VITE_DONNEES=demo (tests, démonstration sans backend).
import * as demo from './service'
import * as api from './serviceApi'

export const modeDemo = import.meta.env?.VITE_DONNEES === 'demo'
const source = modeDemo ? demo : api

export const listerFormations = (...a) => source.listerFormations(...a)
export const obtenirFormation = (...a) => source.obtenirFormation(...a)
export const enregistrerFormation = (...a) => source.enregistrerFormation(...a)
export const publier = (...a) => source.publier(...a)
export const retirerPublication = (...a) => source.retirerPublication(...a)
export const archiver = (...a) => source.archiver(...a)
export const restaurer = (...a) => source.restaurer(...a)
export const supprimer = (...a) => source.supprimer(...a)
export const ajouterSession = (...a) => source.ajouterSession(...a)
// Liens « charger des exemples · vider » : seulement en mode démo
export const chargerExemples = (...a) => demo.chargerExemples(...a)
export const viderDemo = (...a) => demo.viderDemo(...a)
