// Thème d'une formation, déduit de son intitulé : choisit la scène et les couleurs de son illustration

const SCENE_OF = [[/business|analyst|\bba\b|besoin|exigence/i, 'ba'], [/manag|équipe|leader/i, 'mgmt'], [/excel|bureautique|tableur|word|informatique/i, 'excel'], [/projet|agile|scrum/i, 'projet'], [/secour|sst|sécurité|santé/i, 'sst'], [/parole|communication|oral|présent/i, 'parole'], [/anglais|langue|english|espagnol/i, 'langue']]

// Couleurs par thème : fond pastel + deux teintes assorties
export const ART_COL = {
  ba: ['#E3F3EF', '#0F766E', '#5FBFAF'], mgmt: ['#E6F4EC', '#2F7D6D', '#7CC3AE'], excel: ['#E5F5E8', '#2F8A5B', '#7CC29B'],
  projet: ['#EDF5E3', '#5C8F4A', '#A5CB8E'], sst: ['#E2F1F1', '#1F6F78', '#7DBFC4'], parole: ['#E6F4F0', '#3C8D7E', '#8FD0C2'],
  langue: ['#E2F0F3', '#26727F', '#7FBFCB'], def: ['#E3F3EF', '#0F766E', '#5FBFAF'],
}

export const themeDe = (titre) => (SCENE_OF.find(([re]) => re.test(titre || '')) || [0, 'def'])[1]

// Couleur d'accent de la carte (bordure et ombre)
export const artAccent = (f) => ART_COL[themeDe(f.title)][1]
