import { useEffect, useRef, useState } from 'react'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import Modal from '../components/Modal'
import PanneauApprenant from '../apprenants/PanneauApprenant'
import { detailApprenant, filtrerApprenants, inscritVia, placesRestantes, resumePlaces } from './regleFiche'
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

// Panneau « Ajouter des apprenants » (maquettes SCRUM-179_04 et 05) : apprenants du centre pas encore inscrits, triés par
// nom (GET /apprenants/), filtrés au fil de la saisie (prénom, nom, entreprise ; sans accents ni casse), cases cochées
// gardées pendant la recherche, blocage au-delà des places restantes. « + Créer un apprenant » ouvre, à la place du
// panneau, la fenêtre « Nouvel apprenant » de la SCRUM-112 telle quelle : après son enregistrement, l'apprenant est
// inscrit ; « Annuler » revient à la liste sans perdre les cases cochées.
function PanneauAjout({ titreSession, donnees, onFermer, onAjouter }) {
  const [personnes, setPersonnes] = useState(null)
  const [erreurChargement, setErreurChargement] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [choisis, setChoisis] = useState([])
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [creation, setCreation] = useState(false)
  const restantes = placesRestantes(donnees)
  const trop = restantes !== null && choisis.length > restantes

  useEffect(() => {
    const inscrits = new Set(donnees.apprenants.map((a) => a.id))
    listerApprenants().then((liste) => setPersonnes(liste.filter((p) => !inscrits.has(p.id)))).catch(setErreurChargement)
  }, [donnees])

  const basculer = (id) => {
    setErreur(null)
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  async function ajouter() {
    setEnvoi(true)
    setErreur(null)
    try {
      await onAjouter(choisis)
    } catch (e) {
      setErreur(e.message)
      setEnvoi(false)
    }
  }

  // Après « Enregistrer » dans « Nouvel apprenant » : inscription du nouvel apprenant. Si elle échoue, il reste créé :
  // retour à la liste (où il apparaît désormais) avec un message.
  async function creerPuisInscrire(cree) {
    try {
      await onAjouter([cree.id])
    } catch (e) {
      setPersonnes((liste) => [...(liste || []), cree])
      setErreur(`L’apprenant « ${nomComplet(cree)} » a été créé, mais n’a pas pu être ajouté à la session : ${e.message}`)
      setCreation(false)
    }
  }

  // Maquette 06 : la fenêtre « Nouvel apprenant » de la SCRUM-112 (mêmes champs, règles et messages), présentée
  // « Créer un apprenant » ; « ‹ Retour à la liste » garde les cases cochées, « Annuler » et la croix ferment le panneau
  if (creation) {
    return (
      <PanneauApprenant titre="Créer un apprenant" simple onFermer={onFermer} onCree={creerPuisInscrire}
        sousTitre={`Il sera ajouté à la session « ${titreSession} » après enregistrement`}
        pied={(enregistrer, envoiCreation) => (
          <div className="app-pied-retour">
            <button type="button" className="app-btn app-btn-secondaire app-retour" onClick={() => setCreation(false)}>‹ Retour à la liste</button>
            <button type="button" className="app-btn app-btn-secondaire" onClick={onFermer}>Annuler</button>
            <button type="button" className="app-btn app-btn-principal" onClick={enregistrer} disabled={envoiCreation}>Enregistrer et ajouter</button>
          </div>
        )} />
    )
  }

  const affichees = personnes ? filtrerApprenants(personnes, recherche) : []
  const sousTitre = restantes === null ? titreSession
    : `${titreSession} · ${restantes} ${restantes > 1 ? 'places restantes' : 'place restante'}`
  let vide = null
  if (personnes?.length === 0) vide = 'Tous les apprenants du centre sont déjà inscrits à cette session.'
  else if (personnes && affichees.length === 0) vide = `Aucun apprenant ne correspond à « ${recherche.trim()} ».`
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
              <div className="ns-choix">
                <div className="ns-choix-haut">
                  <span className="ns-recherche">
                    <input type="search" className="inp" placeholder="Rechercher un apprenant ou une entreprise"
                      aria-label="Rechercher un apprenant ou une entreprise" value={recherche} autoComplete="off" autoFocus
                      onChange={(e) => setRecherche(e.target.value)} />
                    {recherche && (
                      <button type="button" className="ns-effacer" aria-label="Effacer la recherche" onClick={() => setRecherche('')}>
                        <Icone nom="x" taille={16} epaisseur={2.6} />
                      </button>
                    )}
                  </span>
                  <span className="ns-compteur">{choisis.length} {choisis.length > 1 ? 'sélectionnés' : 'sélectionné'}</span>
                </div>
                <ul className="ns-personnes" aria-label="Apprenants du centre">
                  {affichees.map((p) => (
                    <li key={p.id} className={choisis.includes(p.id) ? 'on' : ''}>
                      <label>
                        <span className={`ns-avatar oa-av oa-av${p.id % 6}`} aria-hidden="true">{initiales(p)}</span>
                        <span className="ns-nom"><b>{nomComplet(p)}</b><span>{detailApprenant(p)}</span></span>
                        <input type="checkbox" checked={choisis.includes(p.id)} onChange={() => basculer(p.id)} />
                      </label>
                    </li>
                  ))}
                  {vide && <li className="ns-vide">{vide}</li>}
                </ul>
              </div>
            )}
          {trop && <p className="errtxt ns-erreur" role="alert">{msgTrop(choisis.length, restantes)}</p>}
          {erreur && <p className="errtxt ns-erreur" role="alert">{erreur}</p>}
          <div className="oa-absent">
            <span>Un apprenant absent de la liste ?</span>
            <button type="button" className="btn btn-line oa-creer" onClick={() => { setErreur(null); setCreation(true) }}>
              + Créer un apprenant
            </button>
          </div>
        </div>
        <div className="pa-pied">
          <button type="button" className="btn btn-line" onClick={onFermer}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={envoi || trop || choisis.length === 0} onClick={ajouter}>
            {choisis.length ? `Ajouter (${choisis.length})` : 'Ajouter'}
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
