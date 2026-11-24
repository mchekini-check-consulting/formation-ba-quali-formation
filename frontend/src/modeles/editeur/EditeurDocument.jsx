import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { useMemo } from 'react'
import { depuisEditeur, extensionsEditeur, versEditeur } from './extensions'

// SCRUM-213 « Modifier un modèle dans l'éditeur » (maquette SCRUM-213-1) : barre de mise en forme et document A4.
// Réutilisable : modèle générique (SCRUM-213) et modèle de la formation (SCRUM-219). Rien n'est enregistré ici
// (RG8) : la page reçoit chaque modification par `onModification` et l'envoie seulement sur « Enregistrer ».

// Icônes de la barre (traits 24 × 24)
const TRACES = {
  annuler: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  retablir: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  gras: 'M6 12h9a4 4 0 0 1 0 8H6V4h8a4 4 0 0 1 0 8',
  italique: 'M19 4h-9M14 20H5M15 4 9 20',
  souligne: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  barre: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  couleur: 'm6 16 6-12 6 12M8 12h8',
  gauche: 'M21 6H3M15 12H3M17 18H3',
  centre: 'M21 6H3M17 12H7M19 18H5',
  droite: 'M21 6H3M21 12H9M21 18H7',
  justifie: 'M21 6H3M21 12H3M21 18H3',
  puces: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  numeros: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  effacer: 'M4 7V4h16v3M5 20h6M13 4 8 20M15 15l5 5M20 15l-5 5',
}

function Trace({ nom }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TRACES[nom]} /></svg>
  )
}

// Bouton de la barre : info-bulle, mis en évidence quand le style est appliqué (CA1)
function Bouton({ libelle, raccourci, icone, actif, inactif, action }) {
  return (
    <button type="button" className={`edt-btn${actif ? ' on' : ''}`} aria-label={libelle} aria-pressed={actif}
      title={raccourci ? `${libelle} (${raccourci})` : libelle} disabled={inactif}
      onMouseDown={(e) => e.preventDefault()} onClick={action}>
      <Trace nom={icone} />
    </button>
  )
}

const STYLES = [{ valeur: 'p', libelle: 'Texte normal' }, { valeur: 'h1', libelle: 'Titre 1' }, { valeur: 'h3', libelle: 'Titre 2' }]
const ALIGNEMENTS = [
  { valeur: 'left', libelle: 'Aligner à gauche', icone: 'gauche' },
  { valeur: 'center', libelle: 'Centrer', icone: 'centre' },
  { valeur: 'right', libelle: 'Aligner à droite', icone: 'droite' },
  { valeur: 'justify', libelle: 'Justifier', icone: 'justifie' },
]
const HEXA = /^#[0-9a-f]{6}$/i

function etatBarre({ editor: e }) {
  let style = 'p'
  if (e.isActive('heading', { level: 1 })) style = 'h1'
  else if (e.isActive('heading', { level: 3 })) style = 'h3'
  const couleur = e.getAttributes('textStyle').color
  return {
    style, couleur: HEXA.test(couleur || '') ? couleur : '#111827',
    gras: e.isActive('bold'), italique: e.isActive('italic'), souligne: e.isActive('underline'), barre: e.isActive('strike'),
    alignement: ALIGNEMENTS.find((a) => e.isActive({ textAlign: a.valeur }))?.valeur,
    puces: e.isActive('bulletList'), numeros: e.isActive('orderedList'),
    annuler: e.can().undo(), retablir: e.can().redo(),
  }
}

function BarreMiseEnForme({ editor }) {
  const etat = useEditorState({ editor, selector: etatBarre })
  const suite = () => editor.chain().focus()
  const choisirStyle = (valeur) => {
    if (valeur === 'p') suite().setParagraph().run()
    else suite().setHeading({ level: Number(valeur[1]) }).run()
  }
  return (
    <div className="edt-barre" role="toolbar" aria-label="Mise en forme">
      <Bouton libelle="Annuler" raccourci="Ctrl+Z" icone="annuler" inactif={!etat.annuler} action={() => suite().undo().run()} />
      <Bouton libelle="Rétablir" raccourci="Ctrl+Y" icone="retablir" inactif={!etat.retablir} action={() => suite().redo().run()} />
      <span className="edt-sep" aria-hidden="true" />
      <select className="edt-style" aria-label="Style du paragraphe" title="Style du paragraphe" value={etat.style}
        onChange={(e) => choisirStyle(e.target.value)}>
        {STYLES.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
      </select>
      <span className="edt-sep" aria-hidden="true" />
      <Bouton libelle="Gras" raccourci="Ctrl+B" icone="gras" actif={etat.gras} action={() => suite().toggleBold().run()} />
      <Bouton libelle="Italique" raccourci="Ctrl+I" icone="italique" actif={etat.italique} action={() => suite().toggleItalic().run()} />
      <Bouton libelle="Souligné" raccourci="Ctrl+U" icone="souligne" actif={etat.souligne} action={() => suite().toggleUnderline().run()} />
      <Bouton libelle="Barré" icone="barre" actif={etat.barre} action={() => suite().toggleStrike().run()} />
      <label className="edt-btn edt-couleur" title="Couleur du texte">
        <Trace nom="couleur" />
        <span className="edt-couleur-barre" style={{ background: etat.couleur }} aria-hidden="true" />
        <input type="color" aria-label="Couleur du texte" value={etat.couleur}
          onChange={(e) => suite().setColor(e.target.value).run()} />
      </label>
      <span className="edt-sep" aria-hidden="true" />
      {ALIGNEMENTS.map((a) => (
        <Bouton key={a.valeur} libelle={a.libelle} icone={a.icone} actif={etat.alignement === a.valeur}
          action={() => suite().setTextAlign(a.valeur).run()} />
      ))}
      <span className="edt-sep" aria-hidden="true" />
      <Bouton libelle="Liste à puces" icone="puces" actif={etat.puces} action={() => suite().toggleBulletList().run()} />
      <Bouton libelle="Liste numérotée" icone="numeros" actif={etat.numeros} action={() => suite().toggleOrderedList().run()} />
      <span className="edt-sep" aria-hidden="true" />
      <Bouton libelle="Effacer la mise en forme" icone="effacer"
        action={() => suite().unsetAllMarks().clearNodes().unsetTextAlign().run()} />
    </div>
  )
}

// `contenu` : HTML du modèle ({{code}} pour les variables) ; `variables` : [{ code, libelle }] pour les étiquettes.
// Le contenu n'est lu qu'à l'ouverture : pour un autre document, changer la `key` du composant.
export function EditeurDocument({ contenu, variables = [], onModification, nom = 'Document' }) {
  const libelles = useMemo(() => Object.fromEntries(variables.map((v) => [v.code, v.libelle])), [variables])
  const editor = useEditor({
    extensions: extensionsEditeur(libelles),
    content: versEditeur(contenu),
    editorProps: { attributes: { class: 'doc-feuille edt-feuille', role: 'textbox', 'aria-multiline': 'true', 'aria-label': nom } },
    onUpdate: ({ editor: e }) => onModification?.(depuisEditeur(e.getHTML())),
  }, [])
  if (!editor) return null
  return (
    <div className="edt">
      <BarreMiseEnForme editor={editor} />
      <div className="doc-zone edt-zone"><EditorContent editor={editor} /></div>
    </div>
  )
}
