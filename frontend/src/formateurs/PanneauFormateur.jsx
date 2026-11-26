import { useRef, useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { ajouterDocumentFormateur, creerFormateur } from '../sessions/serviceApi'
import {
  ACCEPT, CV, DIPLOME, MAXIMUM, SOUS_TRAITANT, STATUTS_FORMATEUR, tailleFr, trierFichiers, verifierFormateur,
} from './formateurs'
import '../apprenants/apprenants.css'
import './formateurs.css'

const VIDE = { prenom: '', nom: '', email: '', statut: '', numero_nda: '' }
const AIDE_FICHIERS = 'Facultatif · PDF, JPG, PNG ou Word · 10 Mo maximum'

// Un champ : libellé (astérisque si obligatoire), saisie, puis le message d'erreur ou, à défaut, l'aide
function Champ({ id, label, obligatoire, aide, erreur, children }) {
  return (
    <div className="app-champ">
      <label className="app-lbl" htmlFor={id}>{label}{obligatoire && <span aria-hidden="true"> *</span>}</label>
      {children}
      {erreur
        ? <span className="app-err" id={`${id}-err`}>{erreur}</span>
        : aide && <span className="app-aide" id={`${id}-aide`}>{aide}</span>}
    </div>
  )
}

// Fichiers d'un type (CV ou diplômes) : ceux déjà ajoutés (nom, taille, croix pour les retirer), puis la zone
// « Glissez un fichier ici ou importez-le » (masquée quand le CV est ajouté), puis les refus ou l'aide.
function Documents({ type, titre, fichiers, refus, onDeposer, onRetirer }) {
  const [survol, setSurvol] = useState(false)
  const id = `frm-${type.toLowerCase()}`
  const deposer = (e) => {
    e.preventDefault()
    setSurvol(false)
    onDeposer([...e.dataTransfer.files])
  }
  return (
    <div className="app-champ" role="group" aria-labelledby={`${id}-titre`}>
      <span className="app-lbl" id={`${id}-titre`}>{titre}</span>
      {fichiers.length > 0 && (
        <ul className="frm-fichiers" aria-label={titre}>
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${i}`} className="frm-fichier">
              <Icone nom="doc" taille={20} />
              <b>{f.name}</b>
              <span className="frm-taille">{tailleFr(f.size)}</span>
              <button type="button" className="frm-retirer" aria-label={`Retirer ${f.name}`} onClick={() => onRetirer(i)}>
                <Icone nom="x" taille={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(type === DIPLOME || fichiers.length < MAXIMUM[type]) && (
        <div className={`frm-zone${survol ? ' survol' : ''}`} data-testid={`${id}-zone`}
             onDragOver={(e) => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)} onDrop={deposer}>
          <Icone nom="up" taille={20} />
          <span>Glissez un fichier ici ou <label htmlFor={id} className="frm-importer">importez-le</label></span>
          <span className="frm-limite">{type === CV ? '1 fichier' : '5 maximum'}</span>
          <input id={id} type="file" className="frm-input" accept={ACCEPT} multiple={type === DIPLOME}
                 aria-label={type === CV ? 'Importer un CV' : 'Importer un diplôme'}
                 onChange={(e) => { onDeposer([...e.target.files]); e.target.value = '' }} />
        </div>
      )}
      {refus.length > 0
        ? <div className="app-err" role="alert" id={`${id}-err`}>{refus.map((r) => <div key={r}>{r}</div>)}</div>
        : <span className="app-aide">{AIDE_FICHIERS}</span>}
    </div>
  )
}

// Fenêtre « Nouveau formateur » (SCRUM-26, complétée par SCRUM-119), la même partout où l'on crée un formateur :
// Identité (prénom, nom, e-mail), Statut (statut ; NDA si « Sous-traitant »), Documents (CV, diplômes).
// « Annuler », la croix, Échap ou un clic à côté la ferment sans rien enregistrer.
// onCree(formateur, nonEnregistres) : appelé après l'enregistrement, avec les noms des fichiers qui n'ont pas pu l'être.
export default function PanneauFormateur({ onFermer, onCree }) {
  const [f, setF] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreurServeur, setErreurServeur] = useState(null)
  const [fichiers, setFichiers] = useState({ [CV]: [], [DIPLOME]: [] })
  const [refus, setRefus] = useState({ [CV]: [], [DIPLOME]: [] })
  const corps = useRef(null)

  const modifier = (k, valeur) => {
    setF({ ...f, [k]: valeur })
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined })
  }
  const saisie = (k, aide) => ({
    id: `frm-${k}`, value: f[k], className: `app-inp${erreurs[k] ? ' app-inp-err' : ''}`,
    'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `frm-${k}-err` : (aide ? `frm-${k}-aide` : undefined),
    onChange: (e) => modifier(k, e.target.value),
  })

  const deposer = (type) => (nouveaux) => {
    const { gardes, refus: refuses } = trierFichiers(nouveaux, type, fichiers[type].length)
    setFichiers({ ...fichiers, [type]: [...fichiers[type], ...gardes] })
    setRefus({ ...refus, [type]: refuses })
  }
  const retirer = (type) => (index) => {
    setFichiers({ ...fichiers, [type]: fichiers[type].filter((_, i) => i !== index) })
    setRefus({ ...refus, [type]: [] })
  }

  const enregistrer = async () => {
    const e = verifierFormateur(f)
    setErreurs(e)
    setErreurServeur(null)
    if (Object.keys(e).length) return
    setEnvoi(true)
    let formateur
    try {
      formateur = await creerFormateur(f)
    } catch (err) {
      setEnvoi(false)
      const champs = Object.fromEntries(Object.entries(err.champs || {}).filter(([k]) => k in VIDE).map(([k, v]) => [k, [].concat(v)[0]]))
      setErreurs(champs)
      if (!Object.keys(champs).length) setErreurServeur(err.message)
      corps.current?.scrollTo?.({ top: 0 })
      return
    }
    // Les fichiers sont enregistrés un par un, juste après le formateur ; un échec n'annule pas sa création
    const nonEnregistres = []
    for (const type of [CV, DIPLOME]) {
      for (const fichier of fichiers[type]) {
        try {
          await ajouterDocumentFormateur(formateur.id, type, fichier)
        } catch {
          nonEnregistres.push(fichier.name)
        }
      }
    }
    onCree(formateur, nonEnregistres)
  }

  return (
    <Modal onFermer={onFermer} classeFond="pa-fond">
      <dialog open className="pa app-panneau" aria-modal="true" aria-labelledby="frm-titre">
        <div className="app-tete">
          <h2 id="frm-titre">Nouveau formateur</h2>
          <button type="button" className="app-croix" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className="app-corps" ref={corps}>
          {erreurServeur && <p className="app-alerte" role="alert">{erreurServeur}</p>}
          <section aria-labelledby="frm-identite">
            <h3 id="frm-identite">Identité</h3>
            <div className="app-ligne-champs">
              <Champ id="frm-prenom" label="Prénom" obligatoire erreur={erreurs.prenom}><input autoComplete="off" {...saisie('prenom')} /></Champ>
              <Champ id="frm-nom" label="Nom" obligatoire erreur={erreurs.nom}><input autoComplete="off" {...saisie('nom')} /></Champ>
            </div>
            <Champ id="frm-email" label="E-mail" obligatoire erreur={erreurs.email}><input type="email" autoComplete="off" {...saisie('email')} /></Champ>
          </section>
          <section aria-labelledby="frm-statut-titre">
            <h3 id="frm-statut-titre">Statut</h3>
            <div className="app-champ">
              <div className="frm-statuts" role="radiogroup" aria-labelledby="frm-statut-titre" aria-describedby="frm-statut-aide">
                {STATUTS_FORMATEUR.map(([valeur, libelle]) => (
                  <label key={valeur} className={`frm-statut${f.statut === valeur ? ' choisi' : ''}`}>
                    <input type="radio" name="frm-statut" value={valeur} checked={f.statut === valeur}
                           onChange={() => modifier('statut', valeur)} />
                    {libelle}
                  </label>
                ))}
              </div>
              <span className="app-aide" id="frm-statut-aide">Facultatif</span>
            </div>
            {f.statut === SOUS_TRAITANT && (
              <Champ id="frm-numero_nda" label="N° de déclaration d’activité (NDA)" aide="Facultatif · 11 chiffres" erreur={erreurs.numero_nda}>
                <input inputMode="numeric" autoComplete="off" {...saisie('numero_nda', true)} />
              </Champ>
            )}
          </section>
          <section aria-labelledby="frm-documents">
            <h3 id="frm-documents">Documents</h3>
            <Documents type={CV} titre="CV" fichiers={fichiers[CV]} refus={refus[CV]} onDeposer={deposer(CV)} onRetirer={retirer(CV)} />
            <Documents type={DIPLOME} titre="Diplômes" fichiers={fichiers[DIPLOME]} refus={refus[DIPLOME]}
                       onDeposer={deposer(DIPLOME)} onRetirer={retirer(DIPLOME)} />
          </section>
        </div>
        <div className="app-pied">
          <button type="button" className="app-btn app-btn-secondaire" onClick={onFermer}>Annuler</button>
          <button type="button" className="app-btn app-btn-principal" onClick={enregistrer} disabled={envoi}>Enregistrer</button>
        </div>
      </dialog>
    </Modal>
  )
}
