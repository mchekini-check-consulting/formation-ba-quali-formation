// SCRUM-214 « Insérer des variables dans un modèle » (maquette SCRUM-214-1) : panneau à droite de l'éditeur,
// variables classées par catégorie dans l'ordre reçu du backend (RG10). Réutilisable (modèles de la formation,
// SCRUM-219) : il ne fait qu'annoncer la variable choisie, par clic (`onInserer`) ou par glisser-déposer.

// Type des données glissées : seul l'éditeur des modèles l'accepte (EditeurDocument, handleDrop)
export const GLISSER_VARIABLE = 'application/x-quali-variable'

function parCategorie(variables) {
  const categories = new Map()
  for (const v of variables) {
    if (!categories.has(v.categorie)) categories.set(v.categorie, [])
    categories.get(v.categorie).push(v)
  }
  return [...categories]
}

export function PanneauVariables({ variables, onInserer, inactif = false }) {
  return (
    <section className="pv" aria-labelledby="pv-titre">
      <h2 id="pv-titre">Variables</h2>
      <p>Glissez une variable dans le document, ou cliquez dessus pour l’insérer à l’endroit du curseur.</p>
      {parCategorie(variables).map(([categorie, liste], i) => (
        <div key={categorie} className="pv-categorie" role="group" aria-labelledby={`pv-categorie-${i}`}>
          <h3 id={`pv-categorie-${i}`}>{categorie}</h3>
          <div className="pv-liste">
            {liste.map((v) => (
              <button key={v.code} type="button" className="doc-variable pv-variable" title={`{{${v.code}}}`}
                disabled={inactif} draggable={!inactif}
                onDragStart={(e) => {
                  e.dataTransfer.setData(GLISSER_VARIABLE, v.code)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onInserer(v.code)}>
                {v.libelle}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
