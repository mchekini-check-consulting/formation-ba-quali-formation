import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { formationsPourDuplication } from './serviceApi'

// SCRUM-218 (maquette SCRUM-218-1, prototype dupModal) : fenêtre « Dupliquer « <Document> » » ouverte depuis la carte
// d'un modèle générique (RG14). Seules les formations sans modèle pour ce document sont proposées (RG16), hors
// archivées. « Créer le modèle de la formation » ouvre l'éditeur sans rien créer (RG8 : création à « Enregistrer »).
export function FenetreDupliquer({ modele, onFermer }) {
  const navigate = useNavigate()
  const [formations, setFormations] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [choisie, setChoisie] = useState('')

  useEffect(() => {
    let actif = true
    formationsPourDuplication(modele.type).then((f) => {
      if (!actif) return
      setFormations(f)
      setChoisie(f.disponibles.length ? String(f.disponibles[0].id) : '')
    }).catch((e) => { if (actif) setErreur(e.message) })
    return () => { actif = false }
  }, [modele.type])

  function creer() {
    navigate(`/modeles/formations/${choisie}/${modele.type.toLowerCase()}/nouveau`)
  }

  let corps
  if (erreur) corps = <p className="mod-erreur" role="alert">{erreur}</p>
  else if (!formations) corps = <p className="chargement">Chargement des formations…</p>
  else if (formations.disponibles.length === 0) {
    corps = (
      <p className="mod-dup-aucune">
        {formations.deja_crees.length
          ? 'Toutes les formations ont déjà leur modèle pour ce document. Pour le modifier, ouvrez-le dans le dossier de la formation.'
          : 'Aucune formation : créez d’abord une formation pour lui faire un modèle.'}
      </p>
    )
  } else {
    corps = (
      <>
        <div className="field">
          <label htmlFor="mod-dup-formation">Formation</label>
          <select id="mod-dup-formation" value={choisie} onChange={(e) => setChoisie(e.target.value)}>
            {formations.disponibles.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
          </select>
        </div>
        {formations.deja_crees.length > 0 && (
          <p className="mod-dup-note">
            Modèle de la formation déjà créé pour : {formations.deja_crees.map((f) => f.intitule).join(', ')}. Une formation ne peut avoir qu’un seul modèle pour ce document : pour le modifier, ouvrez-le dans le dossier de la formation.
          </p>
        )}
      </>
    )
  }

  return (
    <Modal onFermer={onFermer}>
      <dialog open className="mod-fenetre mod-dup" aria-modal="true" aria-labelledby="mod-dup-titre">
        <div className="mod-dup-corps">
          <h2 id="mod-dup-titre">Dupliquer « {modele.nom} »</h2>
          <p>Créer un modèle propre à une formation, à partir de ce modèle générique. Le modèle générique ne change pas.</p>
          {corps}
        </div>
        <footer className="mod-fenetre-pied">
          <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Annuler</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={creer} disabled={!choisie}>Créer le modèle de la formation</button>
        </footer>
      </dialog>
    </Modal>
  )
}
