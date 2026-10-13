import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDB } from '../defaults.ts'
import type { DB, Match, Player } from '../types.ts'
import { evaluate, generate, type Ctx } from './balance.ts'
import { assign, replay } from './rating.ts'

const ATTRS = ['saque', 'recepcao', 'levantamento', 'ataque', 'bloqueio', 'defesa', 'movimentacao', 'consistencia', 'decisao']

function mkPlayer(id: string, lvl: number, primary: string): Player {
  return {
    id, name: id, available: true, notes: '', primary, secondary: [], createdAt: 0,
    skills: Object.fromEntries(ATTRS.map((a) => [a, lvl])),
  }
}

function setup(): DB {
  const db = emptyDB()
  const pos = ['levantador', 'levantador', 'ponteiro', 'ponteiro', 'ponteiro', 'ponteiro', 'central', 'central', 'central', 'central', 'oposto', 'oposto']
  db.players = pos.map((p, i) => mkPlayer(`p${i}`, 3 + (i % 6), p))
  return db
}

const ctxOf = (db: DB, cons: Ctx['cons'] = { locks: {}, forbid: [], together: [], positions: {} }): Ctx => ({
  s: db.settings,
  model: replay(db),
  byId: new Map(db.players.map((p) => [p.id, p])),
  fmt: db.settings.formats[0],
  cons,
})

function mkMatch(id: string, t: number, a: string[], b: string[], sets: [number, number][]): Match {
  return {
    id, name: id, createdAt: t, format: emptyDB().settings.formats[0], notes: '', events: '', playerRatings: {}, seed: 1, predicted: [],
    teams: [{ name: 'A', playerIds: a }, { name: 'B', playerIds: b }],
    games: [{ a: 0, b: 1, sets }],
  }
}

test('balance é determinístico, equilibrado e separa levantadores', () => {
  const db = setup()
  const ids = db.players.map((p) => p.id)
  const ctx = ctxOf(db)
  const r1 = generate(ids, ctx, 42)
  const r2 = generate(ids, ctx, 42)
  assert.deepEqual(r1, r2)
  const ev = evaluate(r1[0], ctx)
  assert.equal(ev.teams[0].ids.length, 6)
  assert.ok(Math.abs(ev.teams[0].strength - ev.teams[1].strength) < 2, `diff ${ev.teams[0].strength - ev.teams[1].strength}`)
  for (const t of ev.teams) assert.equal(t.posCount.levantador, 1)
})

test('restrições: lock e par proibido respeitados', () => {
  const db = setup()
  const ids = db.players.map((p) => p.id)
  const ctx = ctxOf(db, { locks: { p0: 1, p5: 1 }, forbid: [['p2', 'p3']], together: [['p4', 'p6']], positions: {} })
  for (const board of generate(ids, ctx, 7)) {
    assert.ok(board[1].includes('p0') && board[1].includes('p5'))
    assert.ok(!board.some((t) => t.includes('p2') && t.includes('p3')))
    assert.ok(board.some((t) => t.includes('p4') && t.includes('p6')))
  }
})

test('aprendizado: vencedor sobe, sinergia só vira evidência com repetição, excluir desfaz', () => {
  const db = setup()
  const A = ['p0', 'p2', 'p3', 'p6', 'p7', 'p10']
  const B = ['p1', 'p4', 'p5', 'p8', 'p9', 'p11']
  db.matches = [mkMatch('m1', 1, A, B, [[25, 15], [25, 18]])]
  let m = replay(db)
  assert.ok(m.stats.get('p0')!.offset > 0)
  assert.ok(m.stats.get('p1')!.offset < 0)
  assert.ok(m.stats.get('p0')!.offset <= db.settings.learning.maxDelta)
  assert.equal(m.syn.get('p0|p2')!.evidence, false)

  for (let i = 2; i <= 8; i++) db.matches.push(mkMatch(`m${i}`, i, A, B, [[25, 14], [25, 16]]))
  m = replay(db)
  assert.equal(m.stats.get('p0')!.n, 8)
  assert.equal(m.stats.get('p0')!.wins, 8)
  assert.ok(m.syn.get('p0|p2')!.n === 8)

  db.matches = []
  m = replay(db)
  assert.equal(m.stats.size, 0)
})

test('posições: cada um na principal; excedente cobre vaga obrigatória', () => {
  const db = emptyDB()
  const fmt = db.settings.formats[0]
  const ps = [mkPlayer('lev', 5, 'levantador'), mkPlayer('opo', 9, 'oposto'), mkPlayer('c1', 5, 'central'), mkPlayer('c2', 5, 'central')]
  assert.deepEqual(assign(ps, fmt, db.settings), { lev: 'levantador', opo: 'oposto', c1: 'central', c2: 'central' })
  const noSetter = [mkPlayer('p1', 5, 'ponteiro'), mkPlayer('p2', 5, 'ponteiro'), mkPlayer('p3', 7, 'ponteiro'), { ...mkPlayer('c', 5, 'central'), secondary: ['levantador'] }]
  const out = assign(noSetter, fmt, db.settings)
  assert.equal(Object.values(out).filter((x) => x === 'levantador').length, 1)
  assert.equal(out.p1 === 'levantador' || out.p2 === 'levantador' || out.p3 === 'levantador', true) // central está na cota desejável (2)
})

test('posição fixada: assign respeita e o balanceamento conta como cobertura', () => {
  const db = setup()
  const fmt = db.settings.formats[0]
  // Kiko (p10, oposto) fixado como levantador
  const out = assign([db.players[10], db.players[0], db.players[2]], fmt, db.settings, { p10: 'levantador' })
  assert.equal(out.p10, 'levantador')
  assert.equal(out.p0, 'levantador') // o levantador de ofício continua na dele; fixado não é "puxado"
  const ids = db.players.map((p) => p.id)
  const ctx = ctxOf(db, { locks: {}, forbid: [], together: [], positions: { p10: 'levantador', p11: 'levantador' } })
  for (const board of generate(ids, ctx, 3)) {
    const ev = evaluate(board, ctx)
    for (const t of ev.teams) for (const id of t.ids) if (id === 'p10' || id === 'p11') assert.equal(t.pos[id], 'levantador')
    // 4 "levantadores" agora (2 de ofício + 2 fixados): espalhados 2 e 2
    assert.deepEqual(ev.teams.map((t) => t.posCount.levantador ?? 0), [2, 2])
  }
})
