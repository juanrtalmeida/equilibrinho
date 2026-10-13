import { useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, Trash, TrendingUp, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { addPlayer, mutate, useDB, useModel } from '../store.ts'
import { SCALE } from '../defaults.ts'
import { matchTime, sigmaOf, skillScore } from '../engine/rating.ts'
import type { Player } from '../types.ts'
import { fmtDate, matchSummary, n1, pct, plural, pname, posName, posShort, type Go } from '../fmt.ts'
import { Confidence, Confirm, PageTitle, Section, Sparkline, Stat } from '../ui.tsx'

const initials = (p: Player) => (p.nick || p.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

export function Players({ go, id }: { go: Go; id?: string }) {
  const db = useDB()
  const model = useModel()
  const [q, setQ] = useState('')
  const p = id ? db.players.find((x) => x.id === id) : undefined
  if (p) return <PlayerEdit p={p} go={go} />

  const s = db.settings
  const list = db.players
    .filter((x) => `${x.name} ${x.nick ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const available = db.players.filter((x) => x.available).length

  return (
    <>
      <PageTitle action={<Button onClick={() => go({ tab: 'players', id: addPlayer() })}><Plus /> Novo</Button>}>Jogadores</PageTitle>
      {db.players.length > 0 && (
        <p className="-mt-2 text-sm text-muted-foreground">{plural(db.players.length, 'perfil', 'perfis')} · {available} disponíveis</p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="pl-9" placeholder="Buscar por nome ou apelido" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!db.players.length && (
        <Section icon={Users} title="Ninguém por aqui ainda" description="Cada perfil é cadastrado uma vez e reaproveitado em todas as partidas." />
      )}
      <ul className="flex flex-col gap-2">
        {list.map((x) => {
          const st = model.stats.get(x.id)
          const str = skillScore(x, x.primary, s) + (st?.offset ?? 0)
          return (
            <li key={x.id} className="flex items-center gap-1 rounded-xl bg-card pr-1 ring-1 ring-foreground/10">
              <button className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left hover:bg-muted/60" onClick={() => go({ tab: 'players', id: x.id })}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">{initials(x)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {x.name || '(sem nome)'}
                    {x.nick && <span className="font-normal text-muted-foreground"> “{x.nick}”</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                    <Badge variant="outline">{posName(s, x.primary)}</Badge>
                    {x.secondary.map((y) => <Badge key={y} variant="ghost" className="px-1">{posShort(s, y)}</Badge>)}
                    <span>· força {Math.round(str)} · {st ? plural(st.n, 'jogo') : 'novo'}</span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <label className="flex min-h-16 cursor-pointer items-center px-2" title="Disponível para jogar">
                <Switch
                  checked={x.available}
                  aria-label={`${pname(x)} disponível para jogar`}
                  onCheckedChange={(v) => mutate((d) => void (d.players.find((y) => y.id === x.id)!.available = v))}
                />
              </label>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PlayerEdit({ p, go }: { p: Player; go: Go }) {
  const db = useDB()
  const model = useModel()
  const s = db.settings
  const st = model.stats.get(p.id)
  const upd = (fn: (x: Player) => void) => mutate((d) => fn(d.players.find((x) => x.id === p.id)!))
  const base = skillScore(p, p.primary, s)
  const avg = s.attributes.length ? s.attributes.reduce((a, at) => a + (p.skills[at.id] ?? 5), 0) / s.attributes.length : 5
  const conf = st ? st.n / (st.n + s.learning.priorN) : 0
  const syns = [...model.syn.values()]
    .filter((y) => (y.a === p.id || y.b === p.id) && y.n > 0)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 5)
  const matches = db.matches.filter((m) => m.teams.some((t) => t.playerIds.includes(p.id))).sort((a, b) => matchTime(b) - matchTime(a))

  return (
    <>
      <Button variant="ghost" className="-ml-2 self-start" onClick={() => go({ tab: 'players' })}><ChevronLeft /> Jogadores</Button>

      <Section icon={UserRound} title={p.name || 'Novo jogador'}>
        <div className="grid gap-2">
          <Label htmlFor="pname">Nome</Label>
          <Input id="pname" value={p.name} autoFocus={!p.name} onChange={(e) => upd((x) => void (x.name = e.target.value))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pnick">Apelido (opcional)</Label>
          <Input id="pnick" value={p.nick ?? ''} onChange={(e) => upd((x) => void (x.nick = e.target.value))} />
        </div>
        <Label className="flex min-h-11 items-center justify-between rounded-lg border px-3">
          Disponível para jogar
          <Switch checked={p.available} onCheckedChange={(v) => upd((x) => void (x.available = v))} />
        </Label>
        <div className="grid gap-2">
          <Label htmlFor="ppos">Posição principal</Label>
          <NativeSelect id="ppos" className="w-full" value={p.primary} onChange={(e) => upd((x) => {
            x.primary = e.target.value
            x.secondary = x.secondary.filter((y) => y !== e.target.value)
          })}>
            {s.positions.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label>Também joga de</Label>
          <ToggleGroup type="multiple" variant="outline" className="flex-wrap" value={p.secondary} onValueChange={(v) => upd((x) => void (x.secondary = v))}>
            {s.positions.filter((x) => x.id !== p.primary).map((x) => (
              <ToggleGroupItem key={x.id} value={x.id} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{x.name}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pnotes">Observações</Label>
          <Textarea id="pnotes" rows={2} value={p.notes} onChange={(e) => upd((x) => void (x.notes = e.target.value))} />
        </div>
      </Section>

      <Section icon={SlidersHorizontal} title="Avaliação inicial" description="Chute inicial de 1 a 10. O app ajusta aos poucos com os resultados reais." action={<Badge variant="secondary">nível {n1(avg)}</Badge>}>
        <div className="grid gap-3 rounded-lg bg-muted/60 p-3">
          <Label className="justify-between">Nível geral <span className="text-xs font-normal text-muted-foreground">aplica a todos</span></Label>
          <Slider min={1} max={10} step={1} value={[Math.round(avg)]} onValueChange={([v]) => upd((x) => {
            for (const a of s.attributes) x.skills[a.id] = v
          })} aria-label="Nível geral" />
        </div>
        {s.attributes.map((a) => {
          const v = p.skills[a.id] ?? 5
          return (
            <div key={a.id} className="grid gap-2 py-1">
              <div className="flex items-baseline justify-between">
                <Label>{a.name}</Label>
                <span className="text-lg font-bold tabular-nums">{v}</span>
              </div>
              <Slider min={1} max={10} step={1} value={[v]} onValueChange={([nv]) => upd((x) => void (x.skills[a.id] = nv))} aria-label={a.name} />
              <p className="text-xs text-muted-foreground">{SCALE[v]}{a.desc ? ` — ${a.desc}` : ''}</p>
            </div>
          )
        })}
      </Section>

      <Section icon={TrendingUp} title="Estimativa atual" action={<Confidence value={conf} n={st?.n ?? 0} />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={Math.round(base)} label="força manual" />
          <Stat value={st ? (st.offset >= 0 ? '+' : '') + n1(st.offset) : '0'} label="ajuste aprendido" />
          <Stat value={`±${Math.round(sigmaOf(st?.n ?? 0, s.learning.priorN))}`} label="incerteza" />
        </div>
        {st && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <b>{st.wins}V · {st.losses}D</b> · aproveitamento {st.n ? pct(st.wins / st.n) : '—'}
              <span className="block text-muted-foreground">Time esperado {st.n ? pct(st.expSum / st.n) : '—'} × observado {st.n ? pct(st.obsSum / st.n) : '—'}</span>
            </span>
            <Sparkline values={[base, ...st.history.map((h) => h.v)]} />
          </div>
        )}
        {syns.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Parcerias</h3>
            <ul className="divide-y">
              {syns.map((y) => {
                const other = db.players.find((x) => x.id === (y.a === p.id ? y.b : y.a))
                return (
                  <li key={y.a + y.b} className="flex min-h-10 items-center justify-between text-sm">
                    <span>{pname(other)}</span>
                    <span className="text-muted-foreground">{plural(y.n, 'jogo')} juntos · {y.evidence ? <b className={y.v > 0 ? 'text-ok' : 'text-destructive'}>{y.v > 0 ? '+' : ''}{n1(y.v)}</b> : 'sem conclusão'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Section>

      {matches.length > 0 && (
        <Section icon={CalendarClock} title="Histórico">
          <ul className="-mx-2 flex flex-col">
            {matches.map((m) => (
              <li key={m.id}>
                <button onClick={() => go({ tab: 'matches', id: m.id })} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-muted">
                  <span>{fmtDate(matchTime(m))} · {m.name}</span>
                  <span className="text-muted-foreground">{matchSummary(m)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Confirm
        trigger={<Button variant="destructive" className="self-start"><Trash /> Excluir jogador</Button>}
        title={`Excluir ${p.name || 'jogador'}?`}
        description="Partidas antigas mantêm o registro como “(removido)”. Para só tirar da lista de hoje, desligue “Disponível”."
        action="Excluir"
        onConfirm={() => {
          mutate((d) => {
            d.players = d.players.filter((x) => x.id !== p.id)
            d.groups.forEach((g) => (g.playerIds = g.playerIds.filter((x) => x !== p.id)))
          })
          go({ tab: 'players' })
        }}
      />
    </>
  )
}
