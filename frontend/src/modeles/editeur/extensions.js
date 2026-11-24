// SCRUM-213 : blocs TipTap propres aux modèles de documents, pour qu'un modèle d'origine ouvert puis enregistré
// garde sa mise en page : variables {{code}}, en-tête (LOGO + coordonnées de l'organisme), texte conditionnel,
// marge haute des paragraphes. Rien n'est injecté en HTML : l'affichage passe par createElement / textContent.
import { Extension, Mark, Node } from '@tiptap/react'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/
const CODE = /^[A-Za-z0-9_]+$/
const MARGE = /^\d{1,3}px$/

// Étiquette bleue d'une variable : son libellé (le code si elle est inconnue), le code en info-bulle
function etiquette(code, libelles) {
  const span = document.createElement('span')
  span.className = 'doc-variable'
  span.title = `{{${code}}}`
  span.textContent = libelles[code] || code
  return span
}

// Texte avec des {{code}} -> le texte tel quel, chaque variable en étiquette
function afficherTexte(parent, texte, libelles) {
  texte.split(VARIABLE).forEach((morceau, i) => {
    if (i % 2) parent.append(etiquette(morceau, libelles))
    else if (morceau) parent.append(morceau)
  })
}

// Variable du document : étiquette insécable (SCRUM-214 : insertion depuis le panneau) ; enregistrée en {{code}}
export const Variable = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ libelles: {} }),
  addAttributes: () => ({ code: { default: null } }),
  parseHTML: () => [{
    tag: 'span[data-variable]',
    getAttrs: (el) => (CODE.test(el.dataset.variable) ? { code: el.dataset.variable } : false),
  }],
  renderHTML: ({ node }) => ['span', { 'data-variable': node.attrs.code }, `{{${node.attrs.code}}}`],
  addNodeView() {
    return ({ node }) => {
      const dom = etiquette(node.attrs.code, this.options.libelles)
      dom.contentEditable = 'false'
      return { dom }
    }
  },
})

// En-tête des modèles d'origine (<div class="eh">) : LOGO à gauche, coordonnées de l'organisme (variables) à
// droite. Conservé tel quel dans cette US : il ne contient que des informations de Paramètres (SCRUM-221).
export const EnTete = Node.create({
  name: 'enTete',
  group: 'block',
  atom: true,
  addOptions: () => ({ libelles: {} }),
  addAttributes: () => ({ logo: { default: 'LOGO' }, lignes: { default: [] } }),
  parseHTML: () => [{
    tag: 'div.eh',
    getAttrs: (el) => {
      const [logo, bloc] = el.children
      const lignes = ['']
      for (const n of bloc?.childNodes || []) {
        if (n.nodeName === 'BR') lignes.push('')
        else lignes[lignes.length - 1] += n.textContent
      }
      return { logo: logo?.textContent || '', lignes }
    },
  }],
  renderHTML: ({ node }) => ['div', { class: 'eh' }, ['span', { class: 'logo-ph' }, node.attrs.logo],
    ['span', {}, ...node.attrs.lignes.flatMap((l, i) => (i ? [['br'], l] : [l])).filter((m) => m !== '')]],
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-entete'
      dom.contentEditable = 'false'
      const logo = document.createElement('span')
      logo.className = 'doc-logo'
      logo.textContent = node.attrs.logo
      const bloc = document.createElement('span')
      node.attrs.lignes.forEach((ligne, i) => {
        if (i) bloc.append(document.createElement('br'))
        afficherTexte(bloc, ligne, this.options.libelles)
      })
      dom.append(logo, bloc)
      return { dom }
    }
  },
})

// Texte conditionnel des modèles d'origine (« Si salarié : … », <em class="cond">), affiché en gris
export const Conditionnel = Mark.create({
  name: 'conditionnel',
  parseHTML: () => [{ tag: 'em.cond', priority: 60 }],
  renderHTML: () => ['em', { class: 'cond' }, 0],
})

// Marge haute des paragraphes et titres (style="margin-top:18px" des modèles d'origine)
export const MargeHaute = Extension.create({
  name: 'margeHaute',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading'],
    attributes: {
      margeHaute: {
        default: null,
        parseHTML: (el) => (MARGE.test(el.style.marginTop) ? el.style.marginTop : null),
        renderHTML: (a) => (a.margeHaute ? { style: `margin-top:${a.margeHaute}` } : {}),
      },
    },
  }],
})

// L'éditeur (même éditeur pour un modèle générique et un modèle de la formation, SCRUM-219) :
// Titre 1 = grand titre du document (h1), Titre 2 = titres des articles (h3)
export const extensionsEditeur = (libelles = {}) => [
  StarterKit.configure({
    heading: { levels: [1, 3] }, link: false, code: false, codeBlock: false, horizontalRule: false, trailingNode: false,
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Variable.configure({ libelles }),
  EnTete.configure({ libelles }),
  Conditionnel,
  MargeHaute,
]

// Contenu enregistré -> éditeur : chaque {{code}} du texte devient une variable (élément span[data-variable])
export function versEditeur(contenu) {
  const corps = new DOMParser().parseFromString(contenu || '', 'text/html').body
  const textes = []
  const parcours = document.createTreeWalker(corps, NodeFilter.SHOW_TEXT)
  while (parcours.nextNode()) textes.push(parcours.currentNode)
  for (const t of textes) {
    const morceaux = t.textContent.split(VARIABLE)
    if (morceaux.length === 1) continue
    t.replaceWith(...morceaux.map((m, i) => {
      if (i % 2 === 0) return m
      const span = document.createElement('span')
      span.dataset.variable = m
      span.textContent = `{{${m}}}`
      return span
    }))
  }
  return corps.innerHTML
}

// Éditeur -> contenu enregistré : chaque variable redevient {{code}} dans le texte
export function depuisEditeur(html) {
  const corps = new DOMParser().parseFromString(html, 'text/html').body
  for (const span of corps.querySelectorAll('span[data-variable]')) span.replaceWith(`{{${span.dataset.variable}}}`)
  return corps.innerHTML
}
