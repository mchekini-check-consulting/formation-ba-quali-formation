import Icone from '../components/Icone'
import { frDate, hasProg, LC, life, money } from './catalogue'
import Illustration from './Illustration'
import { artAccent } from './themes'

const ICONE_MODALITE = { Présentiel: 'organisation', Distanciel: 'moyens' }

// Une carte de la liste des formations (RG31 à RG33, SCRUM-21)
function CarteFormation({ f, menuOuvert, onMenu, onAction }) {
  const L = life(f), st = LC[L]
  const prix = money(f)
  const action = (nom) => () => onAction(nom, f)
  // SCRUM-22 : un brouillon n'a pas de fiche, il s'ouvre dans le formulaire
  const ouvrir = action(L === 'brouillon' ? 'saisir' : 'voir')

  // SCRUM-21 : « Compléter la formation » pour un brouillon, « Voir la formation » pour les autres
  const principal = L === 'brouillon'
    ? <button type="button" className="btn btn-act btn-sm" onClick={ouvrir}>Compléter la formation<Icone nom="arrow" taille={16} epaisseur={2.2} /></button>
    : <button type="button" className="btn btn-soft btn-sm" data-view onClick={ouvrir}><Icone nom="doc" taille={16} />Voir la formation</button>
  const item = (nom, ic, lab) => <button type="button" className="mn-i" role="menuitem" onClick={action(nom)}><Icone nom={ic} taille={16} />{lab}</button>
  // SCRUM-23 (à venir) : affiché grisé en attendant
  const bientot = (ic, lab) => <button type="button" className="mn-i" role="menuitem" disabled aria-disabled="true" title="Bientôt disponible"><Icone nom={ic} taille={16} />{lab}<small className="mn-bientot">Bientôt disponible</small></button>

  return (
    <article className={`fcard ${st.cls}-card ${f.statut === 'incomplete' ? 'is-inc' : ''}`} style={{ '--fc': artAccent(f) }}>
      <div className="fc-top">
        <Illustration formation={f} />
        <span className="fc-tag"><Icone nom={ICONE_MODALITE[f.modalite] || 'globe'} taille={14} />{f.modalite}</span>
      </div>
      <h3><button type="button" className="fc-t" onClick={ouvrir}>{f.title}</button></h3>
      <p className="fc-sub">Mise à jour le {frDate(f.maj)}</p>
      <dl className="fc-info">
        <div><dt>Durée</dt><dd>{f.duree ? `${f.duree} h` : <span className="na">—</span>}</dd></div>
        <div><dt>Prix</dt><dd>{prix || <span className="na">—</span>}</dd></div>
      </dl>

      <div className="fc-head">
        <button type="button" className={`lc ${st.cls}`} title={st.help} onClick={action('saisir')}><Icone nom={st.ic} taille={14} epaisseur={2.4} />{st.lab}</button>
        {/* RG32 : « Programme non créé » seulement sans programme */}
        {!hasProg(f) && <button type="button" className="lc lc-noprog" title="Cliquez pour créer le programme" onClick={action('creerProgramme')}><Icone nom="programme" taille={14} epaisseur={2.4} />Programme non créé</button>}
      </div>

      <div className="fc-foot">
        {principal}
        <div className="menu-wrap">
          <button type="button" className={`dots-btn ${menuOuvert ? 'open' : ''}`} data-menu aria-label={`Plus d’actions pour ${f.title}`} aria-expanded={menuOuvert} title="Plus d’actions" onClick={() => onMenu(f.id)}>
            <Icone nom="dots" taille={18} epaisseur={2.4} />
          </button>
          {menuOuvert && (
            <div className="menu-pop" role="menu">
              {/* SCRUM-21 : Modifier, Archiver, Supprimer */}
              {item('modifier', 'pen', 'Modifier')}
              {bientot('box', 'Archiver')}
              {bientot('trash', 'Supprimer')}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default CarteFormation
