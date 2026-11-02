import Icone from '../components/Icone'
import { filled, fmt, modaliteSequence, modDone, num, objList, SEQ_EVAL, SEQ_MODES } from './catalogue'

const R = <span className="req">*</span>

// Séquences du programme dans l'assistant (RG16 à RG22). progErr : les champs obligatoires vides passent en rouge.
function ProgrammeSequences({ q, form, progErr, onChange }) {
  const mods = form.values.modules || [], objs = objList(form.values)
  const total = mods.reduce((a, m) => a + num(m.duree), 0), duree = num(form.duree)
  // RG21 : avertissement (non bloquant) si le total ne correspond pas à la durée de la formation
  const ecart = duree && total && Math.abs(total - duree) > 0.01
  let etatDuree = null
  if (ecart) etatDuree = <span className="warnt">Le total ne correspond pas à la durée de la formation</span>
  else if (duree && total) etatDuree = <span className="okt"><Icone nom="check" taille={14} epaisseur={3} /> La durée correspond</span>

  const maj = (i, champ, valeur) => onChange(mods.map((m, j) => (j === i ? { ...m, [champ]: valeur } : m)))
  // RG20 : la modalité proposée suit celle de la formation
  const ajouter = () => {
    onChange([...mods, { seq: '', objectif: '', contenu: '', duree: '', modalite: modaliteSequence(form.modalite), activites: '', supports: '', evalseq: '' }])
    setTimeout(() => { const champs = document.querySelectorAll('[data-mf="seq"]'); const d = champs[champs.length - 1]; if (d) { d.focus(); d.scrollIntoView?.({ block: 'center' }) } }, 0)
  }
  const supprimer = (i) => onChange(mods.filter((_, j) => j !== i))

  const err = (m, k) => (progErr && !filled(m[k]) ? ' err' : '')
  const liste = (i, champ, options, cur, texte, obligatoire = true) => (
    <select className={`inp${obligatoire ? err({ [champ]: cur }, champ) : ''}`} data-mf={champ} value={cur || ''} onChange={(e) => maj(i, champ, e.target.value)}>
      <option value="">{texte}</option>
      {options.map((o) => <option key={o}>{o}</option>)}
      {cur && !options.includes(cur) && <option>{cur}</option>}
    </select>
  )

  return (
    <div className="q">
      <span className="ql">{q.label}</span>
      <span className="help">{q.help}</span>
      <div className="mods">
        {mods.length === 0 && <p className="seq-empty">Aucune séquence pour le moment. Ajoutez la première séquence de votre programme.</p>}
        {mods.map((m, i) => {
          const fait = modDone(m)
          const champ = (k, props = {}) => <input className={`inp${err(m, k)}`} data-mf={k} value={m[k] || ''} onChange={(e) => maj(i, k, e.target.value)} {...props} />
          return (
            <div className={`seq ${fait ? 'ok' : ''}`} id={`seq-${i}`} key={i /* NOSONAR : séquence modifiable sans identifiant, la position est la seule clé stable pendant la saisie */}>
              <div className="seq-head">
                <span className="modn">{fait ? <Icone nom="check" taille={14} epaisseur={3} /> : i + 1}</span><b>Séquence {i + 1}</b>
                {m.seq && <span className="seq-sub">{m.seq}</span>}
                <span className="seq-h">{m.duree ? `${fmt(num(m.duree))} h` : ''}</span>
                <button type="button" className="ms-btn del" aria-label={`Supprimer la séquence ${i + 1}`} onClick={() => supprimer(i)}><Icone nom="trash" taille={16} /></button>
              </div>
              {/* RG18 : titre, durée, objectif, modalité, contenu, méthodes obligatoires ; supports et évaluation facultatifs */}
              <div className="seq-grid">
                <label className="c2"><span className="lt">Titre de la séquence {R}</span>{champ('seq', { placeholder: 'Ex. : Recueillir les besoins' })}</label>
                <label><span className="lt">Durée (heures) {R}</span>{champ('duree', { inputMode: 'decimal', placeholder: 'Ex. : 3,5' })}</label>
                {/* RG19 : l'objectif visé se choisit parmi les objectifs du bloc Objectifs */}
                <label className="c2"><span className="lt">Objectif visé {R}</span>
                  {objs.length ? liste(i, 'objectif', objs, m.objectif, 'Choisir un objectif…') : champ('objectif', { placeholder: 'Remplissez d’abord le bloc Objectifs' })}</label>
                <label><span className="lt">Modalité {R}</span>{liste(i, 'modalite', SEQ_MODES, m.modalite, 'Choisir…')}</label>
                <label className="c3"><span className="lt">Contenu abordé {R}</span>
                  <textarea className={`inp${err(m, 'contenu')}`} rows={2} data-mf="contenu" value={m.contenu || ''} placeholder="Les notions et points traités dans la séquence" onChange={(e) => maj(i, 'contenu', e.target.value)} /></label>
                <label><span className="lt">Méthodes et activités {R}</span>{champ('activites', { placeholder: 'Ex. : jeux de rôle, étude de cas' })}</label>
                <label><span className="lt">Supports utilisés <span className="opt">facultatif</span></span><input className="inp" value={m.supports || ''} placeholder="Ex. : fiche outil, vidéo" onChange={(e) => maj(i, 'supports', e.target.value)} /></label>
                <label><span className="lt">Évaluation de la séquence <span className="opt">facultatif</span></span>{liste(i, 'evalseq', SEQ_EVAL, m.evalseq, 'Choisir…', false)}</label>
              </div>
            </div>
          )
        })}
        <button type="button" className="btn btn-outline seq-add" onClick={ajouter}><Icone nom="plus" taille={16} epaisseur={2.4} />Ajouter une séquence</button>
        <div className="seq-sum">
          <span><b>{mods.length}</b> séquence{mods.length > 1 ? 's' : ''}</span>
          <span>Total : <b>{fmt(total)} h</b>{duree ? ` sur ${fmt(duree)} h prévues` : ''}</span>
          {etatDuree}
        </div>
      </div>
    </div>
  )
}

export default ProgrammeSequences
