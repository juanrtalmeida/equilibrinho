import type { Constraints, Format, Player, Settings } from '../types.ts'
import { assign, canPlay, logistic, pairKey, playerStrength, sigmaOf, teamStrength, type Model, type Syn } from './rating.ts'
import { mulberry32, shuffle } from './rng.ts'

export interface Ctx {
  s: Settings
  model: Model
  byId: Map<string, Player>
  fmt: Format
  cons: Constraints
}

export interface TeamEval {
  ids: string[]
  strength: number
  sigma: number
  attrs: Record<string, number>
  pos: Record<string, string>
  posCount: Record<string, number>
  missing: string[]
  missingDesired: string[]
  top: number
  synergies: Syn[]
}

export interface Eval {
  teams: TeamEval[]
  cost: number
  parts: { label: string; value: number }[]
  reasons: string[]
  winProb: number | null
  confidence: number
}

const sd = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length)
}

const posName = (s: Settings, id: string) => s.positions.find((p) => p.id === id)?.name ?? id
const teamName = (i: number) => `Time ${String.fromCharCode(65 + i)}`

export function evaluate(board: string[][], ctx: Ctx): Eval {
  const { s, model, byId, fmt, cons } = ctx
  const w = s.weights
  const reasons: string[] = []
  const pname = (id: string) => byId.get(id)?.nick || byId.get(id)?.name || '?'

  const teams: TeamEval[] = board.map((ids) => {
    const ps = ids.map((id) => byId.get(id)).filter((p): p is Player => !!p)
    const pos = assign(ps, fmt, s)
    const attrs: Record<string, number> = {}
    for (const a of s.attributes) attrs[a.id] = ps.length ? ps.reduce((x, p) => x + (p.skills[a.id] ?? 5), 0) / ps.length : 0
    const posCount: Record<string, number> = {}
    for (const p of ps) posCount[p.primary] = (posCount[p.primary] ?? 0) + 1
    const synergies: Syn[] = []
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const sy = model.syn.get(pairKey(ids[i], ids[j]))
        if (sy?.evidence) synergies.push(sy)
      }
    const sig = ps.map((p) => sigmaOf(model.stats.get(p.id)?.n ?? 0, model.priorN))
    return {
      ids,
      strength: teamStrength(ps, pos, s, model),
      sigma: ps.length ? Math.sqrt(sig.reduce((a, x) => a + x * x, 0)) / ps.length : 0,
      attrs,
      pos,
      posCount,
      missing: Object.keys(fmt.required).filter((k) => fmt.required[k] > 0 && !ps.some((p) => canPlay(p, k))),
      missingDesired: Object.keys(fmt.desired).filter(
        (k) => fmt.desired[k] > 0 && ps.filter((p) => canPlay(p, k)).length < fmt.desired[k],
      ),
      top: Math.max(0, ...ps.map((p) => playerStrength(p, pos[p.id], s, model))),
      synergies,
    }
  })

  const strengthSd = sd(teams.map((t) => t.strength))
  const skillSd = s.attributes.length
    ? (s.attributes.reduce((a, at) => a + sd(teams.map((t) => t.attrs[at.id])), 0) / s.attributes.length) * 10
    : 0

  let posCost = 0
  for (const t of teams) {
    posCost += t.missing.length * 5 + t.missingDesired.length * 1.5
    t.missing.forEach((k, i) => i < 3 && reasons.push(`${teamName(teams.indexOf(t))} sem ${posName(s, k)} de ofício`))
  }
  for (const p of s.positions) posCost += sd(teams.map((t) => t.posCount[p.id] ?? 0)) * 3
  // quem ocupa cada posição obrigatória deve ter nível parecido entre os times
  for (const k of Object.keys(fmt.required))
    posCost += sd(
      teams.map((t) => {
        const id = t.ids.find((x) => t.pos[x] === k)
        const p = id ? byId.get(id) : undefined
        return p ? playerStrength(p, k, s, model) : 0
      }),
    ) / 2

  const depSd = sd(teams.map((t) => t.top))
  const uncSd = sd(teams.map((t) => t.sigma))

  let violations = 0
  const teamOf = new Map<string, number>()
  board.forEach((ids, i) => ids.forEach((id) => teamOf.set(id, i)))
  for (const [a, b] of cons.forbid)
    if (teamOf.has(a) && teamOf.get(a) === teamOf.get(b)) {
      violations++
      reasons.push(`${pname(a)} e ${pname(b)} estão juntos, mas a restrição pede separados`)
    }
  for (const [a, b] of cons.together)
    if (teamOf.has(a) && teamOf.has(b) && teamOf.get(a) !== teamOf.get(b)) {
      violations++
      reasons.push(`${pname(a)} e ${pname(b)} separados, mas a restrição pede juntos`)
    }

  const parts = [
    { label: 'Diferença de força', value: strengthSd * w.strength },
    { label: 'Perfil de habilidades', value: skillSd * w.skills },
    { label: 'Posições', value: posCost * w.positions },
    { label: 'Dependência de destaque', value: depSd * w.dependency },
    { label: 'Incerteza (novatos)', value: uncSd * w.uncertainty },
  ]
  const cost = parts.reduce((a, p) => a + p.value, 0) + violations * 1000

  for (const t of teams)
    for (const sy of t.synergies)
      reasons.push(`Sinergia ${sy.v > 0 ? 'positiva' : 'negativa'} considerada: ${pname(sy.a)} + ${pname(sy.b)} (${sy.n} jogos)`)

  const all = board.flat()
  const confidence = all.length
    ? all.reduce((a, id) => {
        const n = model.stats.get(id)?.n ?? 0
        return a + n / (n + model.priorN)
      }, 0) / all.length
    : 0

  return {
    teams,
    cost,
    parts,
    reasons,
    winProb: teams.length === 2 ? logistic((teams[0].strength - teams[1].strength) / s.learning.scale) : null,
    confidence,
  }
}

const key = (b: string[][]) => b.map((t) => [...t].sort().join(',')).sort().join('/')

// Busca local com reinícios: determinística para o mesmo seed e as mesmas entradas.
export function generate(participants: string[], ctx: Ctx, seed: number, howMany = 3, restarts = 12): string[][][] {
  const T = Math.max(1, ctx.fmt.teams)
  const ids = [...participants].sort()
  const locks = ctx.cons.locks
  const isLocked = (id: string) => locks[id] !== undefined && locks[id] < T
  const N = ids.length
  const cap = Array.from({ length: T }, (_, i) => Math.floor(N / T) + (i < N % T ? 1 : 0))
  const rnd = mulberry32(seed)
  const found = new Map<string, { board: string[][]; cost: number }>()

  for (let r = 0; r < restarts; r++) {
    const board: string[][] = Array.from({ length: T }, () => [])
    for (const id of ids) if (isLocked(id)) board[locks[id]].push(id)
    for (const id of shuffle(ids.filter((x) => !isLocked(x)), rnd)) {
      let best = 0
      for (let i = 1; i < T; i++) if (cap[i] - board[i].length > cap[best] - board[best].length) best = i
      board[best].push(id)
    }
    let cur = evaluate(board, ctx).cost
    for (let iter = 0, improved = true; improved && iter < 50; iter++) {
      improved = false
      for (let i = 0; i < T; i++)
        for (let j = i + 1; j < T; j++)
          for (let x = 0; x < board[i].length; x++)
            for (let y = 0; y < board[j].length; y++) {
              const a = board[i][x]
              const b = board[j][y]
              if (isLocked(a) || isLocked(b)) continue
              board[i][x] = b
              board[j][y] = a
              const c = evaluate(board, ctx).cost
              if (c < cur - 1e-9) {
                cur = c
                improved = true
              } else {
                board[i][x] = a
                board[j][y] = b
              }
            }
    }
    const k = key(board)
    if (!found.has(k)) found.set(k, { board: board.map((t) => [...t]), cost: cur })
  }
  return [...found.entries()]
    .sort((a, b) => a[1].cost - b[1].cost || (a[0] < b[0] ? -1 : 1))
    .slice(0, howMany)
    .map(([, v]) => v.board)
}
