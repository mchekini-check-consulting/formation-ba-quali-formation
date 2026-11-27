import { creerApprenant, creerFormateur } from './serviceApi'

// Les deux parties prenantes que l'on peut créer depuis la page Sessions et planning.
// `le` : article utilisé dans les messages (« le formateur », « l’apprenant »).
export const PARTIES_PRENANTES = {
  formateur: {
    titre: 'Nouveau formateur', le: 'le formateur', Le: 'Le formateur', creer: creerFormateur, // SCRUM-26
  },
  apprenant: {
    titre: 'Nouvel apprenant', le: 'l’apprenant', Le: 'L’apprenant', creer: creerApprenant, // SCRUM-27
  },
}

// Les 3 choix du menu « Parties prenantes », dans l'ordre de la maquette SCRUM-167
export const CHOIX_PARTIES_PRENANTES = [
  { type: 'apprenant', titre: PARTIES_PRENANTES.apprenant.titre },
  { type: 'formateur', titre: PARTIES_PRENANTES.formateur.titre },
  { type: 'entreprise', titre: 'Nouvelle entreprise cliente' }, // SCRUM-113
]

// Message affiché sur la page après la création
export function messageCreation(type, p) {
  if (type === 'entreprise') return `L’entreprise cliente « ${p.raison_sociale} » a été créée.`
  return `${PARTIES_PRENANTES[type].Le} « ${p.prenom} ${p.nom} » a été créé. Vous pouvez maintenant l’ajouter à une session.`
}
