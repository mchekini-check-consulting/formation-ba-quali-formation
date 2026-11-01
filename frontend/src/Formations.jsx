import { useEffect, useState } from 'react'
import { creerFormation, listerFormations, modifierFormation, supprimerFormation } from './api'

const VIDE = { nom: '', description: '', dureeHeures: '', dateDebut: '' }

function versChamps(formation) {
  return {
    nom: formation.nom,
    description: formation.description ?? '',
    dureeHeures: formation.dureeHeures ?? '',
    dateDebut: formation.dateDebut ?? '',
  }
}

function versEnvoi(valeurs) {
  return {
    nom: valeurs.nom,
    description: valeurs.description,
    dureeHeures: valeurs.dureeHeures === '' ? null : Number(valeurs.dureeHeures),
    dateDebut: valeurs.dateDebut === '' ? null : valeurs.dateDebut,
  }
}

// Liste des formations du backend (GET), avec ajout, modification et suppression
function Formations() {
  const [formations, setFormations] = useState([])
  const [valeurs, setValeurs] = useState(VIDE)
  const [enEdition, setEnEdition] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    listerFormations()
      .then(setFormations)
      .catch((e) => setErreur(`Chargement impossible (${e.message})`))
  }, [])

  async function valider(event) {
    event.preventDefault()
    setErreur('')
    try {
      if (enEdition) {
        const formation = await modifierFormation(enEdition, versEnvoi(valeurs))
        setFormations((liste) => liste.map((f) => (f.id === enEdition ? formation : f)))
      } else {
        const formation = await creerFormation(versEnvoi(valeurs))
        setFormations((liste) => [...liste, formation])
      }
      setValeurs(VIDE)
      setEnEdition(null)
    } catch (e) {
      setErreur(`${enEdition ? 'Modification' : 'Ajout'} impossible (${e.message})`)
    }
  }

  function modifier(formation) {
    setEnEdition(formation.id)
    setValeurs(versChamps(formation))
  }

  function annuler() {
    setEnEdition(null)
    setValeurs(VIDE)
  }

  async function supprimer(id) {
    setErreur('')
    try {
      await supprimerFormation(id)
      setFormations((liste) => liste.filter((f) => f.id !== id))
      if (enEdition === id) annuler()
    } catch (e) {
      setErreur(`Suppression impossible (${e.message})`)
    }
  }

  return (
    <section className="formations">
      <h1>Formations</h1>

      <form onSubmit={valider}>
        <label>
          Nom
          <input
            name="nom"
            value={valeurs.nom}
            onChange={(e) => setValeurs({ ...valeurs, nom: e.target.value })}
            required
            maxLength={200}
          />
        </label>
        <label>
          Description
          <input
            name="description"
            value={valeurs.description}
            onChange={(e) => setValeurs({ ...valeurs, description: e.target.value })}
            maxLength={1000}
          />
        </label>
        <label>
          Durée (heures)
          <input
            name="dureeHeures"
            type="number"
            min="0"
            value={valeurs.dureeHeures}
            onChange={(e) => setValeurs({ ...valeurs, dureeHeures: e.target.value })}
          />
        </label>
        <label>
          Date de début
          <input
            name="dateDebut"
            type="date"
            value={valeurs.dateDebut}
            onChange={(e) => setValeurs({ ...valeurs, dateDebut: e.target.value })}
          />
        </label>
        <button type="submit">{enEdition ? 'Enregistrer' : 'Ajouter'}</button>
        {enEdition && (
          <button type="button" onClick={annuler}>
            Annuler
          </button>
        )}
      </form>

      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}

      <ul>
        {formations.length === 0 && <li className="vide">Aucune formation</li>}
        {formations.map((formation) => (
          <li key={formation.id}>
            <strong>{formation.nom}</strong>
            {formation.description && <span> : {formation.description}</span>}
            {formation.dureeHeures != null && <span> ({formation.dureeHeures} h)</span>}
            {formation.dateDebut && <span> dès le {formation.dateDebut}</span>}
            <button type="button" onClick={() => modifier(formation)}>
              Modifier
            </button>
            <button type="button" onClick={() => supprimer(formation.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Formations
