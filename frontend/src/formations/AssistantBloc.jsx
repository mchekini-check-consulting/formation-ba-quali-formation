import { useEffect, useRef, useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { SECTIONS, TILES, visibleQs } from './catalogue'
import ProgrammeSequences from './ProgrammeSequences'

// Zone de texte qui grandit avec son contenu (comme dans la maquette)
function ZoneTexte(props) {
  const ref = useRef(null)
  useEffect(() => { const ta = ref.current; ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 4}px` }, [props.value])
  return <textarea ref={ref} {...props} />
}

// RG11 : choix multiples dans une liste, avec des réponses « Autre » libres
function ChoixMultiples({ q, id, valeur, onChange, ouvert, onOuvrir, onFermer }) {
  const cur = valeur || []
  const [autre, setAutre] = useState(false)
  const [saisie, setSaisie] = useState('')
  const n = cur.filter((v) => String(v).trim()).length
  const basculer = (o) => onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])
  const ajouterAutre = () => { const v = saisie.trim(); if (v) { onChange([...cur, v]); setSaisie('') } }

  return (
    <div className="q">
      <label htmlFor={id}>{q.label}</label>
      <span className="help">Plusieurs choix possibles{q.help ? ` · ${q.help}` : ''}</span>
      <div className="dd">
        <button type="button" className={`dd-trigger ${ouvert ? 'open' : ''}`} id={id} aria-expanded={ouvert} aria-haspopup="listbox" onClick={() => { setAutre(false); if (ouvert) onFermer(); else onOuvrir() }}>
          <span>{n ? `${n} choix sélectionné${n > 1 ? 's' : ''}` : 'Choisir dans la liste'}</span><Icone nom="chev" taille={18} epaisseur={2.4} />
        </button>
        {ouvert && (
          <div className="dd-panel" role="listbox" aria-multiselectable="true" aria-label={q.label}>
            {q.options.map((o) => {
              const on = cur.includes(o)
              return <button type="button" key={o} className="dd-opt" role="option" aria-selected={on} onClick={() => basculer(o)}><span className="box">{on && <Icone nom="check" taille={14} epaisseur={3.2} />}</span>{o}</button>
            })}
            <div className="dd-sep"></div>
            {autre ? (
              <div className="dd-autre">
                <label htmlFor="dd-in">Autre : précisez votre réponse</label>
                <div className="dd-autre-row">
                  <input className="inp" id="dd-in" placeholder="Saisissez votre réponse" autoComplete="off" autoFocus value={saisie} onChange={(e) => setSaisie(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterAutre() } }} />
                  <button type="button" className="btn btn-primary" onClick={ajouterAutre}><Icone nom="plus" taille={16} epaisseur={2.6} />Ajouter</button>
                </div>
                <span className="help">Vous pouvez ajouter plusieurs réponses, une à la fois.</span>
              </div>
            ) : (
              <button type="button" className="dd-opt dd-other" onClick={() => setAutre(true)}><span className="box plus"><Icone nom="plus" taille={14} epaisseur={2.8} /></span>Autre (précisez)…</button>
            )}
            <div className="dd-foot"><button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Fermer la liste</button></div>
          </div>
        )}
      </div>
      {cur.length > 0 && (
        <ul className="sel">
          {cur.map((v, i) => q.options.includes(v) ? (
            <li className="sel-row" key={`${v}-${i}`}><span className="ck"><Icone nom="check" taille={14} epaisseur={3} /></span><span className="tx">{v}</span>
              <button type="button" className="ms-btn del" aria-label={`Retirer ${v}`} onClick={() => onChange(cur.filter((_, j) => j !== i))}><Icone nom="x" taille={16} epaisseur={2.4} /></button></li>
          ) : (
            <li className="sel-row other" key={`autre-${i}`}><span className="tag">Autre</span>
              <input className="inp" value={v} placeholder="Précisez…" aria-label="Autre réponse" onChange={(e) => onChange(cur.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="ms-btn del" aria-label="Retirer cette réponse" onClick={() => onChange(cur.filter((_, j) => j !== i))}><Icone nom="x" taille={16} epaisseur={2.4} /></button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Une question simple : texte, zone de texte, prix ou liste déroulante
function Question({ q, id, valeur, onChange }) {
  let ctl
  if (q.kind === 'text') ctl = <input className="inp big" id={id} value={valeur || ''} placeholder={q.ph || ''} onChange={(e) => onChange(e.target.value)} />
  if (q.kind === 'area') ctl = <ZoneTexte className="inp" rows={3} id={id} value={valeur || ''} placeholder={q.ph || ''} onChange={(e) => onChange(e.target.value)} />
  if (q.kind === 'money') ctl = <div className="money"><input id={id} inputMode="decimal" value={valeur || ''} placeholder={q.ph || ''} onChange={(e) => onChange(e.target.value)} /><span>€</span></div>
  if (q.kind === 'select') ctl = (
    <select className="inp big" id={id} value={valeur || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choisir…</option>{q.options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
  return <div className="q"><label htmlFor={id}>{q.label}</label>{q.help && <span className="help">{q.help}</span>}{ctl}</div>
}

// Assistant : une pop-up par bloc, avec les 3 parties en étapes (renderWiz de la maquette)
// index : bloc affiché ; onAller(i) : changer de bloc ; onFermer : terminer ; progErr : champs du programme en rouge
function AssistantBloc({ form, index, onValeur, onAller, onFermer, progErr, onSequences }) {
  const [liste, setListe] = useState(null) // clé de la question à choix multiples ouverte
  const t = TILES[index], vals = form.values, n = TILES.length
  // Le programme a sa propre pop-up : titre « Programme », sans les étapes des 3 parties
  const programme = t.id === 'programme'
  const aller = (i) => { setListe(null); onAller(i) }
  // Échap ferme d'abord la liste ouverte, puis l'assistant
  const fermer = () => { if (liste) setListe(null); else onFermer() }

  return (
    <Modal onFermer={fermer}>
      <div className={`wiz ws${t.sec} ${t.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="wt">
        <div className="wiz-head">
          <div className="wiz-top"><h2 id="wt">{programme ? 'Programme' : 'Informations de la formation'}</h2><button type="button" className="close" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} epaisseur={2.2} /></button></div>
          {!programme && <ol className="steps" aria-label="Étapes">
            {SECTIONS.map((s, i) => (
              <li key={s} className={i < t.sec ? 'done' : i === t.sec ? 'now' : ''}>
                <button type="button" className="step-btn" aria-current={i === t.sec ? 'step' : undefined} onClick={() => aller(TILES.findIndex((x) => x.sec === i))}>
                  <span className="n">{i < t.sec ? <Icone nom="check" taille={14} epaisseur={3} /> : i + 1}</span><span className="sl">{s}</span>
                </button><span className="bar"></span>
              </li>
            ))}
          </ol>}
        </div>
        <div className="wiz-body">
          <div className="wcard">
            <h3>{t.id === 'programme' ? 'Créer un programme' : t.title}</h3>
            <p className="hint">{t.hint}</p>
            {visibleQs(t, vals, form).map((q) => {
              const id = `w-${q.k}`
              if (q.kind === 'chips') return <ChoixMultiples key={q.k} q={q} id={id} valeur={vals[q.k]} onChange={(v) => onValeur(q.k, v)} ouvert={liste === q.k} onOuvrir={() => setListe(q.k)} onFermer={() => setListe(null)} />
              if (q.kind === 'modules') return <ProgrammeSequences key={q.k} q={q} form={form} progErr={progErr} onChange={onSequences} />
              return <Question key={q.k} q={q} id={id} valeur={vals[q.k]} onChange={(v) => onValeur(q.k, v)} />
            })}
          </div>
        </div>
        <div className="wiz-foot">
          <span className="note">Vos réponses sont gardées automatiquement.</span>
          <div className="r">
            <span className="note">Champ {index + 1} sur {n}</span>
            {index > 0 && <button type="button" className="btn btn-line" onClick={() => aller(index - 1)}>← Précédent</button>}
            {index < n - 1
              ? <button type="button" className="btn btn-primary" onClick={() => aller(index + 1)}>Suivant →</button>
              : <button type="button" className="btn btn-primary" onClick={onFermer}>Terminer</button>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default AssistantBloc
