import { useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { creerEntreprise, rechercherAnnuaire } from '../sessions/serviceApi'
import {
  corpsEntreprise, ENTREPRISE_VIDE, LONGUEUR_MIN_RECHERCHE, MSG_RECHERCHE_COURTE, ROLES, siretFr, verifierEntreprise, villeFr,
} from './entreprises'
import '../apprenants/apprenants.css'
import './entreprises.css'

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

// Panneau « Nouvelle entreprise cliente » (SCRUM-113) : Recherche dans l'annuaire officiel, puis, une fois un
// établissement choisi ou la saisie manuelle lancée, Entreprise, Facturation, Contact et Interlocuteur principal.
// « Enregistrer » reste inactif jusque-là. « Annuler », la croix, Échap ou un clic à côté le ferment sans rien créer.
// onCree(entreprise) : appelé après l'enregistrement.
export default function PanneauEntreprise({ onFermer, onCree }) {
  const [recherche, setRecherche] = useState('')
  const [erreurRecherche, setErreurRecherche] = useState(null)
  const [enRecherche, setEnRecherche] = useState(false)
  const [resultats, setResultats] = useState(null) // null : pas de recherche affichée ; [] : aucun établissement
  const [formulaire, setFormulaire] = useState(false) // sections affichées (établissement choisi ou saisie manuelle)
  const [e, setE] = useState(ENTREPRISE_VIDE)
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreurServeur, setErreurServeur] = useState(null)

  const modifier = (k, valeur) => {
    setE({ ...e, [k]: valeur })
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined })
  }
  const saisie = (k, aide) => ({
    id: `ent-${k}`, value: e[k], className: `app-inp${erreurs[k] ? ' app-inp-err' : ''}`, autoComplete: 'off',
    'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `ent-${k}-err` : (aide ? `ent-${k}-aide` : undefined),
    onChange: (ev) => modifier(k, ev.target.value),
  })

  const chercher = async () => {
    if (recherche.trim().length < LONGUEUR_MIN_RECHERCHE) {
      setErreurRecherche(MSG_RECHERCHE_COURTE)
      return
    }
    setErreurRecherche(null)
    setEnRecherche(true)
    try {
      setResultats(await rechercherAnnuaire(recherche))
    } catch {
      setResultats([]) // annuaire indisponible : même message qu'aucun résultat, avec la saisie manuelle
    }
    setEnRecherche(false)
  }

  const choisir = (etab) => {
    setE({ ...ENTREPRISE_VIDE, ...e, ...etab })
    setErreurs({})
    setResultats(null)
    setFormulaire(true)
  }
  const saisirManuellement = () => {
    setResultats(null)
    setFormulaire(true)
  }

  const enregistrer = async () => {
    const verif = verifierEntreprise(e)
    setErreurs(verif)
    setErreurServeur(null)
    if (Object.keys(verif).length) return
    setEnvoi(true)
    try {
      onCree(await creerEntreprise(corpsEntreprise(e)))
    } catch (err) {
      setEnvoi(false)
      if (err.code === 'SIRET_DEJA_ENREGISTRE') {
        setErreurs({ siret: err.message })
        return
      }
      const champs = Object.fromEntries(Object.entries(err.champs || {}).filter(([k]) => k in ENTREPRISE_VIDE)
        .map(([k, v]) => [k, [].concat(v)[0]]))
      setErreurs(champs)
      if (!Object.keys(champs).length) setErreurServeur(err.message)
    }
  }

  return (
    <Modal onFermer={onFermer} classeFond="pa-fond">
      <dialog open className="pa app-panneau" aria-modal="true" aria-labelledby="ent-titre">
        <div className="app-tete">
          <h2 id="ent-titre">Nouvelle entreprise cliente</h2>
          <button type="button" className="app-croix" aria-label="Fermer" onClick={onFermer}><Icone nom="x" taille={18} /></button>
        </div>
        <div className="app-corps">
          {erreurServeur && <p className="app-alerte" role="alert">{erreurServeur}</p>}
          <section aria-labelledby="ent-recherche-titre">
            <h3 id="ent-recherche-titre">Recherche</h3>
            <div className="app-champ">
              <label className="app-lbl" htmlFor="ent-recherche">Raison sociale ou SIRET</label>
              <div className="ent-recherche-ligne">
                <input id="ent-recherche" className={`app-inp${erreurRecherche ? ' app-inp-err' : ''}`} autoComplete="off"
                       placeholder="Ex. : Durand ou 389 456 123 00034" value={recherche}
                       aria-invalid={erreurRecherche ? true : undefined}
                       aria-describedby={erreurRecherche ? 'ent-recherche-err' : 'ent-recherche-aide'}
                       onChange={(ev) => { setRecherche(ev.target.value); setErreurRecherche(null) }}
                       onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void chercher() } }} />
                <button type="button" className="app-btn app-btn-principal" onClick={chercher} disabled={enRecherche}>Rechercher</button>
              </div>
              {erreurRecherche
                ? <span className="app-err" id="ent-recherche-err">{erreurRecherche}</span>
                : <span className="app-aide" id="ent-recherche-aide">3 caractères minimum · annuaire officiel des entreprises</span>}
            </div>
            {resultats?.length > 0 && (
              <ul className="ent-resultats" aria-label="Établissements trouvés">
                {resultats.map((r) => (
                  <li key={r.siret}>
                    <button type="button" className="ent-resultat" onClick={() => choisir(r)}>
                      <b>{r.raison_sociale}</b>
                      <span>SIRET {siretFr(r.siret)}{r.ville && ` · ${villeFr(r.ville)}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {resultats?.length === 0 && (
              <div className="ent-aucun" role="status">
                <b>Aucun établissement trouvé</b>
                <button type="button" className="app-btn app-btn-secondaire" onClick={saisirManuellement}>Saisir l’entreprise manuellement</button>
              </div>
            )}
          </section>

          {formulaire && (
            <>
              <section aria-labelledby="ent-entreprise-titre">
                <h3 id="ent-entreprise-titre">Entreprise</h3>
                <Champ id="ent-raison_sociale" label="Raison sociale" obligatoire erreur={erreurs.raison_sociale}><input {...saisie('raison_sociale')} /></Champ>
                <div className="app-ligne-champs">
                  <Champ id="ent-siret" label="SIRET" obligatoire aide="14 chiffres" erreur={erreurs.siret}>
                    <input inputMode="numeric" {...saisie('siret', true)} />
                  </Champ>
                  <Champ id="ent-forme_juridique" label="Forme juridique"><input {...saisie('forme_juridique')} /></Champ>
                </div>
                <div className="app-ligne-champs">
                  <Champ id="ent-code_naf" label="Code NAF"><input {...saisie('code_naf')} /></Champ>
                </div>
                <Champ id="ent-adresse" label="Adresse" obligatoire erreur={erreurs.adresse}><input {...saisie('adresse')} /></Champ>
                <div className="app-ligne-champs">
                  <Champ id="ent-code_postal" label="Code postal" obligatoire erreur={erreurs.code_postal}><input {...saisie('code_postal')} /></Champ>
                  <Champ id="ent-ville" label="Ville" obligatoire erreur={erreurs.ville}><input {...saisie('ville')} /></Champ>
                </div>
              </section>
              <section aria-labelledby="ent-facturation-titre">
                <h3 id="ent-facturation-titre">Facturation</h3>
                <label className="ent-case">
                  <input type="checkbox" checked={e.adresse_facturation_identique}
                         onChange={(ev) => modifier('adresse_facturation_identique', ev.target.checked)} />
                  Adresse de facturation identique
                </label>
                {!e.adresse_facturation_identique && (
                  <Champ id="ent-adresse_facturation" label="Adresse de facturation" obligatoire erreur={erreurs.adresse_facturation}>
                    <input {...saisie('adresse_facturation')} />
                  </Champ>
                )}
              </section>
              <section aria-labelledby="ent-contact-titre">
                <h3 id="ent-contact-titre">Contact</h3>
                <Champ id="ent-email" label="E-mail de l’entreprise" aide="Facultatif · adresse générale, ex. : contact@…" erreur={erreurs.email}>
                  <input type="email" {...saisie('email', true)} />
                </Champ>
              </section>
              <section aria-labelledby="ent-interlocuteur-titre">
                <div>
                  <h3 id="ent-interlocuteur-titre">Interlocuteur principal</h3>
                  <span className="app-aide">Facultatif</span>
                </div>
                <div className="app-ligne-champs">
                  <Champ id="ent-interlocuteur_prenom" label="Prénom"><input {...saisie('interlocuteur_prenom')} /></Champ>
                  <Champ id="ent-interlocuteur_nom" label="Nom"><input {...saisie('interlocuteur_nom')} /></Champ>
                </div>
                <Champ id="ent-interlocuteur_role" label="Rôle" erreur={erreurs.interlocuteur_role}>
                  <select {...saisie('interlocuteur_role')}>
                    <option value="">Choisir un rôle</option>
                    {ROLES.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
                  </select>
                </Champ>
                <div className="app-ligne-champs">
                  <Champ id="ent-interlocuteur_email" label="E-mail" erreur={erreurs.interlocuteur_email}>
                    <input type="email" {...saisie('interlocuteur_email')} />
                  </Champ>
                  <Champ id="ent-interlocuteur_telephone" label="Téléphone" aide="10 chiffres" erreur={erreurs.interlocuteur_telephone}>
                    <input type="tel" inputMode="tel" {...saisie('interlocuteur_telephone', true)} />
                  </Champ>
                </div>
              </section>
            </>
          )}
        </div>
        <div className="app-pied">
          <button type="button" className="app-btn app-btn-secondaire" onClick={onFermer}>Annuler</button>
          <button type="button" className="app-btn app-btn-principal" onClick={enregistrer} disabled={!formulaire || envoi}>Enregistrer</button>
        </div>
      </dialog>
    </Modal>
  )
}
