import { useEffect, useState } from 'react'
import { PageEnChargement } from '../components/ErreurChargement'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toastContext'
import { DocumentModele } from './DocumentModele'
import { MESSAGE_RETABLI, obtenirOrigine, retablirOrigine } from './serviceApi'

// Titre de la version affichée : « Modèle d'origine », « Version personnalisée » ou « Mon document (fichier) »
function libelleVersion(origine, modele) {
  if (origine) return 'Modèle d’origine'
  if (modele.statut === 'IMPORTE') return `Mon document${modele.nom_fichier_importe ? ` (${modele.nom_fichier_importe})` : ''}`
  return 'Version personnalisée'
}

// SCRUM-217 (maquettes SCRUM-217-1/2, prototype viewDoc) : fenêtre « <Document> · Modèle d'origine » en lecture
// seule, ouverte depuis l'éditeur (« Voir le modèle d'origine ») et depuis la carte (« Rétablir le modèle d'origine »).
// « Voir ma version » / « Voir le modèle d'origine » basculent la vue sans rien modifier (CA2). Modèle encore
// d'origine : seulement « Fermer ». RG5/RG8 : « Rétablir le modèle d'origine » s'applique ici, sans « Enregistrer ».
// `maVersion` : contenu affiché pour « Voir ma version » (dans l'éditeur, le document en cours) ;
// `onPersonnaliser` (depuis la carte seulement) : ouvre le modèle dans l'éditeur.
export function FenetreOrigine({ modele, maVersion = modele.contenu, onFermer, onRetabli, onPersonnaliser }) {
  const toast = useToast()
  const [origine, setOrigine] = useState(null)
  const [erreurChargement, setErreurChargement] = useState(null)
  const [vueOrigine, setVueOrigine] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const modifie = modele.statut !== 'ORIGINE'
  const affichageOrigine = vueOrigine || !modifie

  useEffect(() => {
    let actif = true
    obtenirOrigine(modele.type).then((o) => { if (actif) setOrigine(o) })
      .catch((e) => { if (actif) setErreurChargement(e) })
    return () => { actif = false }
  }, [modele.type])

  async function retablir() {
    setEnvoi(true)
    setErreur(null)
    try {
      const retabli = await retablirOrigine(modele.type)
      toast(MESSAGE_RETABLI)
      onRetabli(retabli)
    } catch (e) {
      setErreur(e.message)
      setEnvoi(false)
    }
  }

  let document
  if (!affichageOrigine) document = <DocumentModele contenu={maVersion} variables={modele.variables} nom={`${modele.nom} · ${libelleVersion(false, modele)}`} />
  else if (origine) document = <DocumentModele contenu={origine.contenu} variables={origine.variables} nom={`${modele.nom} · Modèle d’origine`} />
  else document = <PageEnChargement erreur={erreurChargement} texte="Chargement du modèle d’origine…" />

  return (
    <Modal onFermer={onFermer}>
      <dialog open className="mod-fenetre" aria-modal="true" aria-labelledby="mod-fenetre-titre">
        <header className="mod-fenetre-tete">
          <div>
            <h2 id="mod-fenetre-titre">{modele.nom} · {libelleVersion(affichageOrigine, modele)}</h2>
            <p>Lecture seule. Rien n’est modifié. Vous pouvez copier un passage.</p>
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Fermer</button>
        </header>
        <div className="mod-fenetre-doc doc-zone">{document}</div>
        <footer className="mod-fenetre-pied">
          {modifie && affichageOrigine && (
            <p className="mod-fenetre-rappel">
              « Rétablir le modèle d’origine » remplace {modele.statut === 'IMPORTE' ? 'votre document importé' : 'votre version personnalisée'}.
              {' '}Les modèles de la formation déjà créés ne changent pas.
            </p>
          )}
          {erreur && <p className="mod-erreur" role="alert">{erreur}</p>}
          {modifie && (affichageOrigine
            ? <button type="button" className="btn btn-line btn-sm" onClick={() => setVueOrigine(false)}>Voir ma version</button>
            : <button type="button" className="btn btn-line btn-sm" onClick={() => setVueOrigine(true)}>Voir le modèle d’origine</button>)}
          <button type="button" className="btn btn-line btn-sm" onClick={onFermer}>Fermer</button>
          {modifie && affichageOrigine && (
            <button type="button" className="btn btn-primary btn-sm" onClick={retablir} disabled={envoi || !origine}>
              {envoi ? 'Rétablissement…' : 'Rétablir le modèle d’origine'}
            </button>
          )}
          {!affichageOrigine && onPersonnaliser
            && <button type="button" className="btn btn-primary btn-sm" onClick={onPersonnaliser}>Personnaliser</button>}
        </footer>
      </dialog>
    </Modal>
  )
}
