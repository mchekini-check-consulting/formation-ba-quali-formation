import { useRef, useState } from 'react'
import { verifierFichierWord } from './fichierWord'

// SCRUM-215 « Importer son propre document Word » : choix d'un .docx et conversion par le backend.
// Réutilisable (modèle générique, modèle de la formation SCRUM-219) : `importer(fichier)` appelle la bonne route
// et renvoie { contenu, nom_fichier } ; rien n'est enregistré ici (RG8), la page reçoit le résultat par `onImporte`.

export function BoutonImportWord({ libelle, className, importer, onImporte, onErreur }) {
  const champ = useRef(null)
  const [envoi, setEnvoi] = useState(false)

  async function choisir(e) {
    const fichier = e.target.files?.[0]
    e.target.value = '' // le même fichier peut être choisi à nouveau
    if (!fichier) return
    const probleme = verifierFichierWord(fichier)
    onErreur(probleme)
    if (probleme) return
    setEnvoi(true)
    try {
      const resultat = await importer(fichier)
      onImporte({ contenu: resultat.contenu, nomFichier: resultat.nom_fichier || fichier.name })
    } catch (erreur) {
      onErreur(erreur.message)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={envoi} onClick={() => champ.current.click()}>
        {envoi ? 'Import en cours…' : libelle}
      </button>
      <input ref={champ} type="file" hidden aria-label={libelle} onChange={choisir}
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
    </>
  )
}
