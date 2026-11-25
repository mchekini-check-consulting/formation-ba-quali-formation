import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import {
  BLOCS, enregistrerCentre, PAGE_APRES_CENTRE, sansEspaces, titreErreurs, verifierCentre, VIDE,
} from '../compte/centre'
import { rechercherEntreprise } from '../entreprises/rechercheEntreprise'
import { compteConnecte, MSG_BIENVENUE, seDeconnecter } from '../compte/serviceCompte'
import '../styles/premiere-connexion.css'

// Résultat de la recherche par SIRET, sous le champ (maquettes 02 et 03)
const MESSAGES_SIRET = {
  trouvee: { classe: 'pc-siret-ok', icone: 'check', texte: 'Informations trouvées. Vérifiez-les avant d’enregistrer.' },
  introuvable: { classe: 'pc-siret-ko', icone: 'info', texte: 'Aucune information trouvée, renseignez les champs ci-dessous.' },
}

// Un champ du formulaire : libellé, astérisque si obligatoire, puis dessous : erreur, sinon résultat de la recherche
// par SIRET, sinon aide
function Champ({ c, valeur, erreur, recherche, onChange }) {
  const id = `pc-${c.nom}`
  const info = !erreur && MESSAGES_SIRET[recherche]
  const sous = erreur ? `${id}-err` : info ? `${id}-info` : c.aide ? `${id}-aide` : undefined
  return (
    <div className={`field${c.pleine ? ' full' : ''}`}>
      <label className="lbl" htmlFor={id}>{c.libelle}{c.obligatoire && <> <span className="req" aria-hidden="true">*</span></>}</label>
      <input id={id} className={`inp${erreur ? ' err' : ''}`} type={c.type || 'text'} inputMode={c.mode} placeholder={c.exemple}
        value={valeur} onChange={(e) => onChange(c.nom, e.target.value)} autoComplete="off"
        aria-required={c.obligatoire || undefined} aria-invalid={erreur ? true : undefined} aria-describedby={sous} />
      {erreur ? <span className="errtxt" id={`${id}-err`}>{erreur}</span>
        : info ? (
          <p className={`pc-siret ${info.classe}`} id={`${id}-info`} role="status">
            <Icone nom={info.icone} taille={16} epaisseur={2.2} />{info.texte}
          </p>
        ) : c.aide && <span className="pc-aide" id={`${id}-aide`}>{c.aide}</span>}
    </div>
  )
}

// Page « Première connexion » (SCRUM-221, maquettes 01 à 04) : obligatoire tant que le centre n'est pas enregistré.
// Sans menu : seuls l'e-mail du compte et « Se déconnecter » sont proposés en haut (critère 2).
function PremiereConnexion() {
  const navigate = useNavigate()
  // Critère 1 : « Votre compte a été créé. », seulement en arrivant de la création du compte (pas à une reconnexion)
  const compteCree = useLocation().state?.message
  const [compte, setCompte] = useState(undefined) // undefined : chargement ; null : personne n'est connecté
  const [valeurs, setValeurs] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [general, setGeneral] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [recherche, setRecherche] = useState(null) // null, 'trouvee' ou 'introuvable'
  const siretRecherche = useRef(null) // dernier SIRET recherché : seule sa réponse est prise en compte
  const bandeau = useRef(null)

  useEffect(() => {
    let actif = true
    compteConnecte().then((c) => { if (actif) setCompte(c) })
    return () => { actif = false }
  }, [])

  if (compte === undefined) return <p className="chargement">Chargement…</p>
  if (compte === null) return <Navigate to="/se-connecter" replace />
  if (compte.organisme) return <Navigate to={PAGE_APRES_CENTRE} replace /> // critère 6 : déjà enregistré, le formulaire ne s’affiche plus

  const oublierErreurs = (...noms) => setErreurs((e) => Object.fromEntries(Object.entries(e).filter(([n]) => !noms.includes(n))))

  // Critères 3 et 4 : dès que le SIRET a 14 chiffres, recherche du centre ; raison sociale et adresse pré-remplies
  // (toujours modifiables), sinon message orange et saisie manuelle
  const rechercher = async (siret) => {
    siretRecherche.current = siret
    setRecherche(null)
    const resultat = await rechercherEntreprise(siret)
    if (siretRecherche.current !== siret) return // le SIRET a changé pendant la recherche
    if (resultat.statut === 'trouvee') {
      const { raison_sociale: raisonSociale, adresse } = resultat.entreprise
      setValeurs((v) => ({ ...v, raison_sociale: raisonSociale || v.raison_sociale, adresse: adresse || v.adresse }))
      oublierErreurs(...(raisonSociale ? ['raison_sociale'] : []), ...(adresse ? ['adresse'] : []))
    }
    setRecherche(resultat.statut)
  }

  const changer = (nom, valeur) => {
    setValeurs((v) => ({ ...v, [nom]: valeur }))
    if (erreurs[nom]) oublierErreurs(nom)
    if (nom !== 'siret') return
    const siret = sansEspaces(valeur)
    if (!/^\d{14}$/.test(siret)) {
      siretRecherche.current = null
      setRecherche(null)
    } else if (siret !== siretRecherche.current) {
      rechercher(siret)
    }
  }

  // Critère 5 : rien n'est enregistré et les champs concernés sont signalés
  const refuser = (trouvees, message = null) => {
    setErreurs(trouvees)
    setGeneral(message)
    setEnvoi(false)
    requestAnimationFrame(() => bandeau.current?.scrollIntoView?.({ block: 'center' }))
  }

  const enregistrer = async (e) => {
    e.preventDefault()
    const trouvees = verifierCentre(valeurs)
    if (Object.keys(trouvees).length) return refuser(trouvees)
    setEnvoi(true)
    try {
      await enregistrerCentre(valeurs)
      // Critère 6 : le centre est créé, l'utilisateur en est le gestionnaire ; Sessions et planning s'affiche
      await navigate(PAGE_APRES_CENTRE, { replace: true, state: { message: MSG_BIENVENUE } })
    } catch (err) {
      refuser(err.erreurs || {}, err.general || null)
    }
  }

  const deconnecter = async () => {
    try {
      await seDeconnecter()
      await navigate('/se-connecter', { replace: true, state: { deconnecte: true } })
    } catch (err) {
      setGeneral(err.message)
    }
  }

  const nbErreurs = Object.keys(erreurs).length
  return (
    <div className="pc">
      <header className="pc-haut">
        {/* Logo sans lien : on ne quitte le formulaire qu'en l'enregistrant ou en se déconnectant (critère 2) */}
        <span className="logo"><span className="logo-badge"><Icone nom="qualiopi" taille={18} epaisseur={2.2} /></span>Quali-formation</span>
        <p className="pc-compte">{compte.email} · <button type="button" className="pc-lien" onClick={deconnecter}>Se déconnecter</button></p>
      </header>

      <form className="pc-page" onSubmit={enregistrer} noValidate aria-labelledby="pc-titre">
        <div className="pc-tete">
          <div>
            <span className="pc-pastille">Première connexion</span>
            <h1 id="pc-titre">Bienvenue ! Présentez-nous votre centre</h1>
            <p className="sub">Ces informations seront reprises automatiquement dans tous vos documents.</p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={envoi}>Enregistrer</button>
        </div>

        {/* Maquette 02 : en cas d'erreur, seul le bandeau rouge s'affiche ; maquette 01 : bandeau vert (juste après la
            création du compte) puis le rappel « étape obligatoire » */}
        <div ref={bandeau} className="pc-bandeaux">
          {nbErreurs > 0 || general ? (
            <p className="pc-bandeau pc-bandeau-erreur" role="alert">
              <Icone nom="alert" taille={18} />
              <span>{nbErreurs > 0 ? <><b>{titreErreurs(nbErreurs)}</b> Rien n’a été enregistré.</> : general}</span>
            </p>
          ) : (
            <>
              {compteCree && (
                <p className="pc-bandeau pc-bandeau-ok" role="status"><Icone nom="check" taille={18} epaisseur={2.4} /><b>{compteCree}</b></p>
              )}
              <p className="pc-bandeau">
                <Icone nom="info" taille={18} />
                <span>Cette étape est obligatoire pour accéder à Quali-formation. Les champs marqués <span className="req">*</span> sont obligatoires.</span>
              </p>
            </>
          )}
        </div>

        {BLOCS.map((bloc) => (
          <section className="card pc-bloc" key={bloc.id} aria-labelledby={`pc-${bloc.id}`}>
            <div className="pc-bloc-tete">
              <span className="pc-bloc-ic" aria-hidden="true"><Icone nom={bloc.icone} taille={18} /></span>
              <div><h2 id={`pc-${bloc.id}`}>{bloc.titre}</h2><p className="sub">{bloc.sous_titre}</p></div>
            </div>
            {bloc.groupes.map((groupe, i) => (
              <div className="pc-groupe" key={groupe.titre || i}>
                {groupe.titre && <h3 className="pc-groupe-titre">{groupe.titre}</h3>}
                <div className="pc-grille">
                  {groupe.champs.map((c) => (
                    <Champ key={c.nom} c={c} valeur={valeurs[c.nom]} erreur={erreurs[c.nom]} onChange={changer}
                      recherche={c.nom === 'siret' ? recherche : null} />
                  ))}
                  {groupe.email && (
                    <div className="field full">
                      <label className="lbl" htmlFor="pc-email">E-mail</label>
                      <div className="pc-verrou">
                        <input id="pc-email" className="inp" type="email" value={compte.email} readOnly aria-readonly="true"
                          aria-describedby="pc-email-aide" />
                        <Icone nom="cadenas" taille={18} />
                      </div>
                      <span className="pc-aide" id="pc-email-aide">E-mail de votre compte, non modifiable</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))}

        <div className="pc-pied">
          <p><span className="req">*</span> Champs obligatoires</p>
          <button type="submit" className="btn btn-primary" disabled={envoi}>Enregistrer et accéder à Quali-formation</button>
        </div>
      </form>
    </div>
  )
}

export default PremiereConnexion
