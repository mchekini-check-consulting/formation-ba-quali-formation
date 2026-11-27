import { useEffect, useState } from 'react'
import { PageEnChargement } from '../components/ErreurChargement'
import { Modal } from '../components/Modal'
import { DocumentModele } from './DocumentModele'
import { obtenirModele } from './serviceApi'

// SCRUM-219 (prototype viewDoc d'un modèle de la formation) : « Voir le modèle générique » depuis l'éditeur d'un
// modèle de la formation : le modèle générique du compte, en lecture seule ; rien n'est modifié.
export function FenetreGenerique({ modele, onFermer }) {
  const [generique, setGenerique] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let actif = true
    obtenirModele(modele.type).then((g) => { if (actif) setGenerique(g) })
      .catch((e) => { if (actif) setErreur(e) })
    return () => { actif = false }
  }, [modele.type])

  return (
    <Modal onFermer={onFermer}>
      <dialog open className="mod-fenetre" aria-modal="true" aria-labelledby="mod-generique-titre">
        <header className="mod-fenetre-tete">
          <div>
            <h2 id="mod-generique-titre">{modele.nom} · Modèle générique</h2>
            <p>Lecture seule. Rien n’est modifié.</p>
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Fermer</button>
        </header>
        <div className="mod-fenetre-doc doc-zone">
          {generique
            ? <DocumentModele contenu={generique.contenu} variables={generique.variables} nom={`${modele.nom} · Modèle générique`} />
            : <PageEnChargement erreur={erreur} texte="Chargement du modèle générique…" />}
        </div>
        <footer className="mod-fenetre-pied">
          <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Fermer</button>
        </footer>
      </dialog>
    </Modal>
  )
}
