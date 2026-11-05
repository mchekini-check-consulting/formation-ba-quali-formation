import { useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { frDate, hasProg, LC, life, money, pluriel, today } from './catalogue'
import Illustration from './Illustration'
import { artAccent } from './themes'

const ICONE_MODALITE = { Présentiel: 'organisation', Distanciel: 'moyens' }

const JOUR_MS = 86400000
const nbJours = (s) => Math.round((new Date(s.fin) - new Date(s.debut)) / JOUR_MS) + 1

// Pop-up des sessions en cours et à venir : un tableau, une ligne par session, dans l'ordre des dates
function SessionsDialog({ f, sessions, jour, onFermer }) {
  return (
    <Modal onFermer={onFermer}>
      <dialog open className="dialog sess-liste" aria-modal="true" aria-labelledby="sl">
        <div className="sess-liste-tete"><span className="sess-liste-ic"><Icone nom="cal" taille={22} /></span>
          <div><h2 id="sl">Sessions en cours et à venir</h2><p>« {f.title} » · {sessions.length} {pluriel(sessions.length, 'session')}</p></div></div>
        <div className="sess-tab-zone">
          <table className="sess-tab">
            <thead><tr><th scope="col">Statut</th><th scope="col">Dates</th><th scope="col">Durée</th><th scope="col">Lieu</th><th scope="col">Places</th></tr></thead>
            <tbody>
              {sessions.map((s) => {
                const enCours = s.debut <= jour, j = nbJours(s)
                return (
                  <tr key={`${s.debut}-${s.fin}-${s.lieu}-${s.id ?? ''}`}>
                    <td><span className={`sess-st ${enCours ? 'en-cours' : 'a-venir'}`}>{enCours ? 'En cours' : 'À venir'}</span></td>
                    <td className="sess-dates">{s.debut === s.fin ? frDate(s.debut) : <>du {frDate(s.debut)}<br />au {frDate(s.fin)}</>}</td>
                    <td>{j} {pluriel(j, 'jour')}</td>
                    <td>{s.lieu || <span className="na">—</span>}</td>
                    <td>{s.places || <span className="na">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="foot"><button type="button" className="btn btn-line" autoFocus onClick={onFermer}>Fermer</button></div>
      </dialog>
    </Modal>
  )
}

// Nombre de sessions en cours et à venir ; le bouton ouvre leur liste (0 : rien à ouvrir)
function SessionsCarte({ f }) {
  const [ouvert, setOuvert] = useState(false)
  // Seulement les sessions en cours et à venir, dans l'ordre des dates (les sessions passées ne sont pas affichées)
  const jour = today()
  const sess = [...(f.sess || [])].filter((s) => s.fin >= jour).sort((a, b) => a.debut.localeCompare(b.debut))
  return (
    <div>
      <dt>Sessions</dt>
      <dd><button type="button" className="fc-sess-btn" disabled={!sess.length} aria-haspopup="dialog" aria-label={`${sess.length} ${pluriel(sess.length, 'session')} pour ${f.title}`}
        onClick={() => setOuvert(true)}>{sess.length}{sess.length > 0 && <Icone nom="chev" taille={14} epaisseur={2.4} />}</button></dd>
      {ouvert && <SessionsDialog f={f} sessions={sess} jour={jour} onFermer={() => setOuvert(false)} />}
    </div>
  )
}

// Une carte de la liste des formations (RG31 à RG33, SCRUM-21, SCRUM-23)
function CarteFormation({ f, menuOuvert, onMenu, onAction }) {
  const L = life(f), st = LC[L], archivee = L === 'archivee'
  const prix = money(f)
  const action = (nom) => () => onAction(nom, f)
  // SCRUM-22 : un brouillon n'a pas de fiche, il s'ouvre dans le formulaire
  const ouvrir = action(L === 'brouillon' ? 'saisir' : 'voir')

  // SCRUM-21 : « Compléter la formation » pour un brouillon, « Voir la formation » pour les autres ;
  // SCRUM-23 : « Restaurer » pour une formation archivée
  let principal
  if (archivee) principal = <button type="button" className="btn btn-soft btn-sm" onClick={action('restaurer')}><Icone nom="restore" taille={16} />Restaurer</button>
  else if (L === 'brouillon') principal = <button type="button" className="btn btn-act btn-sm" onClick={ouvrir}>Compléter la formation<Icone nom="arrow" taille={16} epaisseur={2.2} /></button>
  else principal = <button type="button" className="btn btn-soft btn-sm" data-view onClick={ouvrir}><Icone nom="doc" taille={16} />Voir la formation</button>
  const item = (nom, ic, lab, cls = '') => <button type="button" className={`mn-i ${cls}`} role="menuitem" onClick={action(nom)}><Icone nom={ic} taille={16} />{lab}</button>

  return (
    <article className={`fcard ${st.cls}-card ${f.statut === 'incomplete' ? 'is-inc' : ''}`} style={{ '--fc': artAccent(f) }}>
      <div className="fc-top">
        <Illustration formation={f} />
      </div>
      <h3><button type="button" className="fc-t" onClick={ouvrir}>{f.title}</button></h3>
      {/* Modalité à droite, en face de la date de mise à jour */}
      <div className="fc-ligne">
        <p className="fc-sub">Mise à jour le {frDate(f.maj)}</p>
        <span className="fc-tag"><Icone nom={ICONE_MODALITE[f.modalite] || 'globe'} taille={14} />{f.modalite}</span>
      </div>
      <dl className="fc-info">
        <div><dt>Durée</dt><dd>{f.duree ? `${f.duree} h` : <span className="na">—</span>}</dd></div>
        <div><dt>Prix</dt><dd>{prix || <span className="na">—</span>}</dd></div>
        <SessionsCarte f={f} />
      </dl>

      <div className="fc-head">
        <button type="button" className={`lc ${st.cls}`} disabled={archivee} title={st.help} onClick={action('saisir')}><Icone nom={st.ic} taille={14} epaisseur={2.4} />{st.lab}</button>
        {/* RG32 : « Programme non créé » seulement sans programme ; pas de lien si la formation est archivée */}
        {!hasProg(f) && (archivee
          ? <span className="lc lc-noprog"><Icone nom="programme" taille={14} epaisseur={2.4} />Programme non créé</span>
          : <button type="button" className="lc lc-noprog" title="Cliquez pour créer le programme" onClick={action('creerProgramme')}><Icone nom="programme" taille={14} epaisseur={2.4} />Programme non créé</button>)}
      </div>

      <div className="fc-foot">
        {principal}
        <div className="menu-wrap">
          <button type="button" className={`dots-btn ${menuOuvert ? 'open' : ''}`} data-menu aria-label={`Plus d’actions pour ${f.title}`} aria-expanded={menuOuvert} title="Plus d’actions" onClick={() => onMenu(f.id)}>
            <Icone nom="dots" taille={18} epaisseur={2.4} />
          </button>
          {menuOuvert && (
            <div className="menu-pop" role="menu">
              {/* SCRUM-23 : Modifier, Archiver, Supprimer ; une formation archivée se restaure avant d'être modifiée */}
              {archivee ? item('restaurer', 'restore', 'Restaurer') : <>{item('modifier', 'pen', 'Modifier')}{item('archiver', 'box', 'Archiver')}</>}
              {item('supprimer', 'trash', 'Supprimer', 'danger')}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default CarteFormation
