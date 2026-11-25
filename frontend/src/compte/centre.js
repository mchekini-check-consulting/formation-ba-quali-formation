import { apiBase } from '../api'
import { initiales, PAGE_D_ACCUEIL } from './serviceCompte'

// Formulaire « Première connexion » (SCRUM-221) : champs des 2 blocs de la maquette et règles de saisie.
// Les mêmes règles sont vérifiées par le serveur (POST /organisme/) : rien n'est enregistré si l'une échoue.
// Représentant, contacts et conditions de vente ne sont plus demandés ici (renseignés plus tard dans Paramètres).

export const PAGE_PREMIERE_CONNEXION = '/premiere-connexion'
// Page affichée après l'enregistrement (critère 6) : Sessions et planning, comme après la création du compte (SCRUM-19)
export const PAGE_APRES_CENTRE = PAGE_D_ACCUEIL

// Un champ : nom côté serveur, libellé, exemple, aide sous le champ, obligatoire, largeur (pleine ligne)
const champ = (nom, libelle, exemple, options = {}) => ({ nom, libelle, exemple: `Ex. : ${exemple}`, ...options })

export const BLOCS = [
  {
    id: 'identite', icone: 'batiment', titre: 'Identité du centre',
    sous_titre: 'Ces informations apparaîtront dans vos conventions, convocations et attestations.',
    groupes: [{
      champs: [
        // SIRET en premier : 14 chiffres saisis, la recherche pré-remplit la raison sociale et l'adresse (critère 3)
        champ('siret', 'SIRET', '12345678900012', { obligatoire: true, pleine: true, mode: 'numeric',
          aide: 'Saisissez votre SIRET : nous remplissons les informations pour vous.' }),
        champ('raison_sociale', 'Raison sociale', 'HiTech Formation', { obligatoire: true }),
        champ('adresse', 'Adresse', '12 rue des Lilas, 75011 Paris', { obligatoire: true }),
        champ('numero_declaration_activite', 'N° de déclaration d’activité', '11756543210', { aide: '11 chiffres', mode: 'numeric' }),
        champ('region_nda', 'Région du NDA', 'Île-de-France'),
        champ('ville_signature', 'Ville de signature', 'Paris', { aide: 'Utilisée dans « Fait à … »' }),
      ],
      // Logo : traité dans une US dédiée, la zone n'est pas affichée
    }],
  },
  {
    id: 'gestionnaire', icone: 'personne', titre: 'Gestionnaire',
    sous_titre: 'Vous êtes le gestionnaire de ce centre.',
    groupes: [{
      champs: [
        champ('prenom', 'Prénom', 'Marie', { obligatoire: true }),
        champ('nom', 'Nom', 'Arnaud', { obligatoire: true }),
      ],
      email: true,
    }],
  },
]

export const CHAMPS = BLOCS.flatMap((b) => b.groupes.flatMap((g) => g.champs))
export const VIDE = Object.fromEntries(CHAMPS.map((c) => [c.nom, '']))

const MESSAGES_REQUIS = {
  raison_sociale: 'La raison sociale est obligatoire',
  siret: 'Le SIRET est obligatoire',
  adresse: 'L’adresse est obligatoire',
  prenom: 'Le prénom est obligatoire',
  nom: 'Le nom est obligatoire',
}
export const sansEspaces = (texte) => texte.replace(/\s/g, '')

// Erreurs de saisie (critère 5) : { champ: message }, vide si tout est bon
export function verifierCentre(valeurs) {
  const erreurs = {}
  for (const [nom, message] of Object.entries(MESSAGES_REQUIS)) {
    if (!valeurs[nom].trim()) erreurs[nom] = message
  }
  if (!erreurs.siret && !/^\d{14}$/.test(sansEspaces(valeurs.siret))) erreurs.siret = 'Le SIRET doit contenir 14 chiffres'
  const nda = sansEspaces(valeurs.numero_declaration_activite)
  if (nda && !/^\d{11}$/.test(nda)) {
    erreurs.numero_declaration_activite = 'Le N° de déclaration d’activité doit contenir 11 chiffres'
  }
  return erreurs
}

// « 3 champs sont à corriger. » / « 1 champ est à corriger. »
export const titreErreurs = (n) => (n > 1 ? `${n} champs sont à corriger.` : '1 champ est à corriger.')

// Initiales de la bulle du menu : prénom et nom une fois le centre enregistré, sinon tirées de l'e-mail
export function initialesCompte(compte) {
  if (compte.prenom && compte.nom) return `${compte.prenom[0]}${compte.nom[0]}`.toUpperCase()
  return initiales(compte.email)
}

// Refus du serveur ou serveur injoignable : `erreurs` = { champ: message } ; `general` si aucun champ n'est en cause
export class ErreurCentre extends Error {
  constructor(erreurs, general, code = null) {
    super(general || 'Le formulaire contient des erreurs')
    this.erreurs = erreurs
    this.general = general
    this.code = code
  }
}

// Refus du serveur quand le compte connecté a déjà un centre (409)
export const CENTRE_DEJA_ENREGISTRE = 'ORGANISME_DEJA_RENSEIGNE'

// POST /organisme/ : crée le centre et fait du compte connecté son gestionnaire ; renvoie le compte connecté
export async function enregistrerCentre(valeurs) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}/organisme/`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, v.trim()]))),
    })
  } catch {
    throw new ErreurCentre({}, 'Le serveur ne répond pas : réessayez dans un instant.')
  }
  const json = await reponse.json().catch(() => null)
  if (reponse.ok) return json
  const erreurs = Object.fromEntries((json?.erreurs || []).map((e) => [e.champ, e.message]))
  throw new ErreurCentre(erreurs, Object.keys(erreurs).length ? null : (json?.detail || 'Les informations n’ont pas pu être enregistrées. Réessayez.'),
    json?.code || null)
}
