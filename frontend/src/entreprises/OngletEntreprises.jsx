import { useEffect, useRef, useState } from 'react'
import { classeBulle, VIDE } from '../apprenants/apprenants'
import ErreurChargement from '../components/ErreurChargement'
import { listerEntreprises } from '../sessions/serviceApi'
import { A_CONFIRMER, initialesEntreprise, siretFr, texteSalaries } from './entreprises'
import '../apprenants/apprenants.css'
import './entreprises.css'

const DELAI_RECHERCHE = 250 // ms : la liste se met à jour quand on arrête de taper

// Onglet Entreprises clientes (SCRUM-120) : carte « Entreprises clientes · N » (N : toutes les entreprises du centre),
// « + Nouvelle entreprise cliente » (inactif jusqu'à la création d'une entreprise, SCRUM-113), recherche par raison
// sociale, SIRET ou ville, puis une ligne par entreprise sous une ligne d'en-tête.
export default function OngletEntreprises() {
  const [entreprises, setEntreprises] = useState(null)
  const [total, setTotal] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const derniere = useRef(0) // ignore les réponses d'une recherche déjà remplacée

  useEffect(() => {
    const charger = () => {
      const numero = ++derniere.current
      listerEntreprises(recherche)
        .then((liste) => {
          if (numero !== derniere.current) return
          setEntreprises(liste)
          setErreur(null)
          if (!recherche.trim()) setTotal(liste.length)
        })
        .catch((e) => { if (numero === derniere.current) setErreur(e) })
    }
    const minuteur = setTimeout(charger, recherche ? DELAI_RECHERCHE : 0)
    return () => clearTimeout(minuteur)
  }, [recherche])

  return (
    <section className="app-carte" aria-labelledby="ent-liste-titre">
      <div className="app-carte-tete">
        <h2 id="ent-liste-titre">Entreprises clientes{total !== null && <span className="app-nombre"> · {total}</span>}</h2>
        <button type="button" className="app-btn app-btn-principal" disabled title="Bientôt disponible">+ Nouvelle entreprise cliente</button>
      </div>
      <input type="search" className="app-inp app-recherche" aria-label="Rechercher une entreprise cliente"
             placeholder="Rechercher par raison sociale, SIRET ou ville" value={recherche} onChange={(e) => setRecherche(e.target.value)} />

      {entreprises === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des entreprises clientes…</p>)}
      {entreprises?.length === 0 && (
        <div className="app-vide">
          {recherche.trim()
            ? <h3>Aucun résultat pour cette recherche</h3>
            : (
              <>
                <h3>Aucune entreprise cliente pour le moment</h3>
                <p>Ajoutez votre première entreprise avec « + Nouvelle entreprise cliente ».</p>
              </>
            )}
        </div>
      )}
      {entreprises?.length > 0 && (
        <div>
          <div className="ent-ligne ent-entete" aria-hidden="true">
            <span /><span>Entreprise</span><span>Ville</span><span>OPCO</span><span>Interlocuteur</span><span className="ent-salaries">Salariés</span>
          </div>
          <ul className="app-liste" aria-label="Entreprises clientes">
            {entreprises.map((e) => (
              <li key={e.id} className="app-ligne ent-ligne">
                <span className={classeBulle(e.id)} aria-hidden="true">{initialesEntreprise(e.raison_sociale)}</span>
                <span className="app-col-nom"><b>{e.raison_sociale}</b><small>{siretFr(e.siret)}</small></span>
                <span className="app-col">{e.ville || VIDE}</span>
                <span className="app-col">
                  {e.opco
                    ? <span className="app-pastille app-pastille-verte">{e.opco}</span>
                    : <span className="app-pastille ent-pastille-orange">{A_CONFIRMER}</span>}
                </span>
                <span className="app-col">{e.interlocuteur || VIDE}</span>
                <span className="app-col app-sessions ent-salaries">{texteSalaries(e.nombre_salaries)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
