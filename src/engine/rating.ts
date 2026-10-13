import type { DB, Format, Match, Player, Settings } from '../types.ts'

// Força derivada por replay de todas as partidas: nada aqui é salvo,
// então corrigir/excluir um resultado recalcula tudo de forma determinística.

export interface PlayerStat {
  offset: number // ajuste aprendido somado à força manual
  n: number // jogos disputados
  wins: number
  losses: number
  expSum: number
  obsSum: number
  history: { t: number; v: number }[]
  byPos: Record<string, { n: number; w: number }>
  matchIds: string[]
}

export interface Syn {
  a: string
  b: string
  n: number
  sum: number
  sumSq: number
  v: number // efeito estimado em pontos de força (com encolhimento)
  conf: number
  evidence: boolean
}

export interface Calib {
  matchId: string
  game: number
  t: number
  expected: number // prob. estimada do time A
  observed: number
  favoriteWon: boolean | null
}

export interface Model {
  stats: Map<string, PlayerStat>
  syn: Map<string, Syn>
  calib: Calib[]
  priorN: number
}

const SIGMA0 = 15
const SYN_PTS = 10 // resíduo médio 0,1 -> ~1 ponto de força

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const logistic = (x: number) => 1 / (1 + Math.exp(-x))
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export const matchTime = (m: Match) => (m.date ? Date.parse(m.date) || m.createdAt : m.createdAt)
export const sigmaOf = (n: number, priorN: number) => SIGMA0 / Math.sqrt(1 + n / priorN)

export function skillScore(p: Player, pos: string, s: Settings) {
  const w = s.posWeights[pos] ?? {}
  let num = 0
  let den = 0
  for (const a of s.attributes) {
    const wi = w[a.id] ?? 1
    num += wi * (p.skills[a.id] ?? 5)
    den += wi
  }
  return den ? (num / den) * 10 : 50
}

export const fit = (p: Player, pos: string) => (p.primary === pos ? 1 : p.secondary.includes(pos) ? 0.9 : 0.75)
export const canPlay = (p: Player, pos: string) => p.primary === pos || p.secondary.includes(pos)

export function newStat(): PlayerStat {
  return { offset: 0, n: 0, wins: 0, losses: 0, expSum: 0, obsSum: 0, history: [], byPos: {}, matchIds: [] }
}

export function emptyModel(priorN: number): Model {
  return { stats: new Map(), syn: new Map(), calib: [], priorN }
}

// Força do jogador numa posição: habilidade manual ponderada × adequação + ajuste aprendido.
export function playerStrength(p: Player, pos: string, s: Settings, model: Model) {
  return skillScore(p, pos, s) * fit(p, pos) + (model.stats.get(p.id)?.offset ?? 0)
}

// Distribui posições: todos começam na principal; vagas não cobertas puxam jogadores excedentes,
// preferindo quem tem a posição como secundária. Fora de posição só para vaga obrigatória.
export function assign(ps: Player[], fmt: Format, s: Settings) {
  const out: Record<string, string> = Object.fromEntries(ps.map((p) => [p.id, p.primary]))
  const quota = (pos: string) => (fmt.required[pos] ?? 0) + (fmt.desired[pos] ?? 0)
  const count = (pos: string) => ps.filter((p) => out[p.id] === pos).length
  const fill = (pos: string, need: number, anyone: boolean) => {
    while (count(pos) < need) {
      let best: Player | undefined
      let bs = -Infinity
      for (const p of ps) {
        const cur = out[p.id]
        if (cur === pos || count(cur) <= quota(cur)) continue // não desfalca outra vaga
        if (!anyone && !canPlay(p, pos)) continue
        const sc = (canPlay(p, pos) ? 1000 : 0) + skillScore(p, pos, s)
        if (sc > bs) [best, bs] = [p, sc]
      }
      if (!best) return
      out[best.id] = pos
    }
  }
  for (const [pos, c] of Object.entries(fmt.required)) fill(pos, c, true)
  for (const [pos, c] of Object.entries(fmt.desired)) fill(pos, (fmt.required[pos] ?? 0) + c, false)
  return out
}

export function synOf(model: Model, a: string, b: string) {
  return model.syn.get(pairKey(a, b))?.v ?? 0
}

export function teamStrength(ps: Player[], pos: Record<string, string>, s: Settings, model: Model) {
  if (!ps.length) return 0
  let sum = 0
  let syn = 0
  for (let i = 0; i < ps.length; i++) {
    sum += playerStrength(ps[i], pos[ps[i].id] ?? ps[i].primary, s, model)
    for (let j = i + 1; j < ps.length; j++) syn += synOf(model, ps[i].id, ps[j].id)
  }
  return (sum + s.weights.synergy * syn) / ps.length
}

export function gameTotals(sets: [number, number][]) {
  let pa = 0, pb = 0, sa = 0, sb = 0
  for (const [x, y] of sets) {
    pa += x
    pb += y
    if (x > y) sa++
    else if (y > x) sb++
  }
  // vencedor por sets; empate em sets decide nos pontos
  const winner = sa !== sb ? (sa > sb ? 0 : 1) : pa !== pb ? (pa > pb ? 0 : 1) : null
  return { pa, pb, sa, sb, winner }
}

function finishSyn(sy: Syn, priorN: number) {
  sy.v = (sy.sum / (sy.n + priorN)) * SYN_PTS
  sy.conf = sy.n / (sy.n + priorN)
  const mean = sy.sum / sy.n
  const sd = Math.sqrt(Math.max(sy.sumSq / sy.n - mean * mean, 1e-4))
  sy.evidence = sy.n >= 3 && Math.abs(mean) > (2 * sd) / Math.sqrt(sy.n) && Math.abs(sy.v) >= 0.5
}

export function replay(db: DB): Model {
  const s = db.settings
  const L = s.learning
  const model = emptyModel(L.priorN)
  const byId = new Map(db.players.map((p) => [p.id, p]))
  const st = (id: string) => {
    let x = model.stats.get(id)
    if (!x) model.stats.set(id, (x = newStat()))
    return x
  }

  const ordered = db.matches.filter((m) => m.games.length).sort((a, b) => matchTime(a) - matchTime(b) || a.createdAt - b.createdAt)

  for (const m of ordered) {
    const t = matchTime(m)
    const teamPs = m.teams.map((tm) => tm.playerIds.map((id) => byId.get(id)).filter((p): p is Player => !!p))
    const pos = m.teams.map((tm, i) => tm.positions ?? assign(teamPs[i], m.format, s))

    const update = (ps: Player[], posMap: Record<string, string>, r: number, expected: number, observed: number, won: boolean | null) => {
      const sig2 = ps.map((p) => sigmaOf(st(p.id).n, L.priorN) ** 2)
      const avg = sig2.reduce((a, b) => a + b, 0) / ps.length
      ps.forEach((p, i) => {
        const x = st(p.id)
        // novatos (sigma alto) absorvem mais do resultado; teto evita saltos após um único jogo
        x.offset += clamp(L.k * r * (sig2[i] / avg), -L.maxDelta, L.maxDelta)
        x.n++
        if (won === true) x.wins++
        if (won === false) x.losses++
        x.expSum += expected
        x.obsSum += observed
        const bp = (x.byPos[posMap[p.id]] ??= { n: 0, w: 0 })
        bp.n++
        if (won) bp.w++
      })
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const k = pairKey(ps[i].id, ps[j].id)
          let sy = model.syn.get(k)
          if (!sy) {
            const [a, b] = k.split('|')
            model.syn.set(k, (sy = { a, b, n: 0, sum: 0, sumSq: 0, v: 0, conf: 0, evidence: false }))
          }
          sy.n++
          sy.sum += r
          sy.sumSq += r * r
          finishSyn(sy, L.priorN)
        }
    }

    for (const [gi, g] of m.games.entries()) {
      const A = teamPs[g.a]
      const B = teamPs[g.b]
      if (!A?.length || !B?.length) continue
      const { pa, pb, winner } = gameTotals(g.sets)
      if (pa + pb === 0) continue
      // proporção de pontos esticada: 25x15 -> 0,875; 25x23 -> 0,56
      const observed = clamp(0.5 + (pa / (pa + pb) - 0.5) * 3, 0, 1)
      // força já inclui sinergias atuais, então o resíduo mede só o que ainda não foi explicado
      const sa = teamStrength(A, pos[g.a], s, model)
      const sb = teamStrength(B, pos[g.b], s, model)
      const expected = logistic((sa - sb) / L.scale)
      const r = observed - expected
      model.calib.push({
        matchId: m.id, game: gi, t, expected, observed,
        favoriteWon: winner === null || Math.abs(sa - sb) < 1e-9 ? null : (sa > sb) === (winner === 0),
      })
      update(A, pos[g.a], r, expected, observed, winner === null ? null : winner === 0)
      update(B, pos[g.b], -r, 1 - expected, 1 - observed, winner === null ? null : winner === 1)
    }

    // avaliação individual opcional puxa levemente em direção à nota dada
    for (const [id, rating] of Object.entries(m.playerRatings ?? {})) {
      const p = byId.get(id)
      if (!p || !rating) continue
      const x = st(id)
      x.offset += clamp(0.1 * (rating * 10 - (skillScore(p, p.primary, s) + x.offset)), -L.maxDelta, L.maxDelta)
    }

    for (const ps of teamPs)
      for (const p of ps) {
        const x = st(p.id)
        x.matchIds.push(m.id)
        x.history.push({ t, v: skillScore(p, p.primary, s) + x.offset })
      }
  }
  return model
}
