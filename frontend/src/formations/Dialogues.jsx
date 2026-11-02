import { useState } from 'react'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'

// RG26 : pop-up « Programme requis pour publier »
export function ProgrammeRequisDialog({ formation, onCreer, onAnnuler }) {
  return (
    <Modal onFermer={onAnnuler}>
      <dialog open className="dialog dlg-warn" aria-modal="true" aria-labelledby="pr">
        <div className="dw-head"><span className="dw-ic"><Icone nom="programme" taille={24} /></span><div><h2 id="pr">Programme requis pour publier</h2><p>« {formation.title} »</p></div></div>
        <div className="dw-alert" role="alert"><Icone nom="info" taille={20} /><span>Une formation ne peut pas être publiée sans son programme. Créez le programme, puis publiez la formation.</span></div>
        <div className="foot">
          <button type="button" className="btn btn-line" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={onCreer} autoFocus><Icone nom="plus" taille={16} epaisseur={2.4} />Créer le programme</button>
        </div>
      </dialog>
    </Modal>
  )
}

// RG38 : ajout d'une session (début et fin obligatoires, fin ≥ début)
export function SessionDialog({ formation, onAjouter, onAnnuler }) {
  const [s, setS] = useState({ debut: '', fin: '', lieu: formation.values?.lieu || '', places: '' })
  const [erreur, setErreur] = useState(false)
  const champ = (k) => ({ value: s[k], onChange: (e) => setS({ ...s, [k]: e.target.value }) })
  const ajouter = () => {
    if (!s.debut || !s.fin || s.fin < s.debut) { setErreur(true); return }
    onAjouter(s)
  }
  return (
    <Modal onFermer={onAnnuler}>
      <dialog open className="dialog sess-dlg" aria-modal="true" aria-labelledby="sd">
        <h2 id="sd">Ajouter une session</h2><p style={{ marginTop: -8 }}>{formation.title}</p>
        <div className="sess-form">
          <label>Date de début<input className="inp" type="date" {...champ('debut')} /></label>
          <label>Date de fin<input className="inp" type="date" {...champ('fin')} /></label>
          <label>Lieu<input className="inp" placeholder="Ex. : Lyon ou Teams" {...champ('lieu')} /></label>
          <label>Places<input className="inp" inputMode="numeric" placeholder="Ex. : 12" {...champ('places')} /></label>
          <span className="errtxt full" role="alert" hidden={!erreur}>Indiquez une date de début et une date de fin (la fin après le début).</span>
        </div>
        <div className="foot">
          <button type="button" className="btn btn-line" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={ajouter}><Icone nom="plus" taille={16} epaisseur={2.4} />Ajouter la session</button>
        </div>
      </dialog>
    </Modal>
  )
}
