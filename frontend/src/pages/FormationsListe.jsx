import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/toastContext'
import { isPub, life } from '../formations/catalogue'
import CarteFormation from '../formations/CarteFormation'
import { ProgrammeRequisDialog, SessionDialog } from '../formations/Dialogues'
import * as service from '../formations/donnees'

// Couleur de la pastille de chaque filtre
const PC = { all: '#0F766E', brouillon: '#64748B', incomplete: '#E11D48', apublier: '#10B981', publiee: '#6366F1' }
// RG30 : filtres de la liste
const FILTRES = [['all', 'Toutes'], ['brouillon', 'Brouillons'], ['incomplete', 'Incomplètes'], ['apublier', 'Validées'], ['publiee', 'Publiées']]

// « Publiées » regroupe les validées et incomplètes publiées
const dansFiltre = (f, filtre) => filtre === 'all' || (filtre === 'publiee' ? isPub(f) : life(f) === filtre)

function FormationsListe() {
  const navigate = useNavigate()
  const toast = useToast()
  const [formations, setFormations] = useState(null)
  const [filtre, setFiltre] = useState('all')
  const [recherche, setRecherche] = useState('')
  const [menu, setMenu] = useState(null)        // id de la carte dont le menu « ··· » est ouvert
  const [dialogue, setDialogue] = useState(null) // { type, formation }

  const [erreur, setErreur] = useState(null)
  const recharger = useCallback(() => service.listerFormations().then((l) => { setFormations(l); setErreur(null) }).catch((e) => setErreur(e.message)), [])
  useEffect(() => { void recharger() }, [recharger])

  // Un clic en dehors du menu ouvert le referme
  useEffect(() => {
    if (menu === null) return
    const fermer = (e) => { if (!e.target.closest('[data-menu], .menu-pop')) setMenu(null) }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [menu])

  const fermerDialogue = () => setDialogue(null)
  const ouvrirFormulaire = (f, params = {}) => {
    const q = new URLSearchParams(params).toString()
    const suite = q ? '?' + q : ''
    void navigate(`/formations/${f.id}/modifier${suite}`)
  }

  // Exécute une action du service, recharge la liste et affiche le message
  const executer = async (promesse, message) => {
    try {
      await promesse
      setDialogue(null)
      await recharger()
      if (message) toast(message)
    } catch (e) {
      toast(e.message)
    }
  }

  const publier = async (f, confirmer = false) => {
    try {
      await service.publier(f.id, { confirmer })
      setDialogue(null)
      await recharger()
      toast(f.statut === 'incomplete' ? `« ${f.title} » est publiée. Pensez à compléter ses informations Qualiopi.` : `« ${f.title} » est publiée.`)
    } catch (e) {
      if (e.code === 'PROGRAMME_REQUIS') setDialogue({ type: 'programmeRequis', formation: f })     // RG26
      else if (e.code === 'CONFIRMATION_REQUISE') setDialogue({ type: 'publierIncomplete', formation: f }) // RG27
      else toast(e.message)
    }
  }

  const onAction = (nom, f) => {
    setMenu(null)
    switch (nom) {
      case 'voir': return navigate(`/formations/${f.id}`)
      // Depuis la carte, les blocs manquants sont signalés (sauf pour une formation validée)
      case 'saisir': return ouvrirFormulaire(f, f.statut !== 'validee' ? { signaler: 1 } : {})
      case 'creerProgramme': return ouvrirFormulaire(f, { bloc: 'programme', signaler: 1 })
      case 'publier': return publier(f)
      case 'retirer': return executer(service.retirerPublication(f.id), `« ${f.title} » repasse en « À publier » : elle n’est plus visible dans le catalogue.`)
      case 'nouvelleSession': return setDialogue({ type: 'session', formation: f })
      default: return undefined
    }
  }

  if (formations === null) {
    return <div className="wrap"><p className="chargement" role={erreur ? 'alert' : undefined}>{erreur || 'Chargement des formations…'}</p></div>
  }

  const entete = (
    <div className="page-head">
      <div><h1>Formations</h1><p className="sub">{formations.length ? 'Retrouvez toutes vos formations et ce qu’il reste à faire pour chacune.' : 'Votre catalogue de formations.'}</p></div>
      {formations.length > 0 && <button type="button" className="btn btn-primary" onClick={() => navigate('/formations/nouvelle')}><Icone nom="plus" taille={18} epaisseur={2.4} />Créer une formation</button>}
    </div>
  )
  const lienDemo = service.modeDemo && (
    <p className="demo-note">Démo : <button type="button" className="reset" onClick={() => executer(service.chargerExemples(), 'Formations d’exemple chargées.')}>charger des exemples</button>
      {' · '}<button type="button" className="reset" onClick={() => setDialogue({ type: 'vider' })}>vider</button></p>
  )

  const f = dialogue?.formation
  const dialogues = dialogue && <>
    {dialogue.type === 'programmeRequis' && <ProgrammeRequisDialog formation={f} onAnnuler={fermerDialogue} onCreer={() => ouvrirFormulaire(f, { bloc: 'programme', signaler: 1 })} />}
    {dialogue.type === 'publierIncomplete' && <ConfirmDialog titre="Publier une formation incomplète ?" texte={`« ${f.title} » ne contient pas toutes les informations demandées lors de l’audit Qualiopi. Vous pouvez la publier maintenant et la compléter plus tard.`}
      action="Publier quand même" icone="alert" fondIcone="#FFEDD5" couleurIcone="#EA580C" onAnnuler={fermerDialogue} onOk={() => publier(f, true)} />}
    {dialogue.type === 'session' && <SessionDialog formation={f} onAnnuler={fermerDialogue} onAjouter={(s) => executer(service.ajouterSession(f.id, s), 'Session ajoutée à la formation.')} />}
    {dialogue.type === 'vider' && <ConfirmDialog titre="Vider la démo ?" texte="Toutes les formations de la démo sont supprimées. Vous revenez à l'écran de départ, sans aucune formation."
      action="Vider la démo" icone="restore" fondIcone="var(--brand-soft)" couleurIcone="var(--brand-text)" onAnnuler={fermerDialogue}
      onOk={() => { setFiltre('all'); setRecherche(''); void executer(service.viderDemo(), 'La démo est vide : vous pouvez créer votre première formation.') }} />}
  </>

  // Aucune formation : écran d'accueil
  if (formations.length === 0) {
    return (
      <div className="wrap">
        {entete}
        <div className="card empty-hero">
          <span className="eh-k">Aucune formation créée pour le moment</span>
          <h2>Créez votre première formation</h2>
          <p className="sub">Construisez votre catalogue et rassemblez, pour chaque formation, toutes les informations attendues lors de l’audit Qualiopi.</p>
          <ul className="eh-feats">
            <li><span className="ef-ic"><Icone nom="doc" taille={20} /></span><b>Une fiche complète</b></li>
            <li><span className="ef-ic"><Icone nom="programme" taille={20} /></span><b>Un programme structuré</b></li>
            <li><span className="ef-ic"><Icone nom="check" taille={20} epaisseur={2.4} /></span><b>Un suivi clair</b></li>
          </ul>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/formations/nouvelle')}><Icone nom="plus" taille={18} epaisseur={2.4} />Créer une formation</button>
        </div>
        {lienDemo}
        {dialogues}
      </div>
    )
  }

  const q = recherche.trim().toLowerCase()
  const compteurs = Object.fromEntries(FILTRES.map(([k]) => [k, formations.filter((x) => dansFiltre(x, k)).length]))
  const affichees = formations.filter((x) => dansFiltre(x, filtre)).filter((x) => !q || x.title.toLowerCase().includes(q))

  return (
    <div className="wrap">
      {entete}
      <div className="fbar2">
        <div className="fpills" role="toolbar" aria-label="Filtrer par statut">
          {FILTRES.map(([k, lab]) => (
            <button type="button" key={k} className={`fpill ${filtre === k ? 'on' : ''}`} aria-pressed={filtre === k} style={{ '--pc': PC[k] }} onClick={() => setFiltre(k)}>
              {k !== 'all' && <span className="fp-dot"></span>}{lab}<span className="fp-n">{compteurs[k]}</span>
            </button>
          ))}
        </div>
        <label className="search"><Icone nom="search" taille={18} /><input type="search" placeholder="Rechercher une formation…" aria-label="Rechercher une formation" value={recherche} onChange={(e) => setRecherche(e.target.value)} /></label>
      </div>
      {affichees.length ? (
        <div className="fgrid">
          {affichees.map((x) => (
            <CarteFormation key={x.id} f={x} menuOuvert={menu === x.id} onMenu={(id) => setMenu(menu === id ? null : id)} onAction={onAction} />
          ))}
        </div>
      ) : (
        <div className="card empty"><p className="sub">{q ? 'Aucune formation ne correspond à cette recherche.' : 'Aucune formation dans cette catégorie.'}</p></div>
      )}
      {lienDemo}
      {dialogues}
    </div>
  )
}

export default FormationsListe
