import { describe, expect, it } from 'vitest'
import { THEME_LIBELLE, themeDe } from './themes'

// Le bandeau de chaque carte : le métier est déduit de l'intitulé
describe('thème d’une formation', () => {
  it.each([
    ['Business Analyst : recueillir et formaliser le besoin', 'Business Analyst'],
    ['Product Owner : piloter le produit en agile Scrum', 'Product Owner'],
    ['Testeur automaticien : automatiser les tests avec Selenium et Cypress', 'Test et qualité'],
    ["DevOps : de l'intégration au déploiement continu", 'DevOps'],
    ['Architecte logiciel : concevoir des architectures évolutives', 'Architecture'],
    ['IA générative pour les métiers du projet', 'Intelligence artificielle'],
    ['Prompt engineering : bien utiliser l’IA au quotidien', 'Intelligence artificielle'],
    ["Management d'équipe — niveau 1", 'Management'],
    ['Gestion de projet agile', 'Gestion de projet'],
    ['Excel avancé', 'Bureautique'],
    ['Recette - Un champ non rempli', 'Formation'],
  ])('« %s » → %s', (titre, libelle) => {
    expect(THEME_LIBELLE[themeDe(titre)]).toBe(libelle)
  })
})
