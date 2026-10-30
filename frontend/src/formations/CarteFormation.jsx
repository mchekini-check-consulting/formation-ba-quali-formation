import Icone from '../components/Icone'
import { frDate, hasProg, isPub, LC, life, missingTiles, money } from './catalogue'
import Illustration from './Illustration'
import { artAccent } from './themes'

const ICONE_MODALITE = { Présentiel: 'organisation', Distanciel: 'moyens' }

// Une carte de la liste des formations (RG31 à RG33)
function CarteFormation({ f, menuOuvert, onMenu, onAction }) {
  const L = life(f), st = LC[L], miss = missingTiles(f).length
  const n = (f.sess || []).length
  const publiable = L === 'incomplete' || L === 'apublier'
  const prix = money(f)
  const action = (nom) => () => onAction(nom, f)

  // RG33 : le bouton principal dépend du statut
  let principal
  if (L === 'brouillon') {
    principal = <button type="button" className="btn btn-act btn-sm" onClick={action('saisir')}>{miss ? 'Continuer la saisie' : 'Ouvrir et valider'}<Icone nom="arrow" taille={16} epaisseur={2.2} /></button>
  } else if (L === 'incomplete') {
    principal = <button type="button" className="btn btn-act btn-fix btn-sm" onClick={action('saisir')}>Compléter les informations<Icone nom="arrow" taille={16} epaisseur={2.2} /></button>
  } else if (L === 'apublier') {
    principal = <button type="button" className="btn btn-soft btn-sm" data-view onClick={action('voir')}><Icone nom="doc" taille={16} />Voir la formation</button>
  } else {
    principal = <button type="button" className="btn btn-soft btn-sm" onClick={action('restaurer')}><Icone nom="restore" taille={16} />Restaurer la formation</button>
  }
  const item = (nom, ic, lab, cls = '') => <button type="button" className={`mn-i ${cls}`} role="menuitem" onClick={action(nom)}><Icone nom={ic} taille={16} />{lab}</button>

  return (
    <article className={`fcard ${st.cls}-card ${f.statut === 'incomplete' ? 'is-inc' : ''}`} style={{ '--fc': artAccent(f) }}>
      <div className="fc-top">
        <Illustration formation={f} />
        <span className="fc-tag"><Icone nom={ICONE_MODALITE[f.modalite] || 'globe'} taille={14} />{f.modalite}</span>
        {/* RG24 : l'état de publication ne concerne que les formations validées ou incomplètes */}
        {publiable && (isPub(f)
          ? <span className="fc-tag fc-pub on"><i></i>Publiée</span>
          : <span className="fc-tag fc-pub wait"><i></i>À publier</span>)}
      </div>
      <h3><button type="button" className="fc-t" onClick={action('voir')}>{f.title}</button></h3>
      <p className="fc-sub">Mise à jour le {frDate(f.maj)}</p>
      <dl className="fc-info">
        <div><dt>Durée</dt><dd>{f.duree ? `${f.duree} h` : <span className="na">—</span>}</dd></div>
        <div><dt>Prix</dt><dd>{prix || <span className="na">—</span>}</dd></div>
        <div><dt>Sessions</dt><dd>{n}</dd></div>
      </dl>

      <div className="fc-head">
        <button type="button" className={`lc ${st.cls}`} disabled={L === 'archivee'} title={st.help} onClick={action('saisir')}><Icone nom={st.ic} taille={14} epaisseur={2.4} />{st.lab}</button>
        {/* RG32 : « Programme non créé » seulement sans programme ; pas de lien si la formation est archivée */}
        {!hasProg(f) && (L === 'archivee'
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
              {L !== 'archivee' && item('modifier', 'pen', 'Modifier')}
              {/* RG25 : publier / retirer de la publication depuis le menu */}
              {publiable && (isPub(f) ? item('retirer', 'globe', 'Retirer de la publication') : item('publier', 'publication', 'Publier'))}
              {/* RG34 : pas de nouvelle session pour une formation archivée */}
              {L !== 'archivee' && item('nouvelleSession', 'cal', 'Ajouter une session')}
              {L !== 'archivee' ? item('archiver', 'box', 'Archiver') : item('restaurer', 'restore', 'Restaurer')}
              {item('supprimer', 'trash', 'Supprimer', 'danger')}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default CarteFormation
