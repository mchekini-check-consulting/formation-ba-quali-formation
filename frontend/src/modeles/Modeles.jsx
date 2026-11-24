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

// SCRUM-211 (CA1) : les 4 modèles génériques du compte et leur statut (cartes complètes : SCRUM-212)
export function ModelesGeneriques() {
  const { donnee: modeles, erreur } = useChargement(chargerListe)
  return (
    <DossierModeles titre="Modèles génériques">
      {modeles
        ? <div className="mod-dossiers">
            {modeles.map((m) => <Carte key={m.type} lien={`/modeles/generiques/${m.type.toLowerCase()}`} icone="doc" nom={m.nom} info={STATUTS[m.statut] || m.statut} />)}
          </div>
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
