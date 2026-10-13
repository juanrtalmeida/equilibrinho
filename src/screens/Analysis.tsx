import { ChartColumn, HeartHandshake, Scale, Shirt, Users } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDB, useModel } from '../store.ts'
import { sigmaOf, skillScore } from '../engine/rating.ts'
import { n1, pct, plural, pname, posName, posShort, type Go } from '../fmt.ts'
import { Confidence, PageTitle, Section, Sparkline, Stat } from '../ui.tsx'

export function Analysis({ go }: { go: Go }) {
  const db = useDB()
  const model = useModel()
  const s = db.settings
  const byId = new Map(db.players.map((p) => [p.id, p]))
  const rows = db.players
    .map((p) => {
      const st = model.stats.get(p.id)
      const base = skillScore(p, p.primary, s)
      return { p, st, base, now: base + (st?.offset ?? 0) }
    })
    .sort((a, b) => b.now - a.now)
  const syns = [...model.syn.values()]
  const evidence = syns.filter((y) => y.evidence).sort((a, b) => b.v - a.v)
  const freq = [...syns].sort((a, b) => b.n - a.n).slice(0, 10)
  const decided = model.calib.filter((c) => c.favoriteWon !== null)
  const err = model.calib.length ? model.calib.reduce((a, c) => a + Math.abs(c.expected - c.observed), 0) / model.calib.length : 0
  const balance = model.calib.length ? model.calib.reduce((a, c) => a + Math.abs(c.observed - 0.5), 0) / model.calib.length : 0
  const byPos: Record<string, { n: number; w: number }> = {}
  for (const st of model.stats.values())
    for (const [k, v] of Object.entries(st.byPos)) {
      const x = (byPos[k] ??= { n: 0, w: 0 })
      x.n += v.n
      x.w += v.w
    }

  if (!model.calib.length)
    return (
      <>
        <PageTitle>Análises</PageTitle>
        <Section icon={ChartColumn} title="Ainda sem jogos" description="As análises aparecem conforme você anota placares em Partidas. Quanto mais jogos, mais o app aprende." />
      </>
    )

  return (
    <>
      <PageTitle>Análises</PageTitle>

      <Section icon={Scale} title="Equilíbrio das partidas" description="Resultados dos times comparados com o que o app estimava.">
        <div className="grid grid-cols-3 gap-2">
          <Stat value={model.calib.length} label="jogos" />
          <Stat value={decided.length ? pct(decided.filter((c) => c.favoriteWon).length / decided.length) : '—'} label="favorito venceu" />
          <Stat value={pct(err)} label="erro médio" />
        </div>
        <p className="text-sm">
          Desequilíbrio médio: <b>{pct(balance)}</b> (0% = jogos totalmente parelhos).
          {decided.length < 10 && <span className="text-muted-foreground"> Poucos jogos: números ainda instáveis.</span>}
        </p>
      </Section>

      <Section icon={Users} title="Jogadores" description="Força = avaliação manual + ajuste aprendido (estimativa). V-D = resultado do time.">
        <div className="-mx-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Jogador</TableHead><TableHead>J</TableHead><TableHead>V-D</TableHead><TableHead>Força</TableHead>
                <TableHead>Esp.×Obs.</TableHead><TableHead>Posições</TableHead><TableHead className="pr-4">Evolução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ p, st, base, now }) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => go({ tab: 'players', id: p.id })}>
                  <TableCell className="pl-4 font-medium">{pname(p)}</TableCell>
                  <TableCell className="tabular-nums">{st?.n ?? 0}</TableCell>
                  <TableCell className="tabular-nums">{st ? `${st.wins}-${st.losses}` : '—'}</TableCell>
                  <TableCell className="tabular-nums">{Math.round(now)} <span className="text-xs text-muted-foreground">±{Math.round(sigmaOf(st?.n ?? 0, s.learning.priorN))}</span></TableCell>
                  <TableCell className="text-xs tabular-nums">{st?.n ? `${pct(st.expSum / st.n)} × ${pct(st.obsSum / st.n)}` : '—'}</TableCell>
                  <TableCell className="text-xs">{st ? Object.entries(st.byPos).map(([k, v]) => `${posShort(s, k)} ${v.w}/${v.n}`).join(' ') : '—'}</TableCell>
                  <TableCell className="pr-4"><Sparkline values={[base, ...(st?.history.map((h) => h.v) ?? [])]} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section icon={HeartHandshake} title="Sinergias" description={`Duplas que rendem acima ou abaixo do esperado. Só aparecem com evidência consistente (${plural(syns.length - evidence.length, 'dupla', 'duplas')} ainda sem dados suficientes).`}>
        {!evidence.length && <p className="text-sm text-muted-foreground">Nenhuma sinergia confirmada ainda. Continue anotando os placares.</p>}
        <ul className="divide-y">
          {evidence.map((y) => (
            <li key={y.a + y.b} className="flex min-h-12 flex-wrap items-center justify-between gap-2">
              <span>{pname(byId.get(y.a))} + {pname(byId.get(y.b))}</span>
              <span className="flex items-center gap-2">
                <b className={y.v > 0 ? 'text-ok' : 'text-destructive'}>{y.v > 0 ? '+' : ''}{n1(y.v)}</b>
                <Confidence value={y.conf} n={y.n} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Users} title="Quem mais joga junto">
        <ul className="divide-y">
          {freq.map((y) => (
            <li key={y.a + y.b} className="flex min-h-11 items-center justify-between text-sm">
              <span>{pname(byId.get(y.a))} + {pname(byId.get(y.b))}</span>
              <span className="text-muted-foreground">{plural(y.n, 'jogo')} · {y.evidence ? `${y.v > 0 ? '+' : ''}${n1(y.v)}` : 'sem conclusão'}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Shirt} title="Desempenho por posição">
        <ul className="divide-y">
          {Object.entries(byPos).map(([k, v]) => (
            <li key={k} className="flex min-h-11 items-center justify-between text-sm">
              <span>{posName(s, k)}</span>
              <span className="text-muted-foreground">{plural(v.n, 'atuação', 'atuações')} · {pct(v.w / v.n)} vitórias</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
