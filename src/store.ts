import { useSyncExternalStore } from 'react'
import { defaultSettings, emptyDB, emptyDraft } from './defaults.ts'
import { replay, type Model } from './engine/rating.ts'
import type { DB, Draft, Match, Player } from './types.ts'

// ponytail: tudo em localStorage (~5MB, milhares de partidas); migrar p/ IndexedDB se estourar.
function createStore<T>(key: string, init: () => T, normalize: (x: unknown) => T) {
  const load = () => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return normalize(JSON.parse(raw))
    } catch (e) {
      console.error(e)
    }
    return init()
  }
  let state = load()
  const subs = new Set<() => void>()
  const emit = () => subs.forEach((f) => f())
  const set = (next: T) => {
    state = next
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      alert('Não foi possível salvar no dispositivo (armazenamento cheio?). Exporte um backup em Dados.')
    }
    emit()
  }
  window.addEventListener('storage', (e) => {
    if (e.key === key) {
      state = load()
      emit()
    }
  })
  return {
    get: () => state,
    set,
    mutate: (fn: (d: T) => void) => {
      const next = structuredClone(state)
      fn(next)
      set(next)
    },
    use: () =>
      useSyncExternalStore(
        (cb) => {
          subs.add(cb)
          return () => subs.delete(cb)
        },
        () => state,
      ),
  }
}

export function normalizeDB(x: unknown): DB {
  const d = x as Partial<DB>
  if (!d || typeof d !== 'object' || !Array.isArray(d.players) || !Array.isArray(d.matches))
    throw new Error('Arquivo não é um backup do Equilibrinho')
  for (const p of d.players) if (!p?.id || typeof p.name !== 'string') throw new Error('Jogador inválido no backup')
  for (const m of d.matches) if (!m?.id || !Array.isArray(m.teams)) throw new Error('Partida inválida no backup')
  const def = defaultSettings()
  const s = { ...def, ...d.settings }
  return {
    version: 1,
    players: d.players.map((p) => ({ secondary: [], skills: {}, notes: '', available: true, ...(p as Partial<Player>) }) as Player),
    matches: d.matches.map((m) => ({ games: [], playerRatings: {}, notes: '', events: '', predicted: [], ...(m as Partial<Match>) }) as Match),
    groups: Array.isArray(d.groups) ? d.groups : [],
    settings: { ...s, weights: { ...def.weights, ...s.weights }, learning: { ...def.learning, ...s.learning } },
  }
}

const dbStore = createStore('equilibrinho.db', emptyDB, normalizeDB)
const draftStore = createStore('equilibrinho.draft', emptyDraft, (x) => ({ ...emptyDraft(), ...(x as Draft) }))

export const useDB = dbStore.use
export const mutate = dbStore.mutate
export const getDB = dbStore.get
export const useDraft = draftStore.use
export const mutateDraft = draftStore.mutate

const models = new WeakMap<DB, Model>()
function modelOf(db: DB) {
  let m = models.get(db)
  if (!m) models.set(db, (m = replay(db)))
  return m
}
export const useModel = () => modelOf(useDB())

export const uid = () => crypto.randomUUID()

export function addPlayer(name = '', primary?: string, level = 5) {
  const id = uid()
  mutate((d) => {
    d.players.push({
      id, name, available: true, notes: '', createdAt: Date.now(),
      primary: primary ?? d.settings.positions[0]?.id ?? '', secondary: [],
      skills: Object.fromEntries(d.settings.attributes.map((a) => [a.id, level])),
    })
  })
  return id
}

export function exportBackup() {
  const blob = new Blob([JSON.stringify({ ...getDB(), exportedAt: new Date().toISOString() }, null, 1)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `equilibrinho-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function importBackup(text: string) {
  dbStore.set(normalizeDB(JSON.parse(text)))
  draftStore.set(emptyDraft())
}

export function resetAll() {
  dbStore.set(emptyDB())
  draftStore.set(emptyDraft())
}
