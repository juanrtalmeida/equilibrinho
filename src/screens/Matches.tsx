import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Clock, NotebookPen, Plus, Star, Trash, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { mutate, useDB, useModel } from '../store.ts'
import { gameTotals, logistic, matchTime } from '../engine/rating.ts'
import type { Match } from '../types.ts'
import { byTimeDesc, fmtDate, matchSummary, pct, pname, posShort, teamBg, type Go } from '../fmt.ts'
import { Confirm, PageTitle, Section } from '../ui.tsx'

export function Matches({ go, id }: { go: Go; id?: string }) {
  const db = useDB()
  const m = id ? db.matches.find((x) => x.id === id) : undefined
  if (m) return <MatchView m={m} go={go} />
  const list = [...db.matches].sort((a, b) => Number(!!a.games.length) - Number(!!b.games.length) || byTimeDesc(a, b))
  return (
    <>
      <PageTitle>Partidas</PageTitle>
      {!list.length && (
        <Section icon={Trophy} title="Nenhuma partida ainda" description="Monte os times e salve a escalação; o placar você anota depois do jogo.">
          <Button size="lg" onClick={() => go({ tab: 'build' })}>Montar times</Button>
        </Section>
      )}
      <ul className="flex flex-col gap-2">
        {list.map((x) => (
          <li key={x.id}>
            <button onClick={() => go({ tab: 'matches', id: x.id })} className={cn('flex min-h-16 w-full items-center gap-3 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 hover:bg-muted/60', !x.games.length && 'ring-primary/40')}>
              {x.games.length ? <Trophy className="size-5 shrink-0 text-muted-foreground" /> : <Clock className="size-5 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{x.name}</span>
                <span className="text-sm text-muted-foreground">{fmtDate(matchTime(x))} · {x.games.length ? matchSummary(x) : `${x.teams.map((t) => t.playerIds.length).join(' × ')} jogadores`}</span>
              </span>
              {!x.games.length && <Badge variant="secondary">anotar placar</Badge>}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function MatchView({ m, go }: { m: Match; go: Go }) {
  const db = useDB()
  const model = useModel()
  const s = db.settings
  const byId = new Map(db.players.map((p) => [p.id, p]))
  const upd = (fn: (x: Match) => void) => mutate((d) => fn(d.matches.find((x) => x.id === m.id)!))
  const ids = m.teams.flatMap((t) => t.playerIds)
  const calib = model.calib.filter((c) => c.matchId === m.id)

  return (
    <>
      <Button variant="ghost" className="-ml-2 self-start" onClick={() => go({ tab: 'matches' })}><ChevronLeft /> Partidas</Button>

      <Section icon={CalendarClock} title={m.name || 'Partida'} description={`${m.format.name} · semente ${m.seed}`}>
        <div className="grid gap-2">
          <Label htmlFor="mn">Nome</Label>
          <Input id="mn" value={m.name} onChange={(e) => upd((x) => void (x.name = e.target.value))} />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div className="grid gap-2">
            <Label htmlFor="md">Data e hora</Label>
            <Input id="md" type="datetime-local" value={m.date ?? ''} onChange={(e) => upd((x) => void (x.date = e.target.value || undefined))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mdu">Duração (min)</Label>
            <Input id="mdu" type="number" min={0} value={m.durationMin ?? ''} onChange={(e) => upd((x) => void (x.durationMin = e.target.value ? +e.target.value : undefined))} />
          </div>
        </div>
      </Section>

      <Section icon={Trophy} title="Placar">
        {m.games.map((g, gi) => {
          const { sa, sb } = gameTotals(g.sets)
          const c = calib.find((x) => x.game === gi)
          return (
            <div key={gi} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                {m.teams.length > 2 ? (
                  (['a', 'b'] as const).map((side) => (
                    <NativeSelect key={side} aria-label={side === 'a' ? 'Time da esquerda' : 'Time da direita'} value={g[side]} onChange={(e) => upd((x) => void (x.games[gi][side] = +e.target.value))}>
                      {m.teams.map((tm, k) => <NativeSelectOption key={k} value={k}>{tm.name}</NativeSelectOption>)}
                    </NativeSelect>
                  ))
                ) : (
                  <span className="font-semibold">{m.teams[g.a]?.name} × {m.teams[g.b]?.name}</span>
                )}
                <span className="ml-auto text-lg font-bold tabular-nums">{sa} × {sb}</span>
                <Confirm
                  trigger={<Button variant="ghost" size="icon" aria-label="Excluir jogo"><Trash /></Button>}
                  title="Excluir este jogo?"
                  description="As estimativas são recalculadas sem ele."
                  action="Excluir"
                  onConfirm={() => upd((x) => void x.games.splice(gi, 1))}
                />
              </div>
              {g.sets.map((st, si) => (
                <div key={si} className="grid grid-cols-[3.5rem_1fr_auto_1fr_auto] items-center gap-2">
                  <span className="text-sm text-muted-foreground">Set {si + 1}</span>
                  {[0, 1].map((k) => (
                    <Input key={k} type="number" inputMode="numeric" min={0} className={cn('h-12 text-center text-xl font-bold tabular-nums', k === 1 && 'col-start-4')}
                      value={st[k]} aria-label={`Pontos ${k ? m.teams[g.b]?.name : m.teams[g.a]?.name} no set ${si + 1}`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => upd((x) => void (x.games[gi].sets[si][k] = Math.max(0, +e.target.value || 0)))} />
                  )).flatMap((el, i) => (i === 0 ? [el, <span key="x" className="text-muted-foreground">×</span>] : [el]))}
                  <Button variant="ghost" size="icon" aria-label={`Remover set ${si + 1}`} onClick={() => upd((x) => void x.games[gi].sets.splice(si, 1))}><X /></Button>
                </div>
              ))}
              <Button variant="outline" className="self-start" onClick={() => upd((x) => void x.games[gi].sets.push([0, 0]))}><Plus /> Set</Button>
              {c && (
                <p className="text-sm text-muted-foreground">
                  O app estimava {pct(c.expected)} para {m.teams[g.a]?.name}; o desempenho foi {pct(c.observed)}.
                </p>
              )}
            </div>
          )
        })}
        <Button size="lg" onClick={() => upd((x) => void x.games.push({ a: 0, b: Math.min(1, x.teams.length - 1), sets: [[0, 0]] }))}>
          <Plus /> Registrar jogo
        </Button>
        {m.teams.length === 2 && m.predicted.length === 2 && (
          <p className="text-sm text-muted-foreground">Previsão ao montar: {m.teams[0].name} {pct(logistic((m.predicted[0] - m.predicted[1]) / s.learning.scale))} (estimativa).</p>
        )}
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        {m.teams.map((t, ti) => (
          <Card key={ti} className="gap-0 py-0">
            <div className={cn('h-1.5', teamBg(ti))} />
            <div className="flex min-h-12 items-center gap-2 px-4">
              <span className={cn('size-3 shrink-0 rounded-full', teamBg(ti))} />
              <Input className="h-10 border-transparent px-1 text-lg font-bold shadow-none" value={t.name} aria-label="Nome do time" onChange={(e) => upd((x) => void (x.teams[ti].name = e.target.value))} />
              {m.predicted[ti] !== undefined && <span className="shrink-0 text-xs text-muted-foreground" title="Força estimada ao salvar">est. {Math.round(m.predicted[ti])}</span>}
            </div>
            <ul className="flex flex-col pb-2">
              {t.playerIds.map((pid) => (
                <li key={pid} className="flex min-h-12 items-center justify-between gap-2 px-4">
                  <span className="truncate">{pname(byId.get(pid))} <span className="text-xs text-muted-foreground">{t.positions?.[pid] ? posShort(s, t.positions[pid]) : ''}</span></span>
                  {m.teams.length > 1 && (
                    <NativeSelect size="sm" aria-label={`Mover ${pname(byId.get(pid))} (substituição/correção)`} value={ti} onChange={(e) => upd((x) => {
                      x.teams[ti].playerIds = x.teams[ti].playerIds.filter((y) => y !== pid)
                      x.teams[+e.target.value].playerIds.push(pid)
                      // composição mudou: posições voltam a ser calculadas
                      x.teams.forEach((tm) => delete tm.positions)
                    })}>
                      {m.teams.map((tm, k) => <NativeSelectOption key={k} value={k}>{tm.name}</NativeSelectOption>)}
                    </NativeSelect>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Section icon={NotebookPen} title="Anotações">
        <div className="grid gap-2">
          <Label htmlFor="mnotes">Como foi o jogo</Label>
          <Textarea id="mnotes" rows={2} value={m.notes} onChange={(e) => upd((x) => void (x.notes = e.target.value))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mev">Ocorrências (trocas, lesões…)</Label>
          <Textarea id="mev" rows={2} value={m.events} onChange={(e) => upd((x) => void (x.events = e.target.value))} />
        </div>
      </Section>

      <Collapsible>
        <Card className="py-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-14 w-full justify-between rounded-xl px-4 text-base font-semibold">
              <span className="flex items-center gap-2"><Star className="size-4.5 text-primary" /> Notas individuais <span className="text-sm font-normal text-muted-foreground">opcional</span></span>
              <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <p className="mb-2 text-sm text-muted-foreground">Nota de 1 a 10 para a atuação. Influencia levemente a estimativa; deixe vazio se não souber.</p>
            <ul className="divide-y">
              {ids.map((pid) => (
                <li key={pid} className="flex min-h-12 items-center justify-between">
                  <span>{pname(byId.get(pid))}</span>
                  <NativeSelect aria-label={`Nota de ${pname(byId.get(pid))}`} value={m.playerRatings[pid] ?? ''} onChange={(e) => upd((x) => {
                    if (e.target.value) x.playerRatings[pid] = +e.target.value
                    else delete x.playerRatings[pid]
                  })}>
                    <NativeSelectOption value="">—</NativeSelectOption>
                    {Array.from({ length: 10 }, (_, i) => <NativeSelectOption key={i} value={i + 1}>{i + 1}</NativeSelectOption>)}
                  </NativeSelect>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Confirm
        trigger={<Button variant="destructive" className="self-start"><Trash /> Excluir partida</Button>}
        title="Excluir esta partida?"
        description="Estatísticas e estimativas serão recalculadas sem ela."
        action="Excluir"
        onConfirm={() => {
          mutate((d) => void (d.matches = d.matches.filter((x) => x.id !== m.id)))
          go({ tab: 'matches' })
        }}
      />
    </>
  )
}
