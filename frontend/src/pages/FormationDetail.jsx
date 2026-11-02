import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { fmt, frDate, life, missingTiles, num, one, SECTIONS, TILES, tileDone, visibleQs } from '../formations/catalogue'
import Illustration from '../formations/Illustration'
import * as service from '../formations/donnees'

const ETAT = { brouillon: ['Brouillon', 'lc-draft', 'pen'], incomplete: ['Incomplète selon Qualiopi', 'lc-inc', 'alert'], apublier: ['Validée', 'lc-ready', 'check'] }

// Valeur d'une question, affichée selon son type
function Valeur({ q, v }) {
  const a = one(v[q.k])
  if (q.kind === 'chips') return <div className="dt-chips">{a.map((x) => <span key={x}>{x}</span>)}</div>
  if (q.kind === 'money') return <p className="dt-txt"><b>{a[0]} € {one(v.taxe)[0] || ''}</b>{one(v.unite)[0] && <> <span className="dt-u">{one(v.unite)[0].toLowerCase()}</span></>}</p>
  return <p className="dt-txt">{a.join(', ')}</p>
}

// Programme : la frise des séquences
function Sequences({ v }) {
  const m = (v.modules || []).filter((x) => (x.seq || '').trim())
  if (!m.length) return null
  const total = m.reduce((s, x) => s + num(x.duree), 0)
  return <>
    <ol className="dt-tl">
      {m.map((x, i) => (
        <li key={`${x.seq}-${x.duree}-${x.objectif}`}><span className="tl-n">{i + 1}</span>
          <div className="tl-b">
            <div className="tl-h"><b>{x.seq}</b><span className="tl-d"><Icone nom="clock" taille={13} />{x.duree || '—'} h</span>{x.modalite && <span className="tl-m">{x.modalite}</span>}</div>
            {x.objectif && <p className="tl-o"><Icone nom="target" taille={14} /><span>{x.objectif}</span></p>}
            {x.contenu && <p>{x.contenu}</p>}
            <div className="tl-meta">
              {x.activites && <span><b>Activités :</b> {x.activites}</span>}
              {x.supports && <span><b>Supports :</b> {x.supports}</span>}
              {x.evalseq && <span><b>Évaluation :</b> {x.evalseq}</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
    <p className="dt-total">{m.length} séquence{m.length > 1 ? 's' : ''} · <b>{fmt(total)} h</b> au total</p>
  </>
}

function FormationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [f, setF] = useState(null)
  const [manques, setManques] = useState(false)

  useEffect(() => {
    service.obtenirFormation(id).then(setF).catch(() => navigate('/formations', { replace: true }))
  }, [id, navigate])

  if (!f) return <div className="wrap"><p className="chargement">Chargement de la formation…</p></div>

  const v = f.values || {}, miss = missingTiles(f), done = TILES.length - miss.length, pct = Math.round((done / TILES.length) * 100)
  const st = ETAT[life(f)]
  const prix = v.tarif ? `${v.tarif} € ${one(v.taxe)[0] || ''}`.trim() : ''
  const sess = f.sess || []
  const retour = { state: { retour: `/formations/${f.id}` } }
  // RG39 : « Compléter » ouvre directement le bloc concerné
  const completer = (t) => navigate(`/formations/${f.id}/modifier?bloc=${t.id}&signaler=1`, retour)

  const aCompleter = (t) => (
    <div className="dt-empty"><Icone nom="alert" taille={16} epaisseur={2.2} /><span>Non renseigné</span>
      <button type="button" className="dt-fix" aria-label={`Compléter : ${t.title}`} onClick={() => completer(t)}>Compléter</button></div>
  )
  const bloc = (t) => {
    const ok = tileDone(t, v, f)
    let corps = null
    if (t.id === 'programme') corps = <Sequences v={v} />
    else if (t.id === 'objectifs') {
      const o = String(v.objectifs || '').split(/[\n;]/).map((x) => x.trim()).filter(Boolean)
      if (o.length) corps = <ul className="dt-obj">{o.map((x) => <li key={x}><Icone nom="check" taille={15} epaisseur={2.6} /><span>{x[0].toUpperCase() + x.slice(1)}</span></li>)}</ul>
    } else {
      const lignes = visibleQs(t, v, f).filter((q) => q.k !== 'unite' && q.k !== 'taxe' && one(v[q.k]).length)
      if (lignes.length) corps = lignes.map((q) => <div className="dt-row" key={q.k}><span className="dt-k">{q.label.replace(/\?$/, '').trimEnd()}</span><Valeur q={q} v={v} /></div>)
    }
    return (
      <section className="dt-card" id={`s-${t.id}`} data-t={t.id} key={t.id}>
        <header><span className="dt-ic"><Icone nom={t.id} taille={18} /></span><h3>{t.title}</h3>
          {ok ? <span className="dt-ok"><Icone nom="check" taille={12} epaisseur={3} />Complet</span> : <span className="dt-ko">À compléter</span>}</header>
        {corps}
        {!ok && (corps ? <div className="dt-partial">{aCompleter(t)}</div> : aCompleter(t))}
      </section>
    )
  }
  const fait = (ic, k, val) => <div className="fact"><span className="fact-ic"><Icone nom={ic} taille={18} /></span><div><small>{k}</small><b>{val}</b></div></div>
  const publics = one(v.public)

  return (
    <div className="wrap">
      <div className="topnav">
        <button type="button" className="back-btn" onClick={() => navigate('/formations')}><Icone nom="back" taille={18} epaisseur={2.4} /><span>Retour</span></button>
        <nav className="crumb" aria-label="Fil d'Ariane"><Link to="/formations">Formations</Link><span aria-hidden="true">›</span><span>{f.title}</span></nav>
      </div>
      <header className="dt-hero">
        <div className="dt-cov"><Illustration formation={f} large /></div>
        <div className="dt-hb">
          <div className="dt-tags"><span className={`lc ${st[1]}`}><Icone nom={st[2]} taille={14} epaisseur={2.4} />{st[0]}</span><span className="dt-tag">{f.modalite}</span>{f.ref && <span className="dt-tag">{f.ref}</span>}</div>
          <h1>{f.title}</h1>
          <p className="dt-sub">Version {f.version || 1} · mise à jour le {frDate(f.maj)}{f.prepare ? ` · par ${f.prepare}` : ''}</p>
          <div className="dt-facts">
            {fait('clock', 'Durée', `${f.duree || '—'} heures`)}
            {fait('organisation', 'Modalité', f.modalite)}
            {prix && fait('tarif', 'Prix', <>{prix}{v.unite && <> <span className="u">/ {String(v.unite).replace('Par ', '').toLowerCase()}</span></>}</>)}
            {sess.length > 0 && fait('cal', 'Sessions', `${sess.length} session${sess.length > 1 ? 's' : ''}`)}
            {publics.length > 0 && fait('public', 'Public', publics.slice(0, 2).join(', ') + (publics.length > 2 ? ' …' : ''))}
          </div>
        </div>
        <div className="dt-actions">
          <button type="button" className="btn btn-line" onClick={() => window.print()}><Icone nom="doc" taille={16} />Exporter en PDF</button>
        </div>
      </header>

      {/* RG40 : indicateur X / 13 et liste de ce qui manque */}
      {miss.length > 0 && (
        <button type="button" className="dt-score card dt-score-wide" onClick={() => setManques(true)}>
          <div className="ring2" style={{ '--p': pct }}><span><b>{done}</b>/{TILES.length}</span></div>
          <div><b>Fiche Qualiopi incomplète</b><small>{miss.length} bloc{miss.length > 1 ? 's' : ''} à compléter</small><span className="dt-see">Voir ce qui manque <Icone nom="arrow" taille={14} epaisseur={2.4} /></span></div>
        </button>
      )}

      <div className="dt-layout">
        <div className="dt-main">
          {SECTIONS.map((nom, si) => (
            <div className={`dt-group dg${si}`} key={nom}><h2><span>{si + 1}</span>{nom}</h2>{TILES.filter((t) => t.sec === si).map(bloc)}</div>
          ))}
          {(f.others || []).length > 0 && (
            <div className="dt-group"><h2><span>+</span>Autres informations</h2>
              <section className="dt-card">{f.others.map((o) => <div className="dt-row" key={`${o.titre}-${o.contenu}`}><span className="dt-k">{o.titre}</span><p className="dt-txt">{o.contenu}</p></div>)}</section>
            </div>
          )}
        </div>
      </div>

      {manques && (
        <Modal onFermer={() => setManques(false)}>
          <dialog open className="dialog dlg-warn" aria-modal="true" aria-labelledby="mm">
            <div className="dw-head"><span className="dw-ic"><Icone nom="alert" taille={24} /></span><div><h2 id="mm">Ce qu’il manque pour Qualiopi</h2><p>{miss.length} bloc{miss.length > 1 ? 's' : ''} à compléter</p></div></div>
            <p className="dw-lead">Cliquez sur un bloc pour le remplir :</p>
            <ul className="misslist">
              {miss.map((t) => (
                <li key={t.id}><button type="button" className="mi" onClick={() => completer(t)}><span className="mi-ic"><Icone nom={t.id} taille={18} /></span><span className="mi-t">{t.title}</span><span className="mi-go">Remplir <Icone nom="arrow" taille={14} epaisseur={2.4} /></span></button></li>
              ))}
            </ul>
            <div className="foot"><button type="button" className="btn btn-line" onClick={() => setManques(false)} autoFocus>Fermer</button></div>
          </dialog>
        </Modal>
      )}
    </div>
  )
}

export default FormationDetail
