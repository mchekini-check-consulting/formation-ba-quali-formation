// SCRUM-215 : RG11 vérifiée avant l'envoi d'un document Word (le backend la vérifie aussi)
export const TAILLE_MAX_WORD = 10 * 1024 * 1024 // 10 Mo, même limite que le backend
export const FORMAT_REFUSE = 'Seuls les fichiers Word (.docx) sont acceptés.'
export const TROP_VOLUMINEUX = 'Le fichier dépasse 10 Mo : choisissez un document plus léger.'

// Le message à afficher, ou null si le fichier convient
export function verifierFichierWord(fichier) {
  if (!fichier.name.toLowerCase().endsWith('.docx')) return FORMAT_REFUSE
  if (fichier.size > TAILLE_MAX_WORD) return TROP_VOLUMINEUX
  return null
}
