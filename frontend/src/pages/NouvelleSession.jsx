import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import Modal from '../components/Modal'
import {
  creerSession, dateFr, initiales, listerApprenants, listerFormateurs, listerFormations,
} from '../sessions/serviceApi'
import {
  demandeLieu, demandeLien, erreurServeur, filtrerPersonnes, MODALITES_SESSION, MSG_APPRENANT, PRESENTIEL, MSG_FORMATEUR, msgTropApprenants,
  verifierInformations,
} from '../sessions/regles'
import '../sessions/sessions.css'

// Pop-up « Nouvelle session » (SCRUM-25, évolution SCRUM-166 et ses maquettes), ouverte par-dessus Sessions et planning,
// en 3 étapes : informations, formateurs, apprenants.
// Champs vides à l'ouverture, sauf la modalité (Présentiel, comme la maquette) ; le choix de la formation reprend sa durée
// et sa modalité (modifiables).
// Pas d'heure de début ni de fin : seules les heures d'envoi des documents sont gérées (plan d'envoi).
const ETAPES = ['Informations', 'Formateurs', 'Apprenants']
const VIDE = { formation: '', debut: '', fin: '', duree: '', places: '', modalite: PRESENTIEL, lieu: '', lien: '' }
function Champ({ id, label, erreur, children }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label} <span className="req" aria-hidden="true">*</span></label>
      {children}
      {erreur && <span className="errtxt" id={`${id}-err`}>{erreur}</span>}
    </div>
  )
}

// « N sélectionné(s) »
const selectionnes = (n) => (n > 1 ? `${n} sélectionnés` : `${n} sélectionné`)

// Liste à cocher des formateurs ou des apprenants : recherche (nom, entreprise, e-mail), personnes cochées en tête.
// detail(p) : 2e ligne de chaque personne
// Reprise par le panneau « Ajouter des apprenants » de la fiche session (SCRUM-179)
export function ListePersonnes({ titre, placeholder, personnes, choisis, onBasculer, detail }) {
  const [recherche, setRecherche] = useState('')
  const affichees = filtrerPersonnes(personnes, recherche, choisis)
  return (
    <div className="ns-choix">
      <div className="ns-choix-haut">
        <span className="ns-recherche">
          <input type="search" className="inp" placeholder={placeholder} aria-label={placeholder}
            value={recherche} autoComplete="off" onChange={(e) => setRecherche(e.target.value)} />
          {recherche && (
            <button type="button" className="ns-effacer" aria-label="Effacer la recherche" onClick={() => setRecherche('')}>
              <Icone nom="x" taille={16} epaisseur={2.6} />
            </button>
          )}
        </span>
        <span className="ns-compteur">{selectionnes(choisis.length)}</span>
      </div>
      <ul className="ns-personnes" aria-label={titre}>
        {affichees.map((p) => (
          <li key={p.id} className={choisis.includes(p.id) ? 'on' : ''}>
            <label>
              <span className={`ns-avatar ns-av${p.id % 5}`} aria-hidden="true">{initiales(p)}</span>
              <span className="ns-nom"><b>{p.prenom} {p.nom}</b><span>{detail(p)}</span></span>
              <input type="checkbox" checked={choisis.includes(p.id)} onChange={() => onBasculer(p.id)} />
            </label>
          </li>
        ))}
        {personnes.length === 0 && <li className="ns-vide">Aucune personne enregistrée pour le moment.</li>}
        {personnes.length > 0 && affichees.length === 0 && <li className="ns-vide">Aucun résultat pour « {recherche.trim()} ».</li>}
      </ul>
    </div>
  )
}

// Indicateur des 3 étapes : étape en cours, étapes faites (coche)
function Etapes({ etape }) {
  return (
    <ol className="ns-etapes" aria-label="Étapes">
      {ETAPES.map((nom, i) => {
        const n = i + 1
        const faite = n < etape
        let etat = faite ? 'faite' : ''
        if (n === etape) etat = 'active'
        return (
          <li key={nom} className={etat} aria-current={n === etape ? 'step' : undefined}>
            <span className="ns-num">{faite ? <Icone nom="check" taille={14} epaisseur={2.6} /> : n}</span>
            {nom}
          </li>
        )
      })}
    </ol>
  )
}

// Étape 1 : informations de la session
function EtapeInformations({ s, erreurs, saisie, formations, changer }) {
  // Le choix de la formation reprend sa durée et sa modalité
  const choisirFormation = (id) => {
    const f = formations.find((x) => String(x.id) === id)
    changer({ formation: id, ...(f?.duree && { duree: f.duree }), ...(f?.modalite && { modalite: f.modalite }) })
  }
  return (
    <>
      <h3>Informations</h3>
      <Champ id="ns-formation" label="Formation concernée" erreur={erreurs.formation}>
        <select {...saisie('formation')} onChange={(e) => choisirFormation(e.target.value)}>
          <option value="">Choisir une formation</option>
          {formations.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
        </select>
      </Champ>
      <div className="ns-grille">
        <Champ id="ns-debut" label="Date de début" erreur={erreurs.debut}><input type="date" {...saisie('debut')} /></Champ>
        <Champ id="ns-fin" label="Date de fin" erreur={erreurs.fin}><input type="date" {...saisie('fin')} /></Champ>
        <Champ id="ns-duree" label="Durée (en heures)" erreur={erreurs.duree}><input inputMode="decimal" {...saisie('duree')} /></Champ>
        <Champ id="ns-modalite" label="Modalité" erreur={erreurs.modalite}>
          <select {...saisie('modalite')}>
            {MODALITES_SESSION.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
          </select>
        </Champ>
      </div>
      {/* Libellé adapté à la modalité : lieu (présentiel), lien (distanciel), les deux (mixte) */}
      {demandeLieu(s.modalite) && <Champ id="ns-lieu" label="Lieu" erreur={erreurs.lieu}><input {...saisie('lieu')} /></Champ>}
      {demandeLien(s.modalite) && <Champ id="ns-lien" label="Lien de la classe virtuelle" erreur={erreurs.lien}><input type="url" placeholder="https://…" {...saisie('lien')} /></Champ>}
      <div className="ns-grille">
        <Champ id="ns-places" label="Nombre de places" erreur={erreurs.places}><input type="number" min="1" step="1" {...saisie('places')} /></Champ>
      </div>
    </>
  )
}

function NouvelleSession() {
  const navigate = useNavigate()
  const [listes, setListes] = useState(null) // { formations, formateurs, apprenants }
  const [erreurChargement, setErreurChargement] = useState(null)
  const [etape, setEtape] = useState(1)
  const [s, setS] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [formateurs, setFormateurs] = useState([])
  const [apprenants, setApprenants] = useState([])
  const [erreurEtape, setErreurEtape] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    Promise.all([listerFormations(), listerFormateurs(), listerApprenants()])
      .then(([f, fo, a]) => setListes({ formations: f, formateurs: fo, apprenants: a }))
      .catch(setErreurChargement)
  }, [])

  const fermer = () => navigate('/sessions')
  // modif : { champ: valeur, ... } ; l'erreur de chaque champ modifié disparaît
  const changer = (modif) => {
    setS({ ...s, ...modif })
    setErreurs(Object.fromEntries(Object.entries(erreurs).filter(([k]) => !(k in modif))))
  }
  const saisie = (k) => ({
    id: `ns-${k}`, value: s[k], autoComplete: 'off', onChange: (e) => changer({ [k]: e.target.value }),
    className: `inp${erreurs[k] ? ' err' : ''}`, 'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `ns-${k}-err` : undefined,
  })
  const basculer = (liste, setListe) => (id) => { setErreurEtape(null); setListe(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]) }
  const allerA = (n) => { setErreurEtape(null); setEtape(n) }

  const suivant = () => {
    if (etape === 1) {
      const e = verifierInformations(s)
      setErreurs(e)
      if (Object.keys(e).length === 0) allerA(2)
    } else if (formateurs.length === 0) {
      setErreurEtape(MSG_FORMATEUR)
    } else {
      allerA(3)
    }
  }

  const places = Number(s.places)
  const depasse = apprenants.length > places

  const creer = async () => {
    if (apprenants.length === 0) { setErreurEtape(MSG_APPRENANT); return }
    if (depasse || envoi) return // blocage : le message « Trop d'apprenants » est déjà affiché
    setEnvoi(true)
    try {
      const session = await creerSession(s, formateurs, apprenants)
      const message = `La session « ${session.formation_intitule} » du ${dateFr(session.date_debut)} a été créée avec le statut « Prévue ».`
      void navigate('/sessions', { state: { message, sessionId: session.id } })
    } catch (e) {
      // Refus du serveur : retour à l'étape concernée (champs de l'étape 1 signalés)
      const refus = erreurServeur(e)
      setEnvoi(false)
      setEtape(refus.etape)
      setErreurEtape(refus.message || null)
      if (refus.champs) setErreurs(refus.champs)
    }
  }

  const aucuneFormation = listes?.formations.length === 0
  const erreurAffichee = erreurEtape || (etape === 3 && depasse ? msgTropApprenants(apprenants.length, places) : null)

  let corps
  if (!listes) {
    corps = erreurChargement ? <ErreurChargement erreur={erreurChargement} /> : <p className="chargement">Chargement…</p>
  } else if (aucuneFormation) {
    corps = (
      <div className="ns-aucune">
        <h3>Aucune formation pour l'instant</h3>
        <p className="sub">Une session se rattache à une formation : créez d'abord une formation, puis revenez planifier sa session.</p>
        <Link to="/formations/nouvelle" className="btn btn-primary">Créer une formation</Link>
      </div>
    )
  } else {
    corps = (
      <>
        <Etapes etape={etape} />
        {etape === 1 && <EtapeInformations s={s} erreurs={erreurs} saisie={saisie} formations={listes.formations} changer={changer} />}

        {etape === 2 && (
          <>
            <h3>Formateur(s) <span className="req">*</span></h3>
            <ListePersonnes titre="Formateurs" placeholder="Rechercher un formateur" personnes={listes.formateurs} choisis={formateurs}
              onBasculer={basculer(formateurs, setFormateurs)} detail={(p) => p.email} />
          </>
        )}

        {etape === 3 && (
          <>
            <h3>Apprenant(s) <span className="req">*</span> <span className={`ns-places${depasse ? ' depasse' : ''}`}>· {apprenants.length} / {places} places</span></h3>
            <ListePersonnes titre="Apprenants" placeholder="Rechercher un apprenant ou une entreprise" personnes={listes.apprenants} choisis={apprenants}
              onBasculer={basculer(apprenants, setApprenants)} detail={(p) => `${p.entreprise || 'Individuel'} · ${p.email}`} />
          </>
        )}

        {erreurAffichee && <p className="errtxt ns-erreur" role="alert">{erreurAffichee}</p>}
        {etape === 3 && <p className="ns-info">Un apprenant ou un formateur absent de la liste ? Déclarez-le dans « Parties prenantes ».</p>}
      </>
    )
  }

  const formulaire = listes && !aucuneFormation
  return (
    <Modal onFermer={fermer}>
      <dialog open className="pa ns-popup" aria-modal="true" aria-labelledby="ns-titre">
        <div className="pa-tete">
          <div>
            <h2 id="ns-titre">Nouvelle session</h2>
            <p className="sub">Les champs marqués d’un astérisque sont obligatoires.</p>
          </div>
          <button type="button" className="pa-croix ns-croix" aria-label="Fermer" onClick={fermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className="pa-corps">{corps}</div>
        <div className="pa-pied">
          {(!formulaire || etape === 1)
            ? <button type="button" className="btn btn-line" onClick={fermer}>Annuler</button>
            : <button type="button" className="btn btn-line" onClick={() => allerA(etape - 1)}>Précédent</button>}
          {formulaire && (etape < 3
            ? <button type="button" className="btn btn-primary" onClick={suivant}>Suivant</button>
            : <button type="button" className="btn btn-primary" onClick={creer} disabled={envoi}>Créer la session</button>)}
        </div>
      </dialog>
    </Modal>
  )
}

export default NouvelleSession
