import { useEffect, useRef, useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { verifierPersonne } from './regles'
import { PARTIES_PRENANTES } from './typesPersonnes'

// Bouton « Parties prenantes » et sa liste déroulante. onChoisir(type) : 'formateur' ou 'apprenant'.
export function MenuPartiesPrenantes({ onChoisir }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef(null)

  // Un clic en dehors du menu le referme
  useEffect(() => {
    if (!ouvert) return undefined
    const fermer = (e) => { if (!zone.current.contains(e.target)) setOuvert(false) }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [ouvert])

  const choisir = (type) => { setOuvert(false); onChoisir(type) }

  return (
    <div className="pp" ref={zone}>
      <button type="button" className="btn btn-outline" aria-expanded={ouvert} aria-haspopup="menu" onClick={() => setOuvert(!ouvert)}>
        <Icone nom="apprenants" taille={18} />Parties prenantes<span className={`pp-chev${ouvert ? ' ouvert' : ''}`}><Icone nom="chev" taille={16} /></span>
      </button>
      {ouvert && (
        <div className="pp-menu" role="menu">
          {Object.entries(PARTIES_PRENANTES).map(([type, t]) => (
            <button type="button" role="menuitem" key={type} onClick={() => choisir(type)}>
              <span className={`pp-ic ${t.classe}`}><Icone nom={t.icone} taille={18} /></span>
              <span><b>{t.titre}</b><small>{t.aide}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const VIDE = { prenom: '', nom: '', email: '' }

function Champ({ id, label, erreur, children }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label} <span className="req" aria-hidden="true">*</span></label>
      {children}
      {erreur && <span className="errtxt" id={`${id}-err`}>{erreur}</span>}
    </div>
  )
}

// Panneau latéral « Nouveau formateur » (SCRUM-26) ou « Nouvel apprenant » (SCRUM-27).
// « Annuler », la croix, Échap ou un clic à côté le ferment. onCree(personne) : appelé après l'enregistrement.
export function PanneauPartiePrenante({ type, onFermer, onCree }) {
  const t = PARTIES_PRENANTES[type]
  const [p, setP] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreurServeur, setErreurServeur] = useState(null)

  const saisie = (k) => ({
    id: `pa-${k}`, value: p[k], className: `inp${erreurs[k] ? ' err' : ''}`,
    'aria-invalid': erreurs[k] ? true : undefined, 'aria-describedby': erreurs[k] ? `pa-${k}-err` : undefined,
    onChange: (e) => { setP({ ...p, [k]: e.target.value }); if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined }) },
  })

  const enregistrer = async () => {
    const e = verifierPersonne(p)
    setErreurs(e)
    setErreurServeur(null)
    if (Object.keys(e).length) return
    setEnvoi(true)
    try {
      onCree(await t.creer(p))
    } catch (err) {
      setEnvoi(false)
      const champs = Object.fromEntries(Object.entries(err.champs || {}).filter(([k]) => k in VIDE).map(([k, v]) => [k, [].concat(v)[0]]))
      setErreurs(champs)
      if (!Object.keys(champs).length) setErreurServeur(err.message)
    }
  }

  const aCorriger = Object.values(erreurs).some(Boolean)
  return (
    <Modal onFermer={onFermer} classeFond="pa-fond">
      <dialog open className="pa" aria-modal="true" aria-labelledby="pa-titre">
        <div className="pa-tete">
          <div>
            <small>Parties prenantes</small>
            <h2 id="pa-titre">{t.titre}</h2>
            <p className="sub">Les champs marqués <span className="req">*</span> sont obligatoires.</p>
          </div>
          <button type="button" className="pa-croix" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className="pa-corps">
          {aCorriger && <p className="pa-alerte" role="alert">Corrigez les champs indiqués pour enregistrer {t.le}.</p>}
          {erreurServeur && <p className="pa-alerte" role="alert">{erreurServeur}</p>}
          <div className="pa-ligne">
            <Champ id="pa-prenom" label="Prénom" erreur={erreurs.prenom}><input autoComplete="off" {...saisie('prenom')} /></Champ>
            <Champ id="pa-nom" label="Nom" erreur={erreurs.nom}><input autoComplete="off" {...saisie('nom')} /></Champ>
          </div>
          <Champ id="pa-email" label="E-mail" erreur={erreurs.email}><input type="email" placeholder="prenom.nom@exemple.fr" autoComplete="off" {...saisie('email')} /></Champ>
        </div>
        <div className="pa-pied">
          <button type="button" className="btn btn-line" onClick={onFermer}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={enregistrer} disabled={envoi}>Enregistrer</button>
        </div>
      </dialog>
    </Modal>
  )
}
