import { afterEach, describe, expect, it, vi } from 'vitest'
import { rechercherEntreprise } from './rechercheEntreprise'

// Recherche d'une entreprise par SIRET (service partagé SCRUM-221 / SCRUM-113)
afterEach(() => vi.unstubAllGlobals())

const reponse = (status, corps) => ({ ok: status < 400, status, json: async () => corps })
const ENTREPRISE = { siret: '12345678900012', raison_sociale: 'HITECH FORMATION', adresse: '12 RUE DES LILAS 75011 PARIS' }

describe('rechercherEntreprise', () => {
  it('trouvée : renvoie la raison sociale et l’adresse (GET /entreprises/<siret>/, avec la session)', async () => {
    const fetch = vi.fn(async () => reponse(200, ENTREPRISE))
    vi.stubGlobal('fetch', fetch)
    expect(await rechercherEntreprise('12345678900012')).toEqual({ statut: 'trouvee', entreprise: ENTREPRISE })
    expect(fetch).toHaveBeenCalledWith('/api/entreprises/12345678900012/', { credentials: 'include' })
  })

  it('introuvable, SIRET refusé, service indisponible, serveur injoignable ou réponse illisible : « introuvable »', async () => {
    const cas = [
      async () => reponse(404, { code: 'ENTREPRISE_INTROUVABLE' }),
      async () => reponse(400, { code: 'SIRET_INVALIDE' }),
      async () => reponse(503, { code: 'SERVICE_INDISPONIBLE' }),
      async () => { throw new TypeError('réseau') },
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('illisible') } }),
    ]
    for (const simulation of cas) {
      vi.stubGlobal('fetch', vi.fn(simulation))
      expect(await rechercherEntreprise('12345678900012')).toEqual({ statut: 'introuvable' })
    }
  })
})
