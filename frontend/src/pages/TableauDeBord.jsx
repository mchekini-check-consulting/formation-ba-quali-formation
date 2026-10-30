import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import { FONCTIONNALITES } from './fonctionnalites'

const KPIS = [
  { label: 'Conformité Qualiopi', valeur: '87 %', miseEnAvant: true },
  { label: 'Sessions en cours', valeur: '12' },
  { label: 'Apprenants inscrits', valeur: '186' },
  { label: 'Satisfaction moyenne', valeur: '4,6/5' },
]

const SESSIONS = [
  { titre: "Management d'équipe", detail: '27 – 29 oct. · 10/12 inscrits', statut: 'Confirmée', couleur: 'vert' },
  { titre: 'Excel avancé', detail: '3 – 4 nov. · 6/12 inscrits', statut: 'À compléter', couleur: 'orange' },
  { titre: 'Gestion de projet agile', detail: '12 – 15 nov. · 8/8 inscrits', statut: 'Complète', couleur: 'vert' },
]

const TACHES = [
  { titre: 'Relancer 3 conventions non signées', module: 'Signature électronique' },
  { titre: 'Envoyer les convocations Excel avancé', module: 'Modèles de documents' },
  { titre: 'Ajouter une preuve — indicateur 23', module: 'Suivi Qualiopi' },
]

function TableauDeBord() {
  return (
    <>
      <div className="entete">
        <div>
          <h1>Bonjour Nassiba</h1>
          <p>Voici l'essentiel de votre centre aujourd'hui.</p>
        </div>
        <button className="btn btn-primary"><Icone nom="plus" taille={16} epaisseur={2.5} />Nouvelle session</button>
      </div>

      {/* 4 indicateurs clés */}
      <section className="kpis">
        {KPIS.map((k) => (
          <div className={`kpi${k.miseEnAvant ? ' mise-en-avant' : ''}`} key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-valeur">{k.valeur}</div>
          </div>
        ))}
      </section>

      {/* Accès rapide aux 9 fonctionnalités */}
      <h2 className="section-titre">Vos fonctionnalités</h2>
      <section className="modules">
        {FONCTIONNALITES.map((f) => {
          const contenu = <>
            <span className="module-icone"><Icone nom={f.iconeModule ?? f.icone} taille={20} /></span>
            <div><h3>{f.titre}</h3><small>{f.detail}</small></div>
            <span className="fleche">→</span>
          </>
          return f.lien
            ? <Link to={f.lien} className="module" key={f.titre}>{contenu}</Link>
            : <a href="#" className="module" key={f.titre}>{contenu}</a>
        })}
      </section>

      {/* Prochaines sessions + À faire */}
      <section className="grille">
        <div className="carte">
          <div className="carte-titre"><h2>Prochaines sessions</h2><a href="#" className="lien">Voir le planning →</a></div>
          {SESSIONS.map((s) => (
            <div className="ligne" key={s.titre}>
              <div><b>{s.titre}</b><small>{s.detail}</small></div>
              <span className={`tag tag-${s.couleur}`}>{s.statut}</span>
            </div>
          ))}
        </div>

        <div className="carte">
          <div className="carte-titre"><h2>À faire</h2><span className="tag tag-orange">{TACHES.length}</span></div>
          {TACHES.map((t) => (
            <div className="ligne tache" key={t.titre}>
              <span className="puce"></span>
              <div><b>{t.titre}</b><small>{t.module}</small></div>
            </div>
          ))}
        </div>
      </section>

      <p className="demo">Maquette — données fictives.</p>
    </>
  )
}

export default TableauDeBord
