import { createElement, Fragment } from 'react'

// Affichage d'un modèle de document (HTML, variables écrites {{code}}) sans jamais injecter son HTML dans la page :
// seules les balises de mise en forme sont reproduites, sans attribut (ni lien, ni image, ni événement, ni script).
// Indispensable dès que chaque organisme pourra écrire dans ses modèles (SCRUM-213, aucun contrôle du contenu : RG12).
const BALISES = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'p', 'div', 'span', 'br', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote'])
const IGNOREES = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript'])
// Classes de mise en page des modèles d'origine : en-tête, emplacement du logo, texte conditionnel
const CLASSES = { eh: 'doc-entete', 'logo-ph': 'doc-logo', cond: 'doc-cond' }
const ALIGNEMENTS = new Set(['left', 'center', 'right', 'justify'])
const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/

// Texte : chaque {{code}} devient une étiquette avec le libellé de la variable (le code si elle est inconnue)
function texte(contenu, libelles, cle) {
  const morceaux = contenu.split(VARIABLE)
  if (morceaux.length === 1) return contenu
  return morceaux.map((m, i) => (i % 2
    ? <span key={`${cle}.${i}`} className="doc-variable" title={`{{${m}}}`}>{libelles[m] || m}</span>
    : m))
}

// Seuls attributs gardés : les classes connues et l'alignement / la marge haute du texte
function proprietes(element, cle) {
  const props = { key: cle }
  const classes = [...element.classList].map((c) => CLASSES[c]).filter(Boolean)
  if (classes.length) props.className = classes.join(' ')
  const style = {}
  if (ALIGNEMENTS.has(element.style.textAlign)) style.textAlign = element.style.textAlign
  if (/^\d{1,3}px$/.test(element.style.marginTop)) style.marginTop = element.style.marginTop
  if (Object.keys(style).length) props.style = style
  return props
}

function noeud(n, libelles, cle) {
  if (n.nodeType === Node.TEXT_NODE) return texte(n.textContent, libelles, cle)
  if (n.nodeType !== Node.ELEMENT_NODE) return null
  const balise = n.tagName.toLowerCase()
  if (IGNOREES.has(balise)) return null
  if (balise === 'br') return <br key={cle} />
  const enfants = [...n.childNodes].map((e, i) => noeud(e, libelles, `${cle}.${i}`))
  // Balise non prévue (lien, image…) : seulement son texte
  if (!BALISES.has(balise)) return <Fragment key={cle}>{enfants}</Fragment>
  return createElement(balise, proprietes(n, cle), ...enfants)
}

// SCRUM-211 (CA2) : le document tel qu'il sera imprimé, variables en étiquettes
export function DocumentModele({ contenu, variables = [] }) {
  const libelles = Object.fromEntries(variables.map((v) => [v.code, v.libelle]))
  const corps = new DOMParser().parseFromString(contenu || '', 'text/html').body
  return (
    <article className="doc-feuille" aria-label="Document">
      {[...corps.childNodes].map((n, i) => noeud(n, libelles, String(i)))}
    </article>
  )
}
