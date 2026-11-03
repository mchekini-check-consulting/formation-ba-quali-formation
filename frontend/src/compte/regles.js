// Règles du formulaire « Créer un compte » (SCRUM-15, RG-CC-01 à 06) : les mêmes sont vérifiées par le serveur (services.py).

// Les 5 indicateurs du mot de passe, cochés en direct (ordre de la maquette : 2 colonnes)
export const REGLES_MOT_DE_PASSE = [
  { id: 'longueur', libelle: '8 caractères minimum', ok: (m) => m.length >= 8 },
  { id: 'majuscule', libelle: 'Une majuscule', ok: (m) => /\p{Lu}/u.test(m) },
  { id: 'minuscule', libelle: 'Une minuscule', ok: (m) => /\p{Ll}/u.test(m) },
  { id: 'chiffre', libelle: 'Un chiffre', ok: (m) => /\p{N}/u.test(m) },
  { id: 'special', libelle: 'Un caractère spécial', ok: (m) => /[^\p{L}\p{N}\s]/u.test(m) },
]

// Format « nom@domaine.ext » : un seul @, pas d'espace, un point dans le domaine (ni au début ni à la fin)
function emailValide(email) {
  const morceaux = email.split('@')
  if (morceaux.length !== 2 || /\s/.test(email)) return false
  const [nom, domaine] = morceaux
  const point = domaine.lastIndexOf('.')
  return nom.length > 0 && point > 0 && point < domaine.length - 1
}

// Erreurs par champ ({ email: 'message', ... }) ; objet vide si tout est bon
export function verifier({ email, motDePasse, confirmation, cgu }) {
  const erreurs = {}
  const e = email.trim()
  if (!e) erreurs.email = "L'adresse e-mail est obligatoire."
  else if (!emailValide(e)) erreurs.email = "L'adresse e-mail n'est pas au bon format (ex. vous@organisme.fr)."
  if (!motDePasse) erreurs.motDePasse = 'Le mot de passe est obligatoire.'
  else {
    const manquantes = REGLES_MOT_DE_PASSE.filter((r) => !r.ok(motDePasse)).map((r) => r.libelle.toLowerCase())
    if (manquantes.length) erreurs.motDePasse = `Le mot de passe doit contenir : ${manquantes.join(', ')}.`
  }
  if (confirmation !== motDePasse) erreurs.confirmation = 'La confirmation ne correspond pas au mot de passe.'
  if (!cgu) erreurs.cgu = 'Vous devez accepter les CGU / CGV et la politique de confidentialité.'
  return erreurs
}
