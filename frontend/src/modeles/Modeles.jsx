import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageEnChargement } from '../components/ErreurChargement'
import { ConfirmDialog, Modal } from '../components/Modal'
import Icone from '../components/Icone'
import { useToast } from '../components/toastContext'
import { pluriel } from '../formations/catalogue'
import { DocumentModele } from './DocumentModele'
import { FenetreDupliquer } from './FenetreDupliquer'
import { FenetreGenerique } from './FenetreGenerique'
import { FenetreOrigine } from './FenetreOrigine'
import { EditeurDocument } from './editeur/EditeurDocument'
import { BoutonImportWord } from './editeur/BoutonImportWord'
import {
  adresseExportWord, adresseExportWordFormation, creerModeleFormation, dossierFormation, enregistrerModele,
  enregistrerModeleFormation, formationsPourDuplication, importerWord, listerModeles, listerModelesParFormation,
  listerVariables, messageCreationFormation, messageGeneriqueRetabli, messageEnregistrementFormation, messageEnregistrement,
  nomFichierWord, obtenirModele, obtenirModeleFormation, resumeModeles, retablirGenerique, STATUTS, telechargerWord,
} from './serviceApi'
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
function Carte({ lien, icone, nom, info, infoEnAvant = false }) {
  return (
    <Link className="mod-carte" to={lien}>
      <span className="mod-carte-ic" aria-hidden="true"><Icone nom={icone} taille={20} /></span>
      <span className="mod-carte-t"><b>{nom}</b><span className={infoEnAvant ? 'mod-carte-en-avant' : undefined}>{info}</span></span>
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
const PAR_FORMATION = { libelle: 'Modèles par formation', lien: '/modeles/formations' }
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
// nom avec son repère de couleur, statut (RG4), « Rétablir le modèle d'origine » si modifié (SCRUM-217 : fenêtre
// du modèle d'origine, statut mis à jour après rétablissement) et « Dupliquer » (SCRUM-218 : fenêtre de choix de la
// formation, RG14 : seulement depuis les modèles génériques).
// RG7 : un clic sur la miniature ou le nom ouvre directement le modèle (éditeur : SCRUM-213).
// Carte d'un document (modèle générique ou modèle de la formation) : miniature, nom, statut, puis `actions`
function CarteDocument({ modele, lien, children }) {
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
        {children}
      </div>
    </article>
  )
}

function CarteModele({ modele: initial }) {
  const navigate = useNavigate()
  const [modele, setModele] = useState(initial)
  const [fenetre, setFenetre] = useState(false)
  const [dupliquer, setDupliquer] = useState(false)
  const lien = `/modeles/generiques/${modele.type.toLowerCase()}`
  return (
    <CarteDocument modele={modele} lien={lien}>
      <div className="mod-modele-actions">
        {modele.statut !== 'ORIGINE'
          && <button type="button" className="mod-retablir" onClick={() => setFenetre(true)}>Rétablir le modèle d’origine</button>}
        <button type="button" className="btn btn-line btn-sm" onClick={() => setDupliquer(true)}>Dupliquer</button>
      </div>
      {fenetre && (
        <FenetreOrigine modele={modele} onFermer={() => setFenetre(false)} onPersonnaliser={() => navigate(lien)}
          onRetabli={(retabli) => { setModele(retabli); setFenetre(false) }} />
      )}
      {dupliquer && <FenetreDupliquer modele={modele} onFermer={() => setDupliquer(false)} />}
    </CarteDocument>
  )
}

// SCRUM-211/212 : les 4 cartes (plus de message orange « Pensez à remplir… » : l'organisme renseigne ses
// informations à sa première connexion)
export function ModelesGeneriques() {
  const { donnee, erreur } = useChargement(chargerListe)
  return (
    <DossierModeles titre="Modèles génériques">
      {donnee
        ? <div className="mod-grille">
            {donnee.modeles.map((m) => <CarteModele key={m.type} modele={m} />)}
          </div>
        : <PageEnChargement erreur={erreur} texte="Chargement des modèles…" />}
    </DossierModeles>
  )
}

// SCRUM-213 (maquettes SCRUM-213-1/2) : le modèle générique dans l'éditeur. RG8 : rien n'est envoyé avant
// « Enregistrer » ; « ← Retour » quitte sans rien envoyer. RG3 : seul le modèle générique du compte est écrit.
// SCRUM-217 : « Voir le modèle d'origine » ouvre la fenêtre du modèle d'origine ; après rétablissement, l'éditeur
// affiche le modèle d'origine (modifications non enregistrées perdues : l'utilisateur a confirmé).
// SCRUM-218 (maquette SCRUM-218-2) : avec `formation`, l'éditeur prépare le nouveau modèle de cette formation à partir
// du modèle générique : bandeau, rien n'est créé avant « Enregistrer » (RG8), « ← Retour » ne crée rien.
// SCRUM-215 : guide affiché après un import Word (maquette SCRUM-215-1), fermé par « J'ai compris »
function GuideImport({ onFermer }) {
  return (
    <section className="mod-guide" aria-labelledby="mod-guide-titre">
      <div>
        <h2 id="mod-guide-titre">Votre document est importé. Dernière étape : indiquez les informations qui changent.</h2>
        <p>Votre fichier contient les informations d’un seul apprenant (nom, entreprise, dates…). Remplacez-les par les variables à droite : elles seront remplies automatiquement pour chaque apprenant.</p>
        <ol>
          <li><b>Sélectionnez</b> une information dans le document, par exemple « Camille ».</li>
          <li><b>Cliquez</b> sur la variable correspondante à droite, par exemple « Prénom ».</li>
          <li><b>Vérifiez</b> avec l’aperçu, puis <b>enregistrez</b>.</li>
        </ol>
      </div>
      <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>J’ai compris</button>
    </section>
  )
}

// Phrase sous le titre de l'éditeur : modèle générique, nouveau modèle de la formation ou modèle de la formation
function sousTitre(formation, nouveau) {
  if (!formation) return 'Modifiez le texte librement. Glissez les variables à droite dans le document : elles seront remplacées par les vraies informations.'
  if (nouveau) return `Nouveau modèle de la formation « ${formation.intitule} ».`
  return `Modèle de la formation « ${formation.intitule} ». Il remplace le modèle générique pour toutes les sessions de cette formation.`
}

function EditeurModeleGenerique({ modele, catalogue, formation = null, nouveau = false }) {
  const toast = useToast()
  const navigate = useNavigate()
  const contenu = useRef(modele.contenu)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  // SCRUM-215 : document affiché (remplacé par un import, l'éditeur est alors rouvert avec une nouvelle clé),
  // nom du fichier importé (encadré « Document importé ») et import à enregistrer avec « Enregistrer » (RG8)
  const [affiche, setAffiche] = useState({ contenu: modele.contenu, cle: 0 })
  const [fichierImporte, setFichierImporte] = useState(
    modele.statut === 'IMPORTE' || modele.statut === 'FORMATION' ? modele.nom_fichier_importe : null)
  const [importAEnregistrer, setImportAEnregistrer] = useState(null)
  const [guide, setGuide] = useState(false)
  // Refus d'un import (format, taille, fichier illisible) : affiché sous le bouton d'import, pas en haut de la page
  const [erreurImport, setErreurImport] = useState(null)
  // SCRUM-216 : le Word téléchargé est la dernière version ENREGISTRÉE ; modifications ou import pas encore
  // enregistrés -> fenêtre de confirmation avant de télécharger
  const [nonEnregistre, setNonEnregistre] = useState(false)
  const [confirmerExport, setConfirmerExport] = useState(false)
  const [telechargement, setTelechargement] = useState(false)
  // SCRUM-217 : dernière version enregistrée (statut, document importé) pour la fenêtre du modèle d'origine
  const [enregistre, setEnregistre] = useState(modele)
  const [variables, setVariables] = useState(modele.variables)
  // Fenêtre ouverte : { maVersion } = le document affiché dans l'éditeur au moment de l'ouverture
  const [fenetreOrigine, setFenetreOrigine] = useState(null)
  // SCRUM-219 : modèle de la formation déjà enregistré (et pas le nouveau de SCRUM-218)
  const deLaFormation = formation && !nouveau
  const dossier = formation && `/modeles/formations/${formation.id}`
  const [fenetreGenerique, setFenetreGenerique] = useState(false)

  function importe({ contenu: html, nomFichier }) {
    contenu.current = html
    setAffiche((d) => ({ contenu: html, cle: d.cle + 1 }))
    setFichierImporte(nomFichier)
    setImportAEnregistrer(nomFichier)
    setGuide(true)
    setNonEnregistre(true)
  }

  const boutonImport = (libelle, className) => (
    <BoutonImportWord libelle={libelle} className={className} importer={(fichier) => importerWord(modele.type, fichier)}
      onImporte={importe} onErreur={setErreurImport} />
  )

  async function telecharger() {
    setConfirmerExport(false)
    setTelechargement(true)
    setErreur(null)
    try {
      const adresse = deLaFormation ? adresseExportWordFormation(formation.id, modele.type) : adresseExportWord(modele.type)
      await telechargerWord(adresse, nomFichierWord(modele.nom))
    } catch (e) {
      setErreur(e.message)
    } finally {
      setTelechargement(false)
    }
  }

  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      if (nouveau) {
        // RG17 : le modèle de la formation part du document affiché (modèle générique, « Mon document » compris)
        await creerModeleFormation(formation.id, modele.type, contenu.current, fichierImporte)
        toast(messageCreationFormation(formation.intitule))
        navigate(dossier)
        return
      }
      if (deLaFormation) {
        await enregistrerModeleFormation(formation.id, modele.type, contenu.current, importAEnregistrer)
        toast(messageEnregistrementFormation(formation.intitule))
        setImportAEnregistrer(null)
        setNonEnregistre(false)
        return
      }
      const resultat = await enregistrerModele(modele.type, contenu.current, importAEnregistrer)
      setEnregistre(resultat)
      toast(messageEnregistrement(resultat))
      setImportAEnregistrer(null)
      setNonEnregistre(false)
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnvoi(false)
    }
  }

  // Modèle d'origine rétabli : l'éditeur repart du modèle d'origine, sans document importé ni modification en cours
  function retabli(origine) {
    contenu.current = origine.contenu
    setAffiche((d) => ({ contenu: origine.contenu, cle: d.cle + 1 }))
    setVariables(origine.variables)
    setEnregistre(origine)
    setFichierImporte(null)
    setImportAEnregistrer(null)
    setGuide(false)
    setNonEnregistre(false)
    setFenetreOrigine(null)
  }

  return (
    <div className="wrap modeles">
      <FilAriane retour={deLaFormation ? dossier : '/modeles/generiques'} etapes={formation
        ? [MODELES, PAR_FORMATION, { libelle: formation.intitule, lien: dossier }, { libelle: modele.nom }]
        : [MODELES, GENERIQUES, { libelle: modele.nom }]} />
      <div className="mod-entete">
        <h1>{modele.nom}{formation && <span className="mod-formation-pastille">{formation.intitule}</span>}</h1>
        <p>{sousTitre(formation, nouveau)}</p>
        <div className="mod-actions">
          <button type="button" className="btn btn-line" disabled={telechargement}
            onClick={() => (nonEnregistre ? setConfirmerExport(true) : telecharger())}>
            {telechargement ? 'Téléchargement…' : 'Télécharger en Word'}
          </button>
          {!formation
            && <button type="button" className="btn btn-line" onClick={() => setFenetreOrigine({ maVersion: contenu.current })}>Voir le modèle d’origine</button>}
          {deLaFormation
            && <button type="button" className="btn btn-line" onClick={() => setFenetreGenerique(true)}>Voir le modèle générique</button>}
          <button type="button" className="btn btn-primary" onClick={enregistrer} disabled={envoi}>Enregistrer</button>
        </div>
        {erreur && <p className="mod-erreur" role="alert">{erreur}</p>}
      </div>
      {fenetreGenerique && <FenetreGenerique modele={modele} onFermer={() => setFenetreGenerique(false)} />}
      {nouveau && (
        <div className="mod-bandeau" role="status">
          <Icone nom="info" taille={16} />
          <p>Nouveau modèle de la formation « {formation.intitule} », créé à partir du modèle générique. Il sera enregistré quand vous cliquerez sur <b>Enregistrer</b>. Si vous quittez sans enregistrer, rien n’est créé.</p>
        </div>
      )}
      {confirmerExport && (
        <ConfirmDialog titre="Modifications non enregistrées"
          texte="Le fichier Word contiendra la dernière version enregistrée, sans vos modifications. Enregistrez d’abord pour les inclure."
          action="Télécharger quand même" icone="alert" fondIcone="var(--warn-soft)" couleurIcone="var(--warn)"
          onAnnuler={() => setConfirmerExport(false)} onOk={telecharger} />
      )}
      {fenetreOrigine && (
        <FenetreOrigine modele={{ ...modele, ...enregistre, nom: modele.nom, variables }} maVersion={fenetreOrigine.maVersion}
          onFermer={() => setFenetreOrigine(null)} onRetabli={retabli} />
      )}
      {guide && <GuideImport onFermer={() => setGuide(false)} />}
      <EditeurDocument key={affiche.cle} contenu={affiche.contenu} variables={variables} catalogue={catalogue}
        nom={modele.nom} onModification={(html) => { contenu.current = html; setNonEnregistre(true) }}
        avantPanneau={(
          <>
            {fichierImporte
              ? (
                <div className="mod-importe">
                  <Icone nom="doc" taille={18} />
                  <p><b>Document importé</b><span title={fichierImporte}>{fichierImporte}</span></p>
                  {boutonImport('Remplacer le fichier', 'mod-word mod-word-petit')}
                </div>
              )
              : boutonImport('Utiliser mon propre document Word', 'mod-word')}
            {erreurImport && <p className="mod-erreur" role="alert">{erreurImport}</p>}
          </>
        )} />
    </div>
  )
}

// Le modèle et les variables du panneau (SCRUM-214), chargés ensemble avant d'ouvrir l'éditeur
export function ModeleOuvert() {
  const { type } = useParams()
  const charger = useCallback(() => Promise.all([obtenirModele(type), listerVariables()]), [type])
  const { donnee, erreur } = useChargement(charger)
  if (!donnee) return <PageEnChargement erreur={erreur} texte="Chargement du modèle…" />
  const [modele, catalogue] = donnee
  return <EditeurModeleGenerique key={modele.type} modele={modele} catalogue={catalogue} />
}

// SCRUM-218 : nouveau modèle de la formation (après « Créer le modèle de la formation ») : le modèle générique, les
// variables et la formation choisie, qui doit être encore sans modèle pour ce document (RG16) ; rien n'est créé ici
export function ModeleFormationNouveau() {
  const { formation: id, type } = useParams()
  const charger = useCallback(() => Promise.all([obtenirModele(type), listerVariables(), formationsPourDuplication(type)]), [type])
  const { donnee, erreur } = useChargement(charger)
  if (!donnee) return <PageEnChargement erreur={erreur} texte="Chargement du modèle…" />
  const [modele, catalogue, { disponibles, deja_crees: dejaCrees }] = donnee
  const formation = disponibles.find((f) => String(f.id) === id)
  if (!formation) {
    const message = dejaCrees.some((f) => String(f.id) === id)
      ? 'Cette formation a déjà son modèle pour ce document.'
      : 'Formation introuvable.'
    return <PageEnChargement erreur={new Error(message)} texte="" />
  }
  return <EditeurModeleGenerique key={`${modele.type}-${formation.id}`} modele={modele} catalogue={catalogue} formation={formation} nouveau />
}

// SCRUM-219 (maquette SCRUM-219-1) : « Modèles par formation » : un dossier par formation de l'organisme (hors
// archivées), avec « N modèle(s) de la formation » ou « Modèles génériques appliqués »
const chargerParFormation = () => listerModelesParFormation()

export function ModelesParFormation() {
  const { donnee, erreur } = useChargement(chargerParFormation)
  let contenu
  if (!donnee) contenu = <PageEnChargement erreur={erreur} texte="Chargement des formations…" />
  else if (donnee.formations.length === 0) contenu = <p className="mod-vide-texte">Aucune formation pour le moment.</p>
  else {
    contenu = (
      <div className="mod-dossiers">
        {donnee.formations.map((f) => (
          <Carte key={f.id} lien={`/modeles/formations/${f.id}`} icone="dossier" nom={f.intitule} infoEnAvant={f.nb_modeles > 0}
            info={f.nb_modeles > 0 ? `${f.nb_modeles} ${pluriel(f.nb_modeles, 'modèle')} de la formation` : 'Modèles génériques appliqués'} />
        ))}
      </div>
    )
  }
  return <DossierModeles titre="Modèles par formation">{contenu}</DossierModeles>
}

// SCRUM-219 (maquette SCRUM-219-3) : « Rétablir le modèle générique ? » ; « Annuler » ne change rien. RG19 (décision BA
// du 2026-11-27) : le contenu est remplacé par le modèle générique actuel, le modèle reste dans le dossier
function ConfirmerRetablirGenerique({ formation, modele, onAnnuler, onRetabli }) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  async function retablir() {
    setEnvoi(true)
    setErreur(null)
    try {
      onRetabli(await retablirGenerique(formation.id, modele.type))
    } catch (e) {
      setErreur(e.message)
      setEnvoi(false)
    }
  }
  return (
    <Modal onFermer={onAnnuler}>
      <dialog open className="mod-fenetre mod-dup" aria-modal="true" aria-labelledby="mod-rg-titre">
        <div className="mod-dup-corps">
          <h2 id="mod-rg-titre">Rétablir le modèle générique ?</h2>
          <p>Le contenu du modèle de la formation « {formation.intitule} » ({modele.nom.toLowerCase()}) sera remplacé par le modèle générique actuel. Le modèle reste dans le dossier de la formation. Les documents déjà générés ne sont pas modifiés.</p>
          {erreur && <p className="mod-erreur" role="alert">{erreur}</p>}
        </div>
        <footer className="mod-fenetre-pied">
          <button type="button" className="btn btn-line btn-sm" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={retablir} disabled={envoi}>Rétablir le modèle générique</button>
        </footer>
      </dialog>
    </Modal>
  )
}

// SCRUM-219 (maquettes SCRUM-219-2/4) : dossier d'une formation : ses modèles de la formation (RG18 : statut
// « Modèle de la formation » ; RG18 bis : « Identique au modèle générique » ou « Différent du modèle générique », et
// lien « Rétablir le modèle générique » seulement si différent — écart voulu avec les maquettes), puis
// « Modèle générique appliqué : … ».
// Aucun bouton « Dupliquer » ici (RG14). RG7 : un clic sur un modèle l'ouvre directement dans l'éditeur.
export function DossierFormation() {
  const { formation: id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const charger = useCallback(() => dossierFormation(id), [id])
  const { donnee, erreur } = useChargement(charger)
  const [aRetablir, setARetablir] = useState(null)
  // Modèles rétablis depuis l'ouverture du dossier (par type) : la carte reste, avec le contenu du modèle générique
  const [retablis, setRetablis] = useState({})
  if (!donnee) return <PageEnChargement erreur={erreur} texte="Chargement du dossier…" />
  const { formation, generiques_appliques: appliques } = donnee
  const modeles = donnee.modeles.map((m) => retablis[m.type] || m)
  return (
    <div className="wrap modeles">
      <div className="page-head"><h1>Modèles</h1></div>
      <FilAriane retour={PAR_FORMATION.lien} etapes={[MODELES, PAR_FORMATION, { libelle: formation.intitule }]} />
      {modeles.length === 0
        ? (
          <section className="mod-vide" aria-labelledby="mod-vide-titre">
            <Icone nom="dossier" taille={22} />
            <h2 id="mod-vide-titre">Aucun modèle de la formation</h2>
            <p>Les modèles génériques sont appliqués. Pour créer un modèle propre à cette formation, cliquez sur « Dupliquer » dans Modèles génériques.</p>
            <button type="button" className="btn btn-line btn-sm" onClick={() => navigate(GENERIQUES.lien)}>Aller aux modèles génériques</button>
          </section>
        )
        : (
          <>
            <div className="mod-grille">
              {modeles.map((m) => (
                <CarteDocument key={m.type} modele={m} lien={`/modeles/formations/${formation.id}/${m.type.toLowerCase()}`}>
                  <span className={`mod-mention ${m.identique_generique ? 'mod-mention-identique' : 'mod-mention-different'}`}>
                    {m.identique_generique ? 'Identique au modèle générique' : 'Différent du modèle générique'}
                  </span>
                  {!m.identique_generique && (
                    <div className="mod-modele-actions">
                      <button type="button" className="mod-retablir" onClick={() => setARetablir(m)}>Rétablir le modèle générique</button>
                    </div>
                  )}
                </CarteDocument>
              ))}
            </div>
            {appliques.length > 0
              && <p className="mod-appliques">Modèle générique appliqué : {appliques.map((d) => d.nom).join(', ')}.</p>}
          </>
        )}
      {aRetablir && (
        <ConfirmerRetablirGenerique formation={formation} modele={aRetablir} onAnnuler={() => setARetablir(null)}
          onRetabli={(retabli) => {
            setRetablis((r) => ({ ...r, [retabli.type]: retabli }))
            setARetablir(null)
            toast(messageGeneriqueRetabli(formation.intitule))
          }} />
      )}
    </div>
  )
}

// SCRUM-219 : un modèle de la formation dans l'éditeur (RG7), avec les variables du panneau
export function ModeleFormationOuvert() {
  const { formation: id, type } = useParams()
  const charger = useCallback(() => Promise.all([obtenirModeleFormation(id, type), listerVariables()]), [id, type])
  const { donnee, erreur } = useChargement(charger)
  if (!donnee) return <PageEnChargement erreur={erreur} texte="Chargement du modèle…" />
  const [modele, catalogue] = donnee
  return <EditeurModeleGenerique key={`${modele.type}-${modele.formation.id}`} modele={modele} catalogue={catalogue} formation={modele.formation} />
}
