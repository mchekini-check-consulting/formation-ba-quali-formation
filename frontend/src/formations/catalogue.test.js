import { describe, expect, it } from 'vitest'
import { hasProg, isPub, missingTiles, modaliteSequence, objList, TILES, tileDone } from './catalogue'
import { seed } from './demo'

const tuile = (id) => TILES.find((t) => t.id === id)
const exemple = (titre) => seed().find((f) => f.title.startsWith(titre))

describe('catalogue des blocs Qualiopi', () => {
  it('compte 13 blocs répartis en 3 parties (RG07)', () => {
    expect(TILES).toHaveLength(13)
    expect(new Set(TILES.map((t) => t.sec))).toEqual(new Set([0, 1, 2]))
  })

  it('un bloc est complet quand toutes ses questions ont une réponse (RG08)', () => {
    const t = tuile('tarif')
    expect(tileDone(t, { tarif: '1 200', unite: 'Par apprenant', taxe: 'HT', financements: ['OPCO'] }, {})).toBe(true)
    expect(tileDone(t, { tarif: '1 200', unite: 'Par apprenant', taxe: 'HT', financements: [] }, {})).toBe(false)
  })

  it('Indicateurs de résultats : une des deux réponses suffit (RG09)', () => {
    const t = tuile('resultats')
    expect(tileDone(t, { resultats_plan: 'Questionnaire à chaud' }, {})).toBe(true)
    expect(tileDone(t, { resultats_mesures: '4,6/5' }, {})).toBe(true)
    expect(tileDone(t, {}, {})).toBe(false)
  })

  it('l’assistance à distance n’est demandée que hors présentiel (RG10)', () => {
    const t = tuile('intervenants'), v = { formateurs: ['Sarah Benali — Business Analyst senior'] }
    expect(tileDone(t, v, { modalite: 'Présentiel' })).toBe(true)
    expect(tileDone(t, v, { modalite: 'Mixte' })).toBe(false)
    expect(tileDone(t, { ...v, assistance_dist: 'support@centre.fr' }, { modalite: 'Distanciel' })).toBe(true)
  })

  it('le bloc Programme exige au moins une séquence complète (RG16, RG18)', () => {
    const t = tuile('programme')
    const seq = { seq: 'Intro', objectif: 'Comprendre', contenu: 'Notions', duree: '3', modalite: 'Présentiel', activites: 'Exposé' }
    expect(tileDone(t, { modules: [] }, {})).toBe(false)
    expect(tileDone(t, { modules: [seq] }, {})).toBe(true)
    expect(tileDone(t, { modules: [seq, { ...seq, activites: '' }] }, {})).toBe(false)
  })

  it('les objectifs proposés aux séquences viennent du bloc Objectifs (RG19)', () => {
    expect(objList({ objectifs: 'fixer des objectifs ; déléguer une tâche.\nconduire un entretien' })).toEqual(['Fixer des objectifs', 'Déléguer une tâche', 'Conduire un entretien'])
  })

  it('la modalité d’une nouvelle séquence suit celle de la formation (RG20)', () => {
    expect(modaliteSequence('Distanciel')).toBe('Distanciel synchrone (classe virtuelle)')
    expect(modaliteSequence('Présentiel')).toBe('Présentiel')
  })

  it('calcule les blocs manquants des formations d’exemple', () => {
    expect(missingTiles(exemple('Business Analyst'))).toHaveLength(0)
    expect(missingTiles(exemple("Management d'équipe — niveau 2")).map((t) => t.id)).toEqual(['methodes', 'acces', 'positionnement', 'evaluation'])
  })

  it('une formation brouillon n’est jamais « publiée » (RG24)', () => {
    expect(isPub({ statut: 'brouillon', pub: 'publiee' })).toBe(false)
    expect(isPub({ statut: 'incomplete', pub: 'publiee' })).toBe(true)
  })

  it('détecte l’absence de programme (RG32)', () => {
    expect(hasProg(exemple('Sauveteur'))).toBe(false)
    expect(hasProg(exemple('Excel'))).toBe(true)
  })
})
