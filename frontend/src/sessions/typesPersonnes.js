import { creerApprenant, creerFormateur } from './serviceApi'

// Les deux parties prenantes que l'on peut créer depuis la page Sessions et planning.
// `le` : article utilisé dans les messages (« le formateur », « l’apprenant »).
export const PARTIES_PRENANTES = {
  formateur: {
    titre: 'Nouveau formateur', aide: 'Créer la fiche d’un formateur', icone: 'inscription', classe: 'formateur',
    le: 'le formateur', Le: 'Le formateur', creer: creerFormateur, // SCRUM-26
  },
  apprenant: {
    titre: 'Nouvel apprenant', aide: 'Créer la fiche d’un apprenant', icone: 'diplome', classe: '',
    le: 'l’apprenant', Le: 'L’apprenant', creer: creerApprenant, // SCRUM-27
  },
}

// Message affiché sur la page après la création
export const messageCreation = (type, p) =>
  `${PARTIES_PRENANTES[type].Le} « ${p.prenom} ${p.nom} » a été créé. Vous pouvez maintenant l’ajouter à une session.`
