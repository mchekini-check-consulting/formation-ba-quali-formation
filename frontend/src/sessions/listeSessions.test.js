import { describe, expect, it } from 'vitest'
import {
  aujourdhuiParis, avancement, datesCourtes, etat, formateurs, inscrits, lieu, nombresOnglets, remplissage, sessionsOnglet,
} from './listeSessions'

// SCRUM-167 : règles de la liste des sessions
const session = (id, date_debut, date_fin, autres = {}) => ({ id, date_debut, date_fin, ...autres })
const AUJOURDHUI = '2026-03-11'
const SESSIONS = [
  session(1, '2026-03-20', '2026-03-21'), // à venir
  session(2, '2026-03-10', '2026-03-12'), // en cours
  session(3, '2026-03-01', '2026-03-02'), // passée
  session(4, '2026-03-12', '2026-03-12'), // à venir (demain)
  session(5, '2026-03-09', '2026-03-10'), // passée (finie hier)
]
const ids = (liste) => liste.map((s) => s.id)

describe('aujourd’hui à l’heure de Paris', () => {
  it('change de jour à minuit à Paris, pas à minuit UTC', () => {
    expect(aujourdhuiParis(new Date('2026-03-10T23:30:00Z'))).toBe('2026-03-11') // 00 h 30 à Paris (hiver)
    expect(aujourdhuiParis(new Date('2026-07-10T21:59:00Z'))).toBe('2026-07-10') // 23 h 59 à Paris (été)
  })
})

describe('onglets', () => {
  it('classe chaque session : en cours, à venir ou passée', () => {
    expect(SESSIONS.map((s) => etat(s, AUJOURDHUI))).toEqual(['A_VENIR', 'EN_COURS', 'PASSEE', 'A_VENIR', 'PASSEE'])
    // Bornes : le premier et le dernier jour sont « en cours »
    expect(etat(session(9, AUJOURDHUI, AUJOURDHUI), AUJOURDHUI)).toBe('EN_COURS')
  })

  it('CA1 : « Toutes » = en cours et à venir, triées par date de début', () => {
    expect(ids(sessionsOnglet(SESSIONS, 'toutes', AUJOURDHUI))).toEqual([2, 4, 1])
  })

  it('CA2 : « En cours » et « À venir »', () => {
    expect(ids(sessionsOnglet(SESSIONS, 'en-cours', AUJOURDHUI))).toEqual([2])
    expect(ids(sessionsOnglet(SESSIONS, 'a-venir', AUJOURDHUI))).toEqual([4, 1])
  })

  it('CA3 : « Passées » de la plus récente à la plus ancienne ; la session finie hier est en tête', () => {
    expect(ids(sessionsOnglet(SESSIONS, 'passees', AUJOURDHUI))).toEqual([5, 3])
  })

  it('compte les sessions de chaque onglet', () => {
    expect(nombresOnglets(SESSIONS, AUJOURDHUI)).toEqual({ toutes: 3, 'en-cours': 1, 'a-venir': 2, passees: 2 })
    expect(nombresOnglets([], AUJOURDHUI)).toEqual({ toutes: 0, 'en-cours': 0, 'a-venir': 0, passees: 0 })
  })

  it('à date de début égale, garde l’ordre de création', () => {
    const memeJour = [session(8, '2026-04-01', '2026-04-02'), session(7, '2026-04-01', '2026-04-01')]
    expect(ids(sessionsOnglet(memeJour, 'toutes', AUJOURDHUI))).toEqual([7, 8])
  })
})

describe('avancement', () => {
  it('CA2 : session du 10 au 12 mars, le 11 : « Jour 2 sur 3 »', () => {
    expect(avancement(session(2, '2026-03-10', '2026-03-12'), AUJOURDHUI)).toBe('Jour 2 sur 3')
  })
  it('« Demain », « Dans N jours », « Terminée »', () => {
    expect(avancement(session(4, '2026-03-12', '2026-03-12'), AUJOURDHUI)).toBe('Demain')
    expect(avancement(session(1, '2026-03-20', '2026-03-21'), AUJOURDHUI)).toBe('Dans 9 jours')
    expect(avancement(session(5, '2026-03-09', '2026-03-10'), AUJOURDHUI)).toBe('Terminée')
  })
  it('compte les jours sans être gêné par le changement d’heure (29 mars 2026)', () => {
    expect(avancement(session(6, '2026-03-28', '2026-03-31'), '2026-03-30')).toBe('Jour 3 sur 4')
    expect(avancement(session(6, '2026-04-05', '2026-04-05'), '2026-03-27')).toBe('Dans 9 jours')
  })
})

describe('affichage d’une ligne', () => {
  it('dates courtes', () => {
    expect(datesCourtes(session(1, '2026-11-26', '2026-11-28'))).toBe('26 – 28 nov.')
    expect(datesCourtes(session(1, '2026-11-28', '2026-11-28'))).toBe('28 nov.')
    expect(datesCourtes(session(1, '2026-11-30', '2026-12-02'))).toBe('30 nov. – 2 déc.')
    expect(datesCourtes(session(1, '2026-02-03', '2026-02-05'))).toBe('3 – 5 févr.')
  })

  it('lieu, ou « Distanciel » pour une classe virtuelle', () => {
    expect(lieu({ modalite: 'PRESENTIEL', lieu: 'Lyon' })).toBe('Lyon')
    expect(lieu({ modalite: 'DISTANCIEL', lieu: '' })).toBe('Distanciel')
    expect(lieu({ modalite: 'MIXTE', lieu: 'Paris' })).toBe('Paris')
    expect(lieu({ modalite: 'PRESENTIEL', lieu: '' })).toBe('—')
  })

  it('formateurs : prénom et nom', () => {
    expect(formateurs({ formateurs_noms: [{ prenom: 'Nadia', nom: 'Haddad' }, { prenom: 'Julien', nom: 'Lefèvre' }] }))
      .toBe('Nadia Haddad, Julien Lefèvre')
    expect(formateurs({ formateurs_noms: [] })).toBe('—')
    expect(formateurs({})).toBe('—')
  })

  it('inscrits « N / places » et remplissage de la barre', () => {
    expect(inscrits({ nombre_apprenants: 6, nombre_places: 8 })).toBe('6 / 8')
    expect(remplissage({ nombre_apprenants: 6, nombre_places: 8 })).toBe(75)
    expect(remplissage({ nombre_apprenants: 9, nombre_places: 8 })).toBe(100)
    // Anciennes sessions sans nombre de places
    expect(inscrits({ nombre_apprenants: 2, nombre_places: null })).toBe('2')
    expect(remplissage({ nombre_apprenants: 2, nombre_places: null })).toBe(0)
  })
})
