import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/toastContext'
import { life } from '../formations/catalogue'
import CarteFormation from '../formations/CarteFormation'
import { SuppressionDialog } from '../formations/Dialogues'
import * as service from '../formations/donnees'

// Couleur de la pastille de chaque filtre
const PC = { all: '#0F766E', brouillon: '#64748B', incomplete: '#E11D48', apublier: '#10B981', archivee: '#A1A1AA' }
// RG30 : filtres de la liste (SCRUM-21 : sans « Publiées » ; SCRUM-23 : « Archivées »)
const FILTRES = [['all', 'Toutes'], ['brouillon', 'Brouillons'], ['incomplete', 'Incomplètes'], ['apublier', 'Validées'], ['archivee', 'Archivées']]

// SCRUM-23 : « Toutes » n'affiche pas les formations archivées
const dansFiltre = (f, filtre) => (filtre === 'all' ? life(f) !== 'archivee' : life(f) === filtre)

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

  const onAction = (nom, f) => {
    setMenu(null)
    switch (nom) {
      case 'voir': return navigate(`/formations/${f.id}`)
      // Depuis la carte, les blocs manquants sont signalés (sauf pour une formation validée)
      case 'saisir': return ouvrirFormulaire(f, f.statut !== 'validee' ? { signaler: 1 } : {})
      case 'modifier': return ouvrirFormulaire(f)
      case 'creerProgramme': return ouvrirFormulaire(f, { bloc: 'programme', signaler: 1 })
      // SCRUM-23
      case 'archiver': return setDialogue({ type: 'archiver', formation: f })
      case 'restaurer': return executer(service.restaurer(f.id), `« ${f.title} » est restaurée en brouillon.`)
      // Une formation qui a des sessions doit d'abord être archivée
      case 'supprimer': return setDialogue({ type: (f.sess || []).length > 0 && f.statut !== 'archivee' ? 'suppressionImpossible' : 'supprimer', formation: f })
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
    {dialogue.type === 'archiver' && <ConfirmDialog titre={`Archiver « ${f.title} » ?`} texte="Elle n'apparaîtra plus dans « Toutes ». Vous la retrouverez dans le filtre « Archivées » et pourrez la restaurer à tout moment."
      action="Archiver" icone="box" fondIcone="var(--brand-soft)" couleurIcone="var(--brand-text)" onAnnuler={fermerDialogue} onOk={() => executer(service.archiver(f.id), `« ${f.title} » est archivée.`)} />}
    {dialogue.type === 'suppressionImpossible' && <ConfirmDialog titre="Suppression impossible" texte={`Cette formation a ${f.sess.length} session${f.sess.length > 1 ? 's' : ''} : elle doit d'abord être archivée. Archivée, elle n'est plus proposée mais son historique est conservé.`}
      action="Archiver la formation" icone="trash" fondIcone="var(--warn-soft)" couleurIcone="var(--warn)" onAnnuler={fermerDialogue} onOk={() => executer(service.archiver(f.id), `« ${f.title} » est archivée.`)} />}
    {dialogue.type === 'supprimer' && <SuppressionDialog formation={f} onAnnuler={fermerDialogue} onSupprimer={() => executer(service.supprimer(f.id), `« ${f.title} » a été supprimée.`)} />}
    {dialogue.type === 'vider' &&<ConfirmDialog titre="Vider la démo ?" texte="Toutes les formations de la démo sont supprimées. Vous revenez à l'écran de départ, sans aucune formation."
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

  const compteurs = Object.fromEntries(FILTRES.map(([k]) => [k, formations.filter((x) => dansFiltre(x, k)).length]))
  const q = recherche.trim().toLowerCase()
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
