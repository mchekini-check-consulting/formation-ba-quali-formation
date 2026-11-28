import { useEffect, useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { creerApprenant, listerEntreprises } from '../sessions/serviceApi'
import { SALARIE, STATUTS_APPRENANT, verifierApprenant } from './apprenants'
import './apprenants.css'

const VIDE = { prenom: '', nom: '', email: '', telephone: '', statut: '', entreprise_id: '', poste: '' }

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

// Fenêtre « Nouvel apprenant » (SCRUM-27, complétée par SCRUM-112), la même partout où l'on crée un apprenant :
// Identité (prénom, nom), Contact (e-mail, téléphone), Situation (statut ; entreprise cliente et poste si « Salarié »).
// « Annuler », la croix, Échap ou un clic à côté la ferment. onCree(apprenant) : appelé après l'enregistrement.
// Options de présentation (SCRUM-179, « Créer un apprenant » du panneau « Ajouter des apprenants », maquette 06) :
// titre, sousTitre, `simple` (sans titres de sections, une colonne, note en bas) et pied(enregistrer, envoi) pour
// d'autres boutons. Champs, règles et messages d'erreur restent les mêmes. Sans ces options : rien ne change.
export default function PanneauApprenant({
  onFermer, onCree, titre = 'Nouvel apprenant', sousTitre = 'Les champs marqués d’un astérisque sont obligatoires.',
  simple = false, pied,
}) {
  const [a, setA] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreurServeur, setErreurServeur] = useState(null)
  const [entreprises, setEntreprises] = useState([])

  // Liste « Entreprise » : entreprises clientes du centre (vide tant qu'aucune n'existe)
  useEffect(() => {
    let actif = true
    listerEntreprises().then((liste) => { if (actif) setEntreprises(liste) }).catch(() => {})
    return () => { actif = false }
  }, [])

  const saisie = (k, aide) => ({
    id: `app-${k}`, value: a[k], className: `app-inp${erreurs[k] ? ' app-inp-err' : ''}`,
    'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `app-${k}-err` : (aide ? `app-${k}-aide` : undefined),
    onChange: (e) => { setA({ ...a, [k]: e.target.value }); if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined }) },
  })

  const enregistrer = async () => {
    const e = verifierApprenant(a)
    setErreurs(e)
    setErreurServeur(null)
    if (Object.keys(e).length) return
    setEnvoi(true)
    try {
      onCree(await creerApprenant(a))
    } catch (err) {
      setEnvoi(false)
      const champs = Object.fromEntries(Object.entries(err.champs || {}).filter(([k]) => k in VIDE).map(([k, v]) => [k, [].concat(v)[0]]))
      setErreurs(champs)
      if (!Object.keys(champs).length) setErreurServeur(err.message)
    }
  }

  return (
    <Modal onFermer={onFermer} classeFond="pa-fond">
      <dialog open className={`pa app-panneau${simple ? ' app-panneau-simple' : ''}`} aria-modal="true" aria-labelledby="app-titre">
        <div className="app-tete">
          <div>
            <h2 id="app-titre">{titre}</h2>
            <p>{sousTitre}</p>
          </div>
          <button type="button" className="app-croix" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className={`app-corps${simple ? ' app-corps-simple' : ''}`}>
          {erreurServeur && <p className="app-alerte" role="alert">{erreurServeur}</p>}
          <section aria-labelledby="app-identite">
            <h3 id="app-identite" className={simple ? 'app-masque' : undefined}>Identité</h3>
            <div className="app-ligne-champs">
              <Champ id="app-prenom" label="Prénom" obligatoire erreur={erreurs.prenom}><input autoComplete="off" {...saisie('prenom')} /></Champ>
              <Champ id="app-nom" label="Nom" obligatoire erreur={erreurs.nom}><input autoComplete="off" {...saisie('nom')} /></Champ>
            </div>
          </section>
          <section aria-labelledby="app-contact">
            <h3 id="app-contact" className={simple ? 'app-masque' : undefined}>Contact</h3>
            <div className={simple ? 'app-colonne' : 'app-ligne-champs'}>
              <Champ id="app-email" label="E-mail" obligatoire erreur={erreurs.email}><input type="email" autoComplete="off" {...saisie('email')} /></Champ>
              <Champ id="app-telephone" label="Téléphone" aide="Facultatif · 10 chiffres" erreur={erreurs.telephone}>
                <input type="tel" inputMode="tel" placeholder="Ex. : 06 12 34 56 78" autoComplete="off" {...saisie('telephone', true)} />
              </Champ>
            </div>
          </section>
          <section aria-labelledby="app-situation">
            <h3 id="app-situation" className={simple ? 'app-masque' : undefined}>Situation</h3>
            <Champ id="app-statut" label="Statut" obligatoire erreur={erreurs.statut}>
              <select {...saisie('statut')}>
                <option value="">Choisir un statut</option>
                {STATUTS_APPRENANT.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
              </select>
            </Champ>
            {a.statut === SALARIE && (
              <div className={simple ? 'app-colonne' : 'app-ligne-champs'}>
                <Champ id="app-entreprise_id" label="Entreprise" aide="Facultatif · parmi vos entreprises clientes" erreur={erreurs.entreprise_id}>
                  <select {...saisie('entreprise_id', true)}>
                    <option value="">Choisir une entreprise</option>
                    {entreprises.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
                  </select>
                </Champ>
                <Champ id="app-poste" label="Poste" aide="Facultatif" erreur={erreurs.poste}>
                  <input placeholder="Ex. : Assistante RH" autoComplete="off" {...saisie('poste', true)} />
                </Champ>
              </div>
            )}
          </section>
          {simple && <p className="app-note">Les champs marqués * sont obligatoires. L’apprenant sera aussi visible dans « Parties prenantes ».</p>}
        </div>
        {pied ? pied(enregistrer, envoi) : (
          <div className="app-pied">
            <button type="button" className="app-btn app-btn-secondaire" onClick={onFermer}>Annuler</button>
            <button type="button" className="app-btn app-btn-principal" onClick={enregistrer} disabled={envoi}>Enregistrer</button>
          </div>
        )}
      </dialog>
    </Modal>
  )
}
