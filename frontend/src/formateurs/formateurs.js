// Formateurs (SCRUM-119) : statuts, vérifications de la fenêtre « Nouveau formateur » et règles des documents.
import { verifierPersonne } from '../sessions/regles'

export const SALARIE = 'SALARIE'
export const SOUS_TRAITANT = 'SOUS_TRAITANT'
export const STATUTS_FORMATEUR = [[SALARIE, 'Salarié'], [SOUS_TRAITANT, 'Sous-traitant']]

export const MSG_NDA = 'Le NDA doit contenir 11 chiffres'

// Prénom, nom, e-mail (SCRUM-26) ; statut facultatif ; NDA facultatif mais de 11 chiffres (espaces acceptés),
// vérifié seulement pour un sous-traitant (le champ est masqué sinon)
export function verifierFormateur(f) {
  const erreurs = verifierPersonne(f)
  const nda = (f.numero_nda || '').replaceAll(/\s/g, '')
  if (f.statut === SOUS_TRAITANT && nda && !/^\d{11}$/.test(nda)) erreurs.numero_nda = MSG_NDA
  return erreurs
}

// Documents : PDF, JPG, PNG ou Word, 10 Mo au plus chacun ; 1 CV, 5 diplômes (mêmes règles que le backend)
export const CV = 'CV'
export const DIPLOME = 'DIPLOME'
export const MAXIMUM = { [CV]: 1, [DIPLOME]: 5 }
export const FORMATS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
export const ACCEPT = FORMATS.map((f) => `.${f}`).join(',')
export const TAILLE_MAX = 10 * 1024 * 1024

const extension = (nom) => (nom.includes('.') ? nom.split('.').pop().toLowerCase() : '')
const MSG_MAXIMUM = { [CV]: '1 CV maximum', [DIPLOME]: '5 diplômes maximum' }

// Fichiers déposés ou importés : ceux qui sont gardés (dans la limite du nombre) et un message par fichier refusé
export function trierFichiers(fichiers, type, dejaAjoutes) {
  const gardes = []
  const refus = []
  for (const fichier of fichiers) {
    if (!FORMATS.includes(extension(fichier.name))) refus.push(`« ${fichier.name} » refusé : format non accepté (PDF, JPG, PNG ou Word)`)
    else if (fichier.size > TAILLE_MAX) refus.push(`« ${fichier.name} » refusé : plus de 10 Mo`)
    else if (dejaAjoutes + gardes.length >= MAXIMUM[type]) refus.push(`« ${fichier.name} » refusé : ${MSG_MAXIMUM[type]}`)
    else gardes.push(fichier)
  }
  return { gardes, refus }
}

// Taille affichée sous la forme « 420 Ko », « 1,2 Mo »
export function tailleFr(octets) {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`
  return `${String(Number((octets / (1024 * 1024)).toFixed(1))).replace('.', ',')} Mo`
}

// Bandeau affiché sur la page quand le formateur est créé mais qu'un fichier n'a pas pu être enregistré
export function messageFichiersNonEnregistres(formateur, noms) {
  const liste = noms.map((n) => `« ${n} »`).join(', ')
  return noms.length > 1
    ? `Le formateur « ${formateur.prenom} ${formateur.nom} » a été créé, mais ces fichiers n’ont pas été enregistrés : ${liste}.`
    : `Le formateur « ${formateur.prenom} ${formateur.nom} » a été créé, mais le fichier ${liste} n’a pas été enregistré.`
}
