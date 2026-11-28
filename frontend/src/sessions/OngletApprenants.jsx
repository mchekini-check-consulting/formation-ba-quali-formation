import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import Modal from '../components/Modal'
import { ListePersonnes } from '../pages/NouvelleSession'
import { inscritVia, placesRestantes, resumePlaces } from './regleFiche'
import {
  ajouterApprenantsSession, apprenantsSession, initiales, listerApprenants, retirerApprenantSession,
} from './serviceApi'

const MSG_DERNIER = 'Impossible de retirer le dernier apprenant : une session doit garder au moins un apprenant.'
const msgTrop = (n, restantes) =>
  `Trop d’apprenants : ${n} cochés pour ${restantes} ${restantes > 1 ? 'places restantes' : 'place restante'}.`
const nomComplet = (a) => `${a.prenom} ${a.nom}`

// Menu ⋯ d'une ligne : « Retirer de la session » (maquette SCRUM-179_02). Se ferme au clic ailleurs ou sur Échap.
function MenuLigne({ apprenant, onRetirer }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef(null)
  useEffect(() => {
    if (!ouvert) return undefined
    const fermer = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !zone.current?.contains(e.target)) setOuvert(false) }
    document.addEventListener('mousedown', fermer)
    document.addEventListener('keydown', fermer)
    return () => { document.removeEventListener('mousedown', fermer); document.removeEventListener('keydown', fermer) }
  }, [ouvert])
  return (
    <div className="oa-menu" ref={zone}>
      <button type="button" className="oa-points" aria-label={`Actions pour ${nomComplet(apprenant)}`} aria-expanded={ouvert}
              onClick={() => setOuvert((o) => !o)}>
        <Icone nom="dots" taille={20} />
      </button>
      {ouvert && (
        <div className="oa-liste" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOuvert(false); onRetirer(apprenant) }}>Retirer de la session</button>
        </div>
      )}
    </div>
  )
}

// Fenêtre « Retirer … de la session ? » (maquette SCRUM-179_03)
function ConfirmerRetrait({ apprenant, envoi, onAnnuler, onOk }) {
  const nom = nomComplet(apprenant)
  return (
    <Modal onFermer={onAnnuler}>
      <dialog open className="dialog oa-dialogue" aria-modal="true" aria-labelledby="oa-retrait">
        <div className="oa-dialogue-tete">
          <h2 id="oa-retrait">Retirer {nom} de la session ?</h2>
          <button type="button" className="oa-croix" aria-label="Fermer" onClick={onAnnuler}><Icone nom="x" taille={18} /></button>
        </div>
        <p>{nom} ne fera plus partie de cette session.</p>
        <div className="foot">
          <button type="button" className="btn btn-line" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={envoi} onClick={onOk} autoFocus>{envoi ? 'Retrait…' : 'Retirer'}</button>
        </div>
      </dialog>
    </Modal>
  )
}

// Panneau « Ajouter des apprenants » (maquette SCRUM-179_04) : apprenants du centre pas encore inscrits, recherche,
// cases à cocher, sans dépasser les places restantes (CA3 : ajout bloqué avec un message)
function PanneauAjout({ titreSession, donnees, onFermer, onAjouter }) {
  const [personnes, setPersonnes] = useState(null)
  const [erreurChargement, setErreurChargement] = useState(null)
  const [choisis, setChoisis] = useState([])
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const restantes = placesRestantes(donnees)

  useEffect(() => {
    const inscrits = new Set(donnees.apprenants.map((a) => a.id))
    listerApprenants().then((liste) => setPersonnes(liste.filter((p) => !inscrits.has(p.id)))).catch(setErreurChargement)
  }, [donnees])

  const basculer = (id) => {
    setErreur(null)
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  async function ajouter() {
    if (restantes !== null && choisis.length > restantes) {
      setErreur(msgTrop(choisis.length, restantes))
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      await onAjouter(choisis)
    } catch (e) {
      setErreur(e.message)
      setEnvoi(false)
    }
  }

  const sousTitre = restantes === null ? titreSession
    : `${titreSession} · ${restantes} ${restantes > 1 ? 'places restantes' : 'place restante'}`
  return (
    <Modal onFermer={onFermer} classeFond="pa-fond">
      <dialog open className="pa oa-panneau" aria-modal="true" aria-labelledby="oa-ajout">
        <div className="pa-tete">
          <div>
            <h2 id="oa-ajout">Ajouter des apprenants</h2>
            <p className="sub">{sousTitre}</p>
          </div>
          <button type="button" className="pa-croix ns-croix" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className="pa-corps">
          {personnes === null
            ? (erreurChargement ? <ErreurChargement erreur={erreurChargement} /> : <p className="chargement">Chargement des apprenants…</p>)
            : (
              <ListePersonnes titre="Apprenants du centre" placeholder="Rechercher un apprenant ou une entreprise"
                personnes={personnes} choisis={choisis} onBasculer={basculer}
                detail={(p) => `${p.entreprise || 'Individuel'} · ${p.email}`} />
            )}
          {erreur && <p className="errtxt ns-erreur" role="alert">{erreur}</p>}
          <p className="ns-info">
            Un apprenant absent de la liste ? Déclarez-le dans <Link to="/parties-prenantes">« Parties prenantes »</Link>.
          </p>
        </div>
        <div className="pa-pied">
          <button type="button" className="btn btn-line" onClick={onFermer}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={envoi || choisis.length === 0} onClick={ajouter}>
            {envoi ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </dialog>
    </Modal>
  )
}

// SCRUM-179 (maquettes SCRUM-179_01 à 04) : onglet Apprenants de la fiche session. Liste des inscrits (« Inscrit via » :
// entreprise ou « Individuel »), ajout dans la limite des places, retrait confirmé (jamais le dernier apprenant).
// `onModifie` : appelé après un ajout ou un retrait, pour mettre à jour l'en-tête et le nombre de l'onglet.
export function OngletApprenants({ sessionId, titreSession, onModifie }) {
  const [donnees, setDonnees] = useState(null)
  const [erreurChargement, setErreurChargement] = useState(null)
  const [message, setMessage] = useState(null)
  const [aRetirer, setARetirer] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [panneau, setPanneau] = useState(false)

  useEffect(() => { apprenantsSession(sessionId).then(setDonnees).catch(setErreurChargement) }, [sessionId])

  function demanderRetrait(apprenant) {
    // CA5 : le dernier apprenant ne peut pas être retiré
    if (donnees.apprenants.length <= 1) { setMessage(MSG_DERNIER); return }
    setMessage(null)
    setARetirer(apprenant)
  }

  async function retirer() {
    setEnvoi(true)
    try {
      setDonnees(await retirerApprenantSession(sessionId, aRetirer.id))
      onModifie()
    } catch (e) {
      setMessage(e.message)
    } finally {
      setEnvoi(false)
      setARetirer(null)
    }
  }

  async function ajouter(ids) {
    setDonnees(await ajouterApprenantsSession(sessionId, ids))
    setPanneau(false)
    setMessage(null)
    onModifie()
  }

  if (!donnees) {
    return (
      <div className="card fs-vide">
        {erreurChargement ? <ErreurChargement erreur={erreurChargement} /> : <p className="chargement">Chargement des apprenants…</p>}
      </div>
    )
  }
  return (
    <section className="card oa-carte" aria-labelledby="oa-titre">
      <div className="oa-tete">
        <h2 id="oa-titre">Apprenants <span className="oa-places">· {resumePlaces(donnees)}</span></h2>
        <button type="button" className="btn btn-primary oa-ajouter" onClick={() => { setMessage(null); setPanneau(true) }}>
          <Icone nom="plus" taille={16} epaisseur={2.4} />Ajouter des apprenants
        </button>
      </div>
      {message && <p className="oa-message" role="alert">{message}</p>}
      <table className="oa-table">
        <thead>
          <tr><th scope="col" aria-label="Initiales" /><th scope="col">Nom</th><th scope="col">Inscrit via</th><th scope="col" aria-label="Actions" /></tr>
        </thead>
        <tbody>
          {donnees.apprenants.map((a) => {
            const via = inscritVia(a)
            return (
              <tr key={a.id}>
                <td className="oa-col-avatar"><span className={`ns-avatar ns-av${a.id % 5} oa-avatar`} aria-hidden="true">{initiales(a)}</span></td>
                <td><b>{nomComplet(a)}</b><span>{a.email}</span></td>
                <td><b>{via.titre}</b>{via.detail && <span>{via.detail}</span>}</td>
                <td className="oa-col-actions"><MenuLigne apprenant={a} onRetirer={demanderRetrait} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {aRetirer && <ConfirmerRetrait apprenant={aRetirer} envoi={envoi} onAnnuler={() => setARetirer(null)} onOk={retirer} />}
      {panneau && <PanneauAjout titreSession={titreSession} donnees={donnees} onFermer={() => setPanneau(false)} onAjouter={ajouter} />}
    </section>
  )
}
