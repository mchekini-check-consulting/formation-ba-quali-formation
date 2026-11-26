import { useEffect, useRef, useState } from 'react'
import { classeBulle, VIDE } from '../apprenants/apprenants'
import ErreurChargement from '../components/ErreurChargement'
import { listerEntreprises } from '../sessions/serviceApi'
import { A_CONFIRMER, initialesEntreprise, siretFr, texteSalaries } from './entreprises'
import PanneauEntreprise from './PanneauEntreprise'
import '../apprenants/apprenants.css'
import './entreprises.css'

const DELAI_RECHERCHE = 250 // ms : la liste se met à jour quand on arrête de taper

// Onglet Entreprises clientes (SCRUM-120) : carte « Entreprises clientes · N » (N : toutes les entreprises du centre),
// « + Nouvelle entreprise cliente » (panneau de création, SCRUM-113), recherche par raison sociale, SIRET ou ville,
// puis une ligne par entreprise sous une ligne d'en-tête. L'entreprise ajoutée apparaît en tête, mise en évidence.
export default function OngletEntreprises() {
  const [entreprises, setEntreprises] = useState(null)
  const [total, setTotal] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [panneau, setPanneau] = useState(false)
  const [nouvelle, setNouvelle] = useState(null) // identifiant de l'entreprise qui vient d'être ajoutée
  const derniere = useRef(0) // ignore les réponses d'une recherche déjà remplacée

  const charger = (texte) => {
    const numero = ++derniere.current
    return listerEntreprises(texte)
      .then((liste) => {
        if (numero !== derniere.current) return
        setEntreprises(liste)
        setErreur(null)
        if (!texte.trim()) setTotal(liste.length)
      })
      .catch((e) => { if (numero === derniere.current) setErreur(e) })
  }

  useEffect(() => {
    const minuteur = setTimeout(() => { void charger(recherche) }, recherche ? DELAI_RECHERCHE : 0)
    return () => clearTimeout(minuteur)
  }, [recherche]) // eslint-disable-line react-hooks/exhaustive-deps

  // SCRUM-113 / SCRUM-120 CA6 : l'entreprise ajoutée apparaît en tête de liste, mise en évidence (recherche vidée)
  const creee = (entreprise) => {
    setPanneau(false)
    setNouvelle(entreprise.id)
    if (recherche) setRecherche('')
    else void charger('')
  }
  const lignes = entreprises && nouvelle !== null
    ? [...entreprises.filter((e) => e.id === nouvelle), ...entreprises.filter((e) => e.id !== nouvelle)]
    : entreprises

  return (
    <section className="app-carte" aria-labelledby="ent-liste-titre">
      <div className="app-carte-tete">
        <h2 id="ent-liste-titre">Entreprises clientes{total !== null && <span className="app-nombre"> · {total}</span>}</h2>
        <button type="button" className="app-btn app-btn-principal" onClick={() => setPanneau(true)}>+ Nouvelle entreprise cliente</button>
      </div>
      <input type="search" className="app-inp app-recherche" aria-label="Rechercher une entreprise cliente"
             placeholder="Rechercher par raison sociale, SIRET ou ville" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {panneau && <PanneauEntreprise onFermer={() => setPanneau(false)} onCree={creee} />}

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
      {lignes?.length > 0 && (
        <div>
          <div className="ent-ligne ent-entete" aria-hidden="true">
            <span /><span>Entreprise</span><span>Ville</span><span>OPCO</span><span>Interlocuteur</span><span className="ent-salaries">Salariés</span>
          </div>
          <ul className="app-liste" aria-label="Entreprises clientes">
            {lignes.map((e) => (
              <li key={e.id} className={`app-ligne ent-ligne${e.id === nouvelle ? ' app-ligne-nouvelle' : ''}`}
                  aria-current={e.id === nouvelle ? 'true' : undefined}>
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
