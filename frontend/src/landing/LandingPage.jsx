import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ATOUTS, EMAIL_CONTACT, ETAPES, FONCTIONNALITES, GARANTIES, INCLUS_DANS_CHAQUE_FORMULE,
  LIENS, MENU, MOTS_TITRE, QUESTIONS, TEMOIGNAGES,
} from './contenu'
import { FORMULES, prixAffiche } from './tarifs'
import './landing.css'

// Rythme des animations de la maquette
export const DELAI_MOT_MS = 2600
export const DELAI_TEMOIGNAGE_MS = 6000

// Petites icônes SVG de la maquette
const Svg = ({ taille = 24, couleur = 'currentColor', epaisseur = 2, children }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const Coche = ({ taille = 18, couleur = '#059669', epaisseur = 2.4 }) => (
  <Svg taille={taille} couleur={couleur} epaisseur={epaisseur}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
)
const Bouclier = () => (
  <Svg taille={20} couleur="#FFFFFF" epaisseur={2.2}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Svg>
)

// Fait défiler la page jusqu'à une section (CA2)
function allerA(evenement, section) {
  evenement.preventDefault()
  document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Lien interne à la page : défilement doux jusqu'à la section
const Ancre = ({ section, className, children }) => (
  <a className={className} href={`#${section}`} onClick={(e) => allerA(e, section)}>{children}</a>
)

// Fait tourner un index de 0 à nombre - 1 toutes les « delai » millisecondes
function useRotation(nombre, delai) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const minuteur = setInterval(() => setIndex((i) => (i + 1) % nombre), delai)
    return () => clearInterval(minuteur)
  }, [nombre, delai])
  return [index, setIndex]
}

function EnTete() {
  return (
    <header className="lp-entete">
      <div className="lp-entete-contenu">
        <Ancre section="top" className="lp-logo">
          <span className="lp-logo-badge"><Bouclier /></span>
          <span className="lp-logo-nom">Quali-formation</span>
        </Ancre>
        <nav aria-label="Navigation principale" className="lp-menu">
          {MENU.map(({ libelle, section }) => <Ancre key={section} section={section} className="lp-menu-lien">{libelle}</Ancre>)}
        </nav>
        <div className="lp-entete-actions">
          <Link className="lp-btn lp-btn-contour" to={LIENS.connexion}>Se connecter</Link>
          <Link className="lp-btn lp-btn-plein" to={LIENS.inscription}>Essai gratuit</Link>
        </div>
      </div>
    </header>
  )
}

function Accroche() {
  const [mot] = useRotation(MOTS_TITRE.length, DELAI_MOT_MS)
  return (
    <section id="top" className="lp-accroche">
      <div aria-hidden="true" className="lp-bulle lp-bulle-verte lp-flotte"></div>
      <div aria-hidden="true" className="lp-bulle lp-bulle-jaune lp-flotte lp-f3"></div>
      <div className="lp-accroche-contenu">
        <span className="lp-badge-essai lp-apparait">
          <span className="lp-point lp-pulse"></span>
          15 jours d&apos;essai gratuit · sans carte bancaire
        </span>
        <h1 className="lp-apparait lp-d1">
          Simplifiez la gestion de vos<br />
          <span className="lp-mot-zone"><span key={mot} className="lp-mot lp-entree-mot">{MOTS_TITRE[mot]}</span></span><br />
          et abordez Qualiopi sereinement.
        </h1>
        <p className="lp-accroche-texte lp-apparait lp-d2">Programmes, sessions, documents, émargement, signatures et évaluations : tout est réuni dans un seul outil simple, pensé pour les organismes de formation.</p>
        <div className="lp-accroche-actions lp-apparait lp-d3">
          <Link className="lp-btn lp-btn-plein lp-btn-grand" to={LIENS.inscription}>Démarrer mon essai gratuit</Link>
          <Ancre section="tarifs" className="lp-btn lp-btn-contour lp-btn-grand lp-fond-blanc">Voir les tarifs</Ancre>
        </div>
        <div className="lp-atouts lp-apparait lp-d4">
          {ATOUTS.map((atout) => <span key={atout} className="lp-atout"><Coche />{atout}</span>)}
        </div>
      </div>
    </section>
  )
}

const TitreSection = ({ surtitre, titre, texte }) => (
  <div className="lp-titre-section">
    {surtitre && <span className="lp-surtitre">{surtitre}</span>}
    <h2>{titre}</h2>
    {texte && <p>{texte}</p>}
  </div>
)

function Fonctionnalites() {
  return (
    <section id="fonctionnalites" className="lp-section lp-fond-blanc">
      <div className="lp-conteneur">
        <TitreSection surtitre="Fonctionnalités" titre="Tout ce dont votre organisme a besoin, enfin réuni" texte="Moins d'administratif, plus de temps pour former." />
        <div className="lp-grille lp-grille-250">
          {FONCTIONNALITES.map((f) => (
            <div key={f.titre} className="lp-carte">
              <span className="lp-carte-icone" style={{ background: f.fond, color: f.couleur }}><Svg><path d={f.d} /></Svg></span>
              <h3>{f.titre}</h3>
              <p>{f.texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Etapes() {
  return (
    <section className="lp-section lp-fond-gris lp-section-etapes">
      <div className="lp-conteneur">
        <TitreSection surtitre="Simple et rapide" titre="Opérationnel en 3 étapes" />
        <div className="lp-grille lp-grille-260">
          {ETAPES.map((etape, i) => (
            <div key={etape.titre} className="lp-carte lp-carte-etape">
              <span className="lp-numero">{i + 1}</span>
              <h3>{etape.titre}</h3>
              <p>{etape.texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Temoignages() {
  const [actif, setActif] = useRotation(TEMOIGNAGES.length, DELAI_TEMOIGNAGE_MS)
  const t = TEMOIGNAGES[actif]
  const nombre = TEMOIGNAGES.length
  return (
    <div className="lp-carrousel">
      <div className="lp-carrousel-ligne">
        <button type="button" className="lp-fleche" aria-label="Témoignage précédent" onClick={() => setActif((i) => (i + nombre - 1) % nombre)}>
          <Svg taille={20} epaisseur={2.2}><path d="M15 6l-6 6 6 6" /></Svg>
        </button>
        <div className="lp-carrousel-cadre">
          <figure key={actif} className="lp-temoignage lp-glisse">
            <div className="lp-etoiles" role="img" aria-label="Note : 5 sur 5">★★★★★</div>
            <blockquote>« {t.citation} »</blockquote>
            <figcaption>
              <span className="lp-initiales" style={{ background: t.couleur }}>{t.initiales}</span>
              <span className="lp-auteur"><strong>{t.nom}</strong><span>{t.role}</span></span>
            </figcaption>
          </figure>
        </div>
        <button type="button" className="lp-fleche" aria-label="Témoignage suivant" onClick={() => setActif((i) => (i + 1) % nombre)}>
          <Svg taille={20} epaisseur={2.2}><path d="M9 6l6 6-6 6" /></Svg>
        </button>
      </div>
      <div className="lp-points">
        {TEMOIGNAGES.map((temoignage, i) => (
          <button key={temoignage.nom} type="button" className="lp-point-btn" aria-label={`Afficher le témoignage ${i + 1}`}
            aria-current={i === actif} onClick={() => setActif(i)}>
            <span className={i === actif ? 'lp-point-actif' : 'lp-point-inactif'}></span>
          </button>
        ))}
      </div>
      <span className="lp-note">Témoignages fictifs pour la maquette — à remplacer par de vrais avis clients avant la mise en ligne.</span>
    </div>
  )
}

function Avis() {
  return (
    <section id="avis" className="lp-section lp-fond-blanc">
      <div className="lp-conteneur">
        <TitreSection surtitre="Confiance" titre="Un outil sur lequel vous pouvez compter" />
        <div className="lp-grille lp-grille-240">
          {GARANTIES.map((g) => (
            <div key={g.titre} className="lp-garantie" style={{ background: g.fond }}>
              <div className="lp-garantie-titre" style={{ color: g.couleur }}>{g.titre}</div>
              <div className="lp-garantie-texte">{g.texte}</div>
            </div>
          ))}
        </div>
        <Temoignages />
      </div>
    </section>
  )
}

function Formule({ formule, annuel }) {
  const { prix, unite, detail } = prixAffiche(formule.mensuel, annuel)
  return (
    <div className={`lp-carte lp-formule${formule.recommandee ? ' lp-formule-recommandee' : ''}`} data-testid={`formule-${formule.nom}`}>
      {formule.recommandee && <span className="lp-etiquette">Recommandé</span>}
      <div className="lp-formule-entete">
        <span className="lp-formule-nom">{formule.nom}</span>
        <span className="lp-formule-tranche">{formule.tranche}</span>
      </div>
      <div className="lp-formule-prix-bloc">
        <div className="lp-formule-prix-ligne">
          <span key={prix} className="lp-formule-prix lp-entree-mot">{prix}</span>
          <span className="lp-formule-unite">{unite}</span>
        </div>
        <span className="lp-formule-detail">{detail}</span>
      </div>
      <Link className={`lp-btn lp-btn-formule${formule.recommandee ? ' lp-btn-plein' : ''}`} to={LIENS.inscription}>Essayer 15 jours gratuits</Link>
      <div className="lp-formule-inclus">
        {INCLUS_DANS_CHAQUE_FORMULE.map((inclus) => (
          <span key={inclus}><Coche taille={16} couleur="#0F766E" epaisseur={2.6} />{inclus}</span>
        ))}
      </div>
    </div>
  )
}

function Tarifs() {
  const [annuel, setAnnuel] = useState(false)
  return (
    <section id="tarifs" className="lp-section lp-fond-vert">
      <div className="lp-conteneur lp-centre">
        <TitreSection surtitre="Tarifs" titre="Une offre unique, un prix selon vos apprenants" texte="Toutes les fonctionnalités dans chaque formule. Utilisateurs illimités, sans option ni frais de mise en service." />

        <div role="group" aria-label="Période de facturation" className="lp-periode">
          <button type="button" aria-pressed={!annuel} className={annuel ? '' : 'lp-periode-active'} onClick={() => setAnnuel(false)}>Mensuel</button>
          <button type="button" aria-pressed={annuel} className={annuel ? 'lp-periode-active' : ''} onClick={() => setAnnuel(true)}>
            Annuel <span className="lp-mois-offert">1 mois offert</span>
          </button>
        </div>

        <div className="lp-grille lp-grille-250 lp-formules">
          {FORMULES.map((formule) => <Formule key={formule.nom} formule={formule} annuel={annuel} />)}
        </div>

        <div className="lp-devis">
          <div className="lp-devis-texte">
            <strong>Plus de 3 000 apprenants par an ?</strong>
            <span>Réseaux, grands centres : construisons une offre sur mesure.</span>
          </div>
          <a className="lp-btn lp-btn-contour lp-btn-devis" href={`mailto:${EMAIL_CONTACT}`}>Demander un devis</a>
        </div>

        <div className="lp-grille lp-grille-230 lp-avantages">
          <div className="lp-avantage">
            <span className="lp-avantage-icone"><Svg taille={22} couleur="#115E59"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></Svg></span>
            <span><strong>Utilisateurs illimités</strong><br />Chacun son compte, traçabilité garantie</span>
          </div>
          <div className="lp-avantage">
            <span className="lp-avantage-icone"><Svg taille={22} couleur="#115E59"><path d="M4 19h16" /><path d="M7 15l3-4 3 2 4-6" /></Svg></span>
            <span><strong>Tolérance de 10 %</strong><br />avant de changer de formule</span>
          </div>
          <div className="lp-avantage">
            <span className="lp-avantage-icone"><Svg taille={22} couleur="#115E59"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></span>
            <span><strong>15 jours d&apos;essai gratuit</strong><br />sans carte bancaire</span>
          </div>
          <div className="lp-avantage">
            <span className="lp-avantage-icone lp-euro" aria-hidden="true">€</span>
            <span><strong>1 mois offert</strong><br />en paiement annuel</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="lp-section lp-fond-blanc">
      <div className="lp-conteneur lp-etroit">
        <h2 className="lp-faq-titre">Questions fréquentes</h2>
        <div className="lp-faq">
          {QUESTIONS.map(({ question, reponse }, i) => (
            <details key={question} open={i === 0}>
              <summary>{question}</summary>
              <p>{reponse}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function AppelFinal() {
  return (
    <section className="lp-fond-blanc">
      <div className="lp-conteneur lp-appel-conteneur">
        <div className="lp-appel">
          <div aria-hidden="true" className="lp-appel-bulle lp-appel-bulle-1 lp-flotte"></div>
          <div aria-hidden="true" className="lp-appel-bulle lp-appel-bulle-2 lp-flotte lp-f2"></div>
          <h2>Votre prochain audit Qualiopi commence aujourd&apos;hui</h2>
          <p>Testez Quali-formation gratuitement pendant 15 jours. Sans carte bancaire, sans engagement.</p>
          <Link className="lp-btn lp-btn-blanc lp-btn-grand" to={LIENS.inscription}>Démarrer mon essai gratuit</Link>
        </div>
      </div>
    </section>
  )
}

function PiedDePage() {
  return (
    <footer className="lp-pied">
      <div className="lp-conteneur lp-pied-contenu">
        <div className="lp-pied-colonnes">
          <div className="lp-pied-marque">
            <span className="lp-logo-nom">Quali-formation</span>
            <span>Le logiciel pour créer et gérer des formations conformes Qualiopi.</span>
          </div>
          <div className="lp-pied-colonne">
            <span className="lp-pied-titre">Produit</span>
            <Ancre section="fonctionnalites" className="lp-pied-lien">Fonctionnalités</Ancre>
            <Ancre section="tarifs" className="lp-pied-lien">Tarifs</Ancre>
            <Ancre section="faq" className="lp-pied-lien">FAQ</Ancre>
          </div>
          <div className="lp-pied-colonne">
            <span className="lp-pied-titre">Légal</span>
            <a className="lp-pied-lien" href="#mentions">Mentions légales</a>
            <a className="lp-pied-lien" href="#cgu">CGU / CGV</a>
            <a className="lp-pied-lien" href="#confidentialite">Politique de confidentialité</a>
            <a className="lp-pied-lien" href="#cookies">Gestion des cookies</a>
          </div>
          <div className="lp-pied-colonne">
            <span className="lp-pied-titre">Contact</span>
            <a className="lp-pied-lien" href={`mailto:${EMAIL_CONTACT}`}>{EMAIL_CONTACT}</a>
            <span>Lun–ven, 9h–18h</span>
            <a className="lp-pied-lien" href="#linkedin">LinkedIn</a>
          </div>
        </div>
        <div className="lp-copyright">© 2026 Quali-formation. Tous droits réservés.</div>
      </div>
    </footer>
  )
}

// Landing page (SCRUM-14) : première page du site pour un visiteur non connecté
function LandingPage() {
  return (
    <div className="lp">
      <EnTete />
      <main>
        <Accroche />
        <Fonctionnalites />
        <Etapes />
        <Avis />
        <Tarifs />
        <Faq />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}

export default LandingPage
