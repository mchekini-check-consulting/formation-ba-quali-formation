import { useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icone from '../components/Icone'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/toastContext'
import { filled, fmt, frDate, MOD_LBL, MOD_REQ, MODALITES, missingTiles, num, SECTIONS, STATUS, TILES, tileDone, visibleQs } from '../formations/catalogue'
import AssistantBloc from '../formations/AssistantBloc'
import * as service from '../formations/donnees'

const NOUVELLE = { id: null, ref: '', title: '', duree: '', modalite: 'Présentiel', organisme: 'Cap Compétences', prepare: 'Camille Laurent', version: 1, statut: 'brouillon', values: {}, others: [], sess: [] }
const copie = (x) => JSON.parse(JSON.stringify(x))

// Aperçu de la réponse d'un bloc complet, affiché sur sa tuile
function apercu(t, vals, f) {
  for (const q of visibleQs(t, vals, f)) {
    if (q.kind === 'modules') {
      const m = (vals.modules || []).filter((x) => (x.seq || '').trim())
      if (m.length) return `${m.length} séquence${m.length > 1 ? 's' : ''} · ${fmt(m.reduce((a, x) => a + num(x.duree), 0))} h`
      continue
    }
    const v = vals[q.k]
    if (Array.isArray(v)) { const a = v.filter((x) => String(x).trim()); if (a.length) return a.slice(0, 2).join(', ') + (a.length > 2 ? ` +${a.length - 2}` : '') }
    else if (String(v ?? '').trim()) return q.kind === 'money' ? `${v} €` : String(v)
  }
  return ''
}

// RG22 : séquences dont des champs obligatoires sont vides
const sequencesIncompletes = (vals) => (vals.modules || [])
  .map((m, i) => ({ i, titre: String(m.seq || '').trim(), miss: MOD_REQ.filter((k) => !filled(m[k])).map((k) => MOD_LBL[k]) }))
  .filter((x) => x.miss.length)

// Pop-up « Ajouter une information » (RG12 : titre obligatoire)
function AutreInfoDialog({ onAjouter, onAnnuler }) {
  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  return (
    <Modal onFermer={onAnnuler}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="do" onSubmit={(e) => { e.preventDefault(); if (titre.trim()) onAjouter({ titre: titre.trim(), contenu: contenu.trim() || '—' }) }}>
        <h2 id="do">Ajouter une information</h2>
        <div className="field"><label className="lbl" htmlFor="o-t">Titre de l'information</label><input className="inp" id="o-t" placeholder="Ex. : Matériel à apporter" required autoFocus value={titre} onChange={(e) => setTitre(e.target.value)} /></div>
        <div className="field"><label className="lbl" htmlFor="o-c">Contenu</label><textarea className="inp" id="o-c" rows={4} placeholder="Ex. : Ordinateur portable avec Excel installé." value={contenu} onChange={(e) => setContenu(e.target.value)} /></div>
        <div className="foot"><button type="button" className="btn btn-line" onClick={onAnnuler}>Annuler</button><button type="submit" className="btn btn-primary">Ajouter</button></div>
      </form>
    </Modal>
  )
}

function FormationForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const toast = useToast()
  const retour = state?.retour || '/formations'

  const [form, setForm] = useState(null)
  const [instantane, setInstantane] = useState('')   // formulaire tel qu'enregistré, pour détecter les modifications (RG05)
  const [signaler, setSignaler] = useState(params.get('signaler') === '1') // blocs manquants en pointillés
  const [erreurBase, setErreurBase] = useState(false)
  const [assistant, setAssistant] = useState(null)   // index du bloc ouvert dans l'assistant
  const [progErr, setProgErr] = useState(false)
  const [dialogue, setDialogue] = useState(null)
  const enregistre = useRef(false)
  const contenuRef = useRef(null)

  // Chargement : formation existante ou nouvelle ; ?bloc= ouvre directement un bloc
  useEffect(() => {
    let actif = true
    const charger = id ? service.obtenirFormation(id) : Promise.resolve(copie(NOUVELLE))
    charger.then((f) => {
      if (!actif) return
      f.values = f.values || {}; f.others = f.others || []
      setForm(f); setInstantane(JSON.stringify(f))
      const bloc = TILES.findIndex((t) => t.id === params.get('bloc'))
      if (bloc >= 0) setAssistant(bloc)
    }).catch(() => navigate('/formations', { replace: true }))
    return () => { actif = false }
  }, [id, params, navigate])

  const modifie = form !== null && JSON.stringify(form) !== instantane

  // RG05 : confirmation si on quitte la page avec des modifications non enregistrées
  const bloqueur = useBlocker(({ currentLocation, nextLocation }) => modifie && !enregistre.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!modifie) return
    const avant = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avant)
    return () => window.removeEventListener('beforeunload', avant)
  }, [modifie])

  if (!form) return <div className="wrap"><p className="chargement">Chargement de la formation…</p></div>

  const edit = !!form.id, vals = form.values
  const miss = missingTiles(form), doneN = TILES.length - miss.length, pct = Math.round((doneN / TILES.length) * 100)
  const nbSessions = (form.sess || []).length
  const maj = (champs) => setForm((f) => ({ ...f, ...champs }))
  const majValeur = (k, v) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }))

  // ---------- Assistant ----------
  const ouvrirBloc = (i) => { setProgErr(false); setAssistant(i) }
  // RG22 : en quittant le programme (Suivant, Précédent, Terminer, fermeture), les champs obligatoires sont contrôlés
  const garde = (suite) => {
    if (TILES[assistant]?.id === 'programme' && sequencesIncompletes(form.values).length) { setDialogue({ type: 'programme', suite }); return }
    suite()
  }
  const allerBloc = (i) => garde(() => ouvrirBloc(i))
  const fermerAssistant = () => garde(() => { setAssistant(null); setProgErr(false) })

  // ---------- Enregistrement ----------
  const persister = async (statut, message) => {
    try {
      const f = await service.enregistrerFormation(form, statut)
      enregistre.current = true
      navigate(edit ? retour : '/formations')
      toast(message(f))
    } catch (e) {
      toast(e.message)
    }
  }
  const baseOk = () => form.title.trim() && num(form.duree) > 0 && form.modalite
  // RG02 : en brouillon, seul l'intitulé est obligatoire
  const brouillon = () => {
    if (!form.title.trim()) { setErreurBase(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    persister(form.statut === 'archivee' ? 'archivee' : 'brouillon', (f) => `« ${f.title} » est enregistrée en brouillon.`)
  }
  // RG13 à RG15 : validée si tout est complet, sinon pop-up puis « Incomplète selon Qualiopi »
  const terminerValidation = () => {
    if (miss.length) persister('incomplete', (f) => `« ${f.title} » est enregistrée comme incomplète : ${miss.length} bloc${miss.length > 1 ? 's' : ''} à compléter pour Qualiopi.`)
    else persister('validee', (f) => (edit ? `« ${f.title} » a été modifiée et validée.` : `« ${f.title} » est validée : toutes les informations Qualiopi sont renseignées.`))
  }
  const valider = () => {
    if (!baseOk()) { setErreurBase(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    if (miss.length) setDialogue({ type: 'valider' })
    else terminerValidation()
  }
  const quitter = () => { if (modifie) setDialogue({ type: 'quitter' }); else navigate(retour) }

  const tErr = erreurBase && !form.title.trim(), dErr = erreurBase && !(num(form.duree) > 0)

  return (
    <div className="wrap">
      <div>
        <div className="topnav">
          <button type="button" className="back-btn" onClick={quitter}><Icone nom="back" taille={18} epaisseur={2.4} /><span>Retour</span></button>
          <nav className="crumb" aria-label="Fil d'Ariane"><button type="button" className="crumb-link" onClick={quitter}>Formations</button><span aria-hidden="true">›</span><span>{edit ? 'Modifier' : 'Nouvelle formation'}</span></nav>
        </div>
        <div className="page-head" style={{ marginTop: 6 }}>
          <h1>{edit ? (form.title || 'Modifier la formation') : 'Nouvelle formation'}</h1>
          {edit && <span className={`pill ${STATUS[form.statut][1]}`}>{STATUS[form.statut][0]}</span>}
        </div>
      </div>

      {erreurBase && (tErr || dErr) && <div className="banner err" role="alert"><Icone nom="info" taille={20} /><span><b>Impossible de valider.</b> Renseignez l'intitulé et une durée supérieure à 0.</span></div>}
      {edit && form.statut === 'incomplete' && miss.length > 0 && (
        <div className="dw-alert" style={{ marginTop: 0 }}><Icone nom="info" taille={20} /><span><b>Formation incomplète :</b> {miss.length} bloc{miss.length > 1 ? 's manquent' : ' manque'} pour répondre aux exigences de l’audit Qualiopi. Complétez-{miss.length > 1 ? 'les' : 'le'} puis validez.</span></div>
      )}
      {/* RG06 : les changements s'appliqueront aux prochaines sessions */}
      {edit && nbSessions > 0 && <div className="banner info"><Icone nom="info" taille={20} /><span><b>Cette formation a {nbSessions} session{nbSessions > 1 ? 's' : ''}.</b> Les changements s'appliqueront aux prochaines sessions.</span></div>}

      <section className="card sec" aria-labelledby="h-base">
        <div className="sec-head"><h2 id="h-base">Informations de base</h2></div>
        <div className="ident" aria-label="Identification de la fiche">
          <span><b>Référence</b> {form.ref || 'attribuée à l’enregistrement'}</span>
          <span><b>Version</b> {form.version || 1}</span>
          <span><b>Organisme</b> {form.organisme || 'Cap Compétences'}</span>
          <span><b>Préparée par</b> {form.prepare || 'Camille Laurent'}</span>
          {form.created && <span><b>Créée le</b> {frDate(form.created)}</span>}
          {form.maj && <span><b>Mise à jour le</b> {frDate(form.maj)}</span>}
        </div>
        <div className="grid-base">
          <div className="field full">
            <label className="lbl" htmlFor="f-title">Intitulé de la formation <span className="req">*</span></label>
            <input className={`inp ${tErr ? 'err' : ''}`} id="f-title" value={form.title} placeholder="Ex. : Management d'équipe — niveau 2" onChange={(e) => maj({ title: e.target.value })} />
            {tErr && <span className="errtxt">Ce champ est obligatoire.</span>}
          </div>
          <div className="field">
            <label className="lbl" htmlFor="f-duree">Durée (en heures) <span className="req">*</span></label>
            <input className={`inp ${dErr ? 'err' : ''}`} id="f-duree" inputMode="decimal" value={form.duree} placeholder="Ex. : 14" onChange={(e) => maj({ duree: e.target.value })} />
            {dErr && <span className="errtxt">Indiquez une durée supérieure à 0.</span>}
          </div>
          <div className="field" style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <span className="lbl" id="l-mod">Modalité <span className="req">*</span></span>
            <div className="radios" role="radiogroup" aria-labelledby="l-mod">
              {MODALITES.map((m) => <label className="radio" key={m}><input type="radio" name="modalite" value={m} checked={form.modalite === m} onChange={() => maj({ modalite: m })} />{m}</label>)}
            </div>
          </div>
        </div>
      </section>

      <section className="card sec" aria-labelledby="h-cont" ref={contenuRef}>
        <div className="sec-head">
          <div><h2 id="h-cont">Contenu de la formation</h2><p className="sub" style={{ marginTop: 4 }}>{doneN === TILES.length ? 'Tout est rempli, votre formation est prête à être validée.' : 'Cliquez sur un bloc pour le remplir. Vos réponses sont gardées à chaque étape.'}</p></div>
          <div className="prog" aria-label={`${doneN} blocs complétés sur ${TILES.length}`}><div className="prog-t"><b>{doneN}</b> / {TILES.length} blocs complétés</div><div className="prog-bar"><i style={{ width: `${pct}%` }}></i></div></div>
        </div>
        {signaler && miss.length > 0 && !(edit && form.statut === 'incomplete') && (
          <div className="banner warn" role="status"><b>{miss.length} champ{miss.length > 1 ? 's restent' : ' reste'} à remplir.</b> {miss.length > 1 ? 'Ils sont signalés' : 'Il est signalé'} avec un cadre en pointillés.</div>
        )}
        {/* RG07 : les blocs en 3 parties (le programme a son propre bouton) */}
        {SECTIONS.map((nom, si) => {
          const ts = TILES.filter((t) => t.sec === si && t.id !== 'programme'), dn = ts.filter((t) => tileDone(t, vals, form)).length
          return (
            <div className={`tgroup acc${si}`} key={nom}>
              <div className="tg-head"><h3><span className="tg-n">{si + 1}</span>{nom}</h3><span className="tg-line" aria-hidden="true"></span><span className={`tg-c ${dn === ts.length ? 'ok' : ''}`}>{dn} / {ts.length}</span></div>
              <div className="tiles">
                {ts.map((t) => {
                  const done = tileDone(t, vals, form), pv = done ? apercu(t, vals, form) : ''
                  return (
                    <button type="button" key={t.id} className={`tile acc${t.sec} ${done ? 'done' : ''} ${!done && signaler ? 'flag' : ''}`} aria-label={`${t.title} : ${done ? 'complété' : 'à remplir'}`} title={pv || undefined} onClick={() => ouvrirBloc(TILES.indexOf(t))}>
                      <span className="ti"><Icone nom={t.id} taille={22} /></span><span className="tn">{t.title}</span>
                      {done && <span className="tick" aria-hidden="true"><Icone nom="check" taille={12} epaisseur={3.4} /></span>}
                    </button>
                  )
                })}
                {si === 2 && <button type="button" className="tile acc2" onClick={() => setDialogue({ type: 'autre' })}><span className="ti"><Icone nom="plus" taille={22} epaisseur={2.4} /></span><span className="tn">Ajouter une autre information</span></button>}
              </div>
            </div>
          )
        })}
      </section>

      <section className="card sec" aria-label="Programme et autres informations">
        {/* RG17 : le programme se crée avec le bouton « Créer un programme » */}
        <button type="button" className="prog-cta" onClick={() => ouvrirBloc(TILES.findIndex((t) => t.id === 'programme'))}>
          <span className="pc-ic"><Icone nom="programme" taille={24} epaisseur={2.2} /></span>
          <span className="pc-t"><b>Créer un programme</b><small>{apercu(TILES.find((t) => t.id === 'programme'), vals, form) || 'Le déroulé de la formation, séquence par séquence, relié aux objectifs.'}</small></span>
          <span className="pc-go"><Icone nom="arrow" taille={20} epaisseur={2.4} /></span>
        </button>
        {form.others.length > 0 && (
          <div className="others">
            {form.others.map((o, i) => (
              <div className="other" key={i}>
                <span className="ti"><Icone nom="doc" taille={20} /></span><div><b>{o.titre}</b><span>{o.contenu}</span></div>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Retirer ${o.titre}`} onClick={() => maj({ others: form.others.filter((_, j) => j !== i) })}><Icone nom="x" taille={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="actionbar">
        <button type="button" className="btn btn-ghost" onClick={quitter}><Icone nom="x" taille={18} epaisseur={2.2} />Quitter sans sauvegarder</button>
        <div className="r">
          <button type="button" className="btn btn-outline" onClick={brouillon}>Enregistrer en brouillon</button>
          <button type="button" className="btn btn-primary" onClick={valider}><Icone nom="check" taille={18} epaisseur={2.6} />Valider</button>
        </div>
      </div>

      {assistant !== null && !dialogue && (
        <AssistantBloc form={form} index={assistant} progErr={progErr} onValeur={majValeur} onAller={allerBloc} onFermer={fermerAssistant}
          onSequences={(modules) => majValeur('modules', modules)} />
      )}

      {dialogue?.type === 'autre' && <AutreInfoDialog onAnnuler={() => setDialogue(null)} onAjouter={(o) => { maj({ others: [...form.others, o] }); setDialogue(null) }} />}

      {/* RG14 : liste des blocs manquants, « Compléter » ou « Valider quand même » */}
      {dialogue?.type === 'valider' && (
        <Modal onFermer={() => setDialogue(null)} classeFond="ov-valid">
          <div className="dialog dlg-warn" role="dialog" aria-modal="true" aria-labelledby="dv">
            <div className="dw-head"><span className="dw-ic"><Icone nom="alert" taille={24} /></span><div><h2 id="dv">Votre formation n’est pas complète</h2><p>{miss.length} bloc{miss.length > 1 ? 's ne sont pas remplis' : ' n’est pas rempli'}.</p></div></div>
            <div className="dw-alert" role="alert"><Icone nom="info" taille={20} /><span><b>Attention :</b> si vous validez maintenant, cette formation ne contiendra pas toutes les informations demandées lors de l’audit Qualiopi. Elle sera enregistrée avec le statut <b>« Incomplète »</b>.</span></div>
            <p className="dw-lead">Blocs à compléter — cliquez sur un bloc pour le remplir :</p>
            <ul className="misslist">
              {miss.map((t) => (
                <li key={t.id}><button type="button" className="mi" onClick={() => { setDialogue(null); ouvrirBloc(TILES.indexOf(t)) }}>
                  <span className="mi-ic"><Icone nom={t.id} taille={18} /></span><span className="mi-t">{t.title}</span><span className="mi-go">Remplir <Icone nom="arrow" taille={14} epaisseur={2.4} /></span>
                </button></li>
              ))}
            </ul>
            <div className="foot">
              <button type="button" className="btn btn-line" onClick={() => { setDialogue(null); terminerValidation() }}>Valider quand même</button>
              <button type="button" className="btn btn-primary" autoFocus onClick={() => { setDialogue(null); setSignaler(true); contenuRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }}>Compléter la formation</button>
            </div>
          </div>
        </Modal>
      )}

      {/* RG22 : programme incomplet en quittant l'étape */}
      {dialogue?.type === 'programme' && (() => {
        const seqs = sequencesIncompletes(form.values), nf = seqs.reduce((a, x) => a + x.miss.length, 0)
        const completer = (i) => {
          setDialogue(null); setProgErr(true)
          setTimeout(() => { const s = document.getElementById(`seq-${i ?? seqs[0].i}`); if (s) { s.scrollIntoView?.({ block: 'center' }); s.querySelector('.inp.err')?.focus({ preventScroll: true }) } }, 50)
        }
        // Les séquences incomplètes ne sont pas gardées
        const quitterSansProgramme = () => { majValeur('modules', (form.values.modules || []).filter((m) => MOD_REQ.every((k) => filled(m[k])))); setDialogue(null); setProgErr(false); setAssistant(null) }
        return (
          <Modal onFermer={() => completer()}>
            <div className="dialog dlg-warn" role="dialog" aria-modal="true" aria-labelledby="pg">
              <div className="dw-head"><span className="dw-ic"><Icone nom="alert" taille={24} /></span><div><h2 id="pg">Le programme n’est pas complet</h2><p>{nf} champ{nf > 1 ? 's' : ''} obligatoire{nf > 1 ? 's' : ''} à remplir dans {seqs.length} séquence{seqs.length > 1 ? 's' : ''}.</p></div></div>
              <div className="dw-alert" role="alert"><Icone nom="info" taille={20} /><span>Pour créer le programme, tous les champs marqués <b>*</b> doivent être remplis dans chaque séquence.</span></div>
              <p className="dw-lead">Champs manquants — cliquez sur une séquence pour la compléter :</p>
              <ul className="misslist one">
                {seqs.map((x) => (
                  <li key={x.i}><button type="button" className="mi" onClick={() => completer(x.i)}>
                    <span className="mi-ic"><Icone nom="programme" taille={18} /></span><span className="mi-t">Séquence {x.i + 1}{x.titre ? ` — ${x.titre}` : ''}<small>{x.miss.join(' · ')}</small></span><span className="mi-go">Compléter <Icone nom="arrow" taille={14} epaisseur={2.4} /></span>
                  </button></li>
                ))}
              </ul>
              <div className="foot">
                <button type="button" className="btn btn-line" onClick={quitterSansProgramme}>Quitter sans enregistrer le programme</button>
                <button type="button" className="btn btn-primary" autoFocus onClick={() => completer()}>Compléter le programme</button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* RG05 : quitter avec des modifications non enregistrées */}
      {(dialogue?.type === 'quitter' || bloqueur.state === 'blocked') && (
        <ConfirmDialog titre="Quitter sans sauvegarder ?" texte="Vos modifications seront perdues. Pour les garder, enregistrez la formation en brouillon."
          action="Quitter sans sauvegarder" danger icone="x" fondIcone="var(--danger-soft)" couleurIcone="var(--danger)"
          onAnnuler={() => { setDialogue(null); if (bloqueur.state === 'blocked') bloqueur.reset() }}
          onOk={() => { setDialogue(null); enregistre.current = true; if (bloqueur.state === 'blocked') bloqueur.proceed(); else navigate(retour) }} />
      )}
    </div>
  )
}

export default FormationForm
