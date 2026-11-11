import { CLASSE_VIRTUELLE, PRESENTIEL } from './regles'
import { initiales } from './serviceApi'

// Morceaux communs aux formulaires « Nouvelle session » (SCRUM-25) et « Modifier la session » (SCRUM-36).

export function Champ({ id, label, erreur, aide, children }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label} <span className="req" aria-hidden="true">*</span></label>
      {children}
      {aide && !erreur && <span className="ns-aide">{aide}</span>}
      {erreur && <span className="errtxt" id={`${id}-err`}>{erreur}</span>}
    </div>
  )
}

// Liste à cocher des formateurs ou des apprenants
export function ListePersonnes({ titre, personnes, choisis, onBasculer, detail, enErreur = false }) {
  return (
    <ul className={`ns-personnes${enErreur ? ' err' : ''}`} aria-label={titre}>
      {personnes.map((p) => (
        <li key={p.id} className={choisis.includes(p.id) ? 'on' : ''}>
          <label>
            <input type="checkbox" checked={choisis.includes(p.id)} onChange={() => onBasculer(p.id)} />
            <span className="ns-avatar" aria-hidden="true">{initiales(p)}</span>
            <span className="ns-nom"><b>{p.prenom} {p.nom}</b><span>{detail(p)}</span></span>
          </label>
        </li>
      ))}
      {personnes.length === 0 && <li className="ns-vide">Aucune personne enregistrée pour le moment.</li>}
    </ul>
  )
}

// Champs d'informations de la session : formation, dates, heures, durée, places, modalité, lieu ou lien
export function BlocInformations({ s, erreurs, saisie, formations, changer, alerte }) {
  const presentiel = s.modalite === PRESENTIEL
  return (
    <>
      <h2>Informations de la session</h2>
      <p className="sub">Les champs marqués <span className="req">*</span> sont obligatoires.</p>
      {alerte && <p className="pa-alerte" role="alert">{alerte}</p>}
      <div className="ns-grille">
        <div className="ns-plein">
          <Champ id="ns-formation" label="Formation" erreur={erreurs.formation}>
            <select {...saisie('formation')}>
              <option value="">Choisir une formation</option>
              {formations.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
            </select>
          </Champ>
        </div>
        <Champ id="ns-debut" label="Date de début" erreur={erreurs.debut}><input type="date" {...saisie('debut')} /></Champ>
        <Champ id="ns-fin" label="Date de fin" erreur={erreurs.fin}><input type="date" {...saisie('fin')} /></Champ>
        <Champ id="ns-heureDebut" label="Heure de début" erreur={erreurs.heureDebut}><input type="time" {...saisie('heureDebut')} /></Champ>
        <Champ id="ns-heureFin" label="Heure de fin" erreur={erreurs.heureFin}><input type="time" {...saisie('heureFin')} /></Champ>
        <Champ id="ns-duree" label="Durée (heures)" erreur={erreurs.duree} aide="Reprise automatiquement de la formation choisie, modifiable."><input inputMode="decimal" {...saisie('duree')} /></Champ>
        <Champ id="ns-places" label="Nombre de places" erreur={erreurs.places}><input inputMode="numeric" {...saisie('places')} /></Champ>
      </div>
      <fieldset className="ns-modalite">
        <legend className="lbl">Modalité <span className="req" aria-hidden="true">*</span></legend>
        <div className="radios">
          <label className="radio"><input type="radio" name="modalite" checked={presentiel} onChange={() => changer('modalite', PRESENTIEL)} />Présentiel</label>
          <label className="radio"><input type="radio" name="modalite" checked={!presentiel} onChange={() => changer('modalite', CLASSE_VIRTUELLE)} />Classe virtuelle</label>
        </div>
      </fieldset>
      {presentiel
        ? <Champ id="ns-lieu" label="Lieu" erreur={erreurs.lieu}><input placeholder="Adresse ou salle" {...saisie('lieu')} /></Champ>
        : <Champ id="ns-lien" label="Lien de la classe virtuelle" erreur={erreurs.lien}><input type="url" placeholder="https://…" {...saisie('lien')} /></Champ>}
    </>
  )
}
