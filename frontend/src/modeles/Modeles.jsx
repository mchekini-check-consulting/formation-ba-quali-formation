import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageEnChargement } from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { pluriel } from '../formations/catalogue'
import { DocumentModele } from './DocumentModele'
import { listerModeles, obtenirModele, resumeModeles, STATUTS } from './serviceApi'
import '../styles/modeles.css'

// Chargement d'une donnée du backend pour une page : { donnee, erreur } ; `charger` doit être stable (useCallback)
function useChargement(charger) {
  // Résultat rattaché à son chargement : en changeant de modèle, l'ancien n'est plus affiché
  const [etat, setEtat] = useState({ charger: null, donnee: null, erreur: null })
  useEffect(() => {
    let actif = true
    charger().then((donnee) => { if (actif) setEtat({ charger, donnee, erreur: null }) })
      .catch((erreur) => { if (actif) setEtat({ charger, donnee: null, erreur }) })
    return () => { actif = false }
  }, [charger])
  return etat.charger === charger ? etat : { donnee: null, erreur: null }
}

// Carte cliquable : icône, nom en gras, information en gris, chevron à droite
function Carte({ lien, icone, nom, info }) {
  return (
    <Link className="mod-carte" to={lien}>
      <span className="mod-carte-ic" aria-hidden="true"><Icone nom={icone} taille={20} /></span>
      <span className="mod-carte-t"><b>{nom}</b><span>{info}</span></span>
      <span className="mod-carte-chev" aria-hidden="true"><Icone nom="chevDroite" taille={16} /></span>
    </Link>
  )
}

// « ← Retour » et fil d'Ariane : toutes les étapes sont des liens, sauf la dernière (page affichée)
function FilAriane({ retour, etapes }) {
  const navigate = useNavigate()
  return (
    <div className="mod-fil">
      <button type="button" className="btn btn-line btn-sm" onClick={() => navigate(retour)}>← Retour</button>
      <nav aria-label="Fil d'Ariane">
        {etapes.map((e, i) => (i < etapes.length - 1
          ? <span key={e.libelle}><Link to={e.lien}>{e.libelle}</Link><span aria-hidden="true"> › </span></span>
          : <b key={e.libelle} aria-current="page">{e.libelle}</b>))}
      </nav>
    </div>
  )
}

const MODELES = { libelle: 'Modèles', lien: '/modeles' }
const GENERIQUES = { libelle: 'Modèles génériques', lien: '/modeles/generiques' }
const chargerResume = () => resumeModeles()
const chargerListe = () => listerModeles()

// SCRUM-210 « Accéder aux modèles par dossiers » (maquette SCRUM-210-1-Accueil-Modeles) : deux dossiers et leur compteur
export function ModelesAccueil() {
  const { donnee: resume, erreur } = useChargement(chargerResume)
  if (!resume) return <PageEnChargement erreur={erreur} texte="Chargement des modèles…" />
  const { nb_modeles: modeles, nb_formations: formations } = resume
  return (
    <div className="wrap modeles">
      <div className="page-head"><h1>Modèles</h1></div>
      <div className="mod-dossiers">
        <Carte lien="/modeles/generiques" icone="doc" nom="Modèles génériques" info={`${modeles} ${pluriel(modeles, 'modèle')}`} />
        <Carte lien="/modeles/formations" icone="dossier" nom="Modèles par formation" info={`${formations} ${pluriel(formations, 'formation')}`} />
      </div>
    </div>
  )
}

// Un dossier ouvert : titre « Modèles », retour et fil d'Ariane, puis son contenu
export function DossierModeles({ titre, children }) {
  return (
    <div className="wrap modeles">
      <div className="page-head"><h1>Modèles</h1></div>
      <FilAriane retour="/modeles" etapes={[MODELES, { libelle: titre }]} />
      {children}
    </div>
  )
}

// SCRUM-212 : carte d'un modèle générique (maquette SCRUM-212-1) : miniature du vrai document (« Ouvrir » au survol),
// nom avec son repère de couleur, statut (RG4), « Rétablir le modèle d'origine » si modifié (SCRUM-217) et
// « Dupliquer » (SCRUM-218), visibles mais inactifs tant que ces US ne sont pas faites.
// RG7 : un clic sur la miniature ou le nom ouvre directement le modèle (éditeur : SCRUM-213).
function CarteModele({ modele }) {
  const lien = `/modeles/generiques/${modele.type.toLowerCase()}`
  return (
    <article className="mod-modele" aria-label={modele.nom}>
      <Link className="mod-mini" to={lien} aria-label={`Ouvrir ${modele.nom}`}>
        <span className="mod-mini-page" aria-hidden="true">
          <DocumentModele contenu={modele.contenu} variables={modele.variables} />
        </span>
        <span className="mod-mini-ouvrir" aria-hidden="true"><Icone nom="oeil" taille={16} /> Ouvrir</span>
      </Link>
      <div className="mod-modele-corps">
        <Link className={`mod-modele-nom mod-type-${modele.type.toLowerCase()}`} to={lien}>{modele.nom}</Link>
        <span className={`mod-statut-pastille mod-statut-${modele.statut.toLowerCase()}`}>{STATUTS[modele.statut] || modele.statut}</span>
        <div className="mod-modele-actions">
          {modele.statut !== 'ORIGINE'
            && <button type="button" className="mod-retablir" disabled title="Bientôt disponible">Rétablir le modèle d’origine</button>}
          <button type="button" className="btn btn-line btn-sm" disabled title="Bientôt disponible">Dupliquer</button>
        </div>
      </div>
    </article>
  )
}

// SCRUM-211/212 : message orange (RG13, sans bouton) si une information de l'organisme manque, puis les 4 cartes
export function ModelesGeneriques() {
  const { donnee, erreur } = useChargement(chargerListe)
  return (
    <DossierModeles titre="Modèles génériques">
      {donnee
        ? <>
            {!donnee.parametres_complets && (
              <p className="mod-parametres">
                <Icone nom="alert" taille={18} />
                <span>Pensez à remplir les informations de votre organisme dans <b>Paramètres</b> : elles apparaîtront automatiquement dans vos documents.</span>
              </p>
            )}
            <div className="mod-grille">
              {donnee.modeles.map((m) => <CarteModele key={m.type} modele={m} />)}
            </div>
          </>
        : <PageEnChargement erreur={erreur} texte="Chargement des modèles…" />}
    </DossierModeles>
  )
}

// SCRUM-211 (CA2) : un modèle générique ouvert, le texte et ses variables en étiquettes (éditeur : SCRUM-213)
export function ModeleOuvert() {
  const { type } = useParams()
  const chargerModele = useCallback(() => obtenirModele(type), [type])
  const { donnee: modele, erreur } = useChargement(chargerModele)
  if (!modele) return <PageEnChargement erreur={erreur} texte="Chargement du modèle…" />
  return (
    <div className="wrap modeles">
      <FilAriane retour="/modeles/generiques" etapes={[MODELES, GENERIQUES, { libelle: modele.nom }]} />
      <div className="page-head mod-titre">
        <h1>{modele.nom}</h1>
        <span className="mod-statut">{STATUTS[modele.statut] || modele.statut}</span>
      </div>
      <div className="doc-zone"><DocumentModele contenu={modele.contenu} variables={modele.variables} /></div>
    </div>
  )
}
