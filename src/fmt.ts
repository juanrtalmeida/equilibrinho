import type { Match, Player, Settings } from './types.ts'
import { gameTotals, matchTime } from './engine/rating.ts'

export type Tab = 'home' | 'players' | 'build' | 'matches' | 'analysis' | 'settings'
export type Route = { tab: Tab; id?: string }
export type Go = (r: Route) => void

export const pname = (p?: Player) => (p ? p.nick || p.name : '(removido)')
export const posName = (s: Settings, id: string) => s.positions.find((p) => p.id === id)?.name ?? id
export const posShort = (s: Settings, id: string) => posName(s, id).slice(0, 3).toUpperCase()
export const teamLetter = (i: number) => String.fromCharCode(65 + i)
export const fmtDate = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const n1 = (x: number) => x.toFixed(1).replace('.', ',')

export function matchSummary(m: Match) {
  if (!m.games.length) return 'Aguardando resultado'
  return m.games
    .map((g) => {
      const { sa, sb } = gameTotals(g.sets)
      return `${m.teams[g.a]?.name ?? '?'} ${sa} × ${sb} ${m.teams[g.b]?.name ?? '?'}`
    })
    .join(' · ')
}

export const byTimeDesc = (a: Match, b: Match) => matchTime(b) - matchTime(a) || b.createdAt - a.createdAt

// Cores fixas por time (classes literais para o Tailwind enxergar).
const TEAM_BG = ['bg-team-a', 'bg-team-b', 'bg-team-c', 'bg-team-d']
const TEAM_TEXT = ['text-team-a', 'text-team-b', 'text-team-c', 'text-team-d']
export const teamBg = (i: number) => TEAM_BG[i % 4]
export const teamText = (i: number) => TEAM_TEXT[i % 4]
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
