import { useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeftRight, BookmarkPlus, Check, ChevronDown, Eraser, Info, Link2, Link2Off, ListRestart, Lock, LockOpen,
  Pencil, Pin, Presentation, Save, Scale, Search, Shuffle, Trash, TriangleAlert, UserCheck, UserPlus, Users, UsersRound, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { addPlayer, mutate, mutateDraft, uid, useDB, useDraft, useModel } from '../store.ts'
import { evaluate, generate, type Ctx, type Eval } from '../engine/balance.ts'
import { canPlay, logistic, playerStrength, skillScore } from '../engine/rating.ts'
import type { Draft, Format, Match, Player } from '../types.ts'
import { byTimeDesc, longDate, n1, pct, plural, pname, posName, posShort, teamBg, teamLetter, teamText, type Go } from '../fmt.ts'
import { Confidence, Confirm, PageTitle, Section, ShareTeams } from '../ui.tsx'

const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[0.95rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function Build({ go }: { go: Go }) {
  const db = useDB()
  const model = useModel()
  const draft = useDraft()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [quick, setQuick] = useState({ name: '', pos: db.settings.positions[0]?.id ?? '', level: 5 })
  const [pair, setPair] = useState(['', ''])
  const [fixP, setFixP] = useState(['', ''])
  const [groupName, setGroupName] = useState('')
  const s = db.settings
  const byId = new Map(db.players.map((p) => [p.id, p]))
  const set = (fn: (d: Draft) => void) => mutateDraft(fn)

  const baseFmt = s.formats.find((f) => f.id === draft.formatId) ?? s.formats[0]
  const fmt = { ...baseFmt, teams: draft.teams }
  const participants = draft.participants.filter((id) => byId.has(id))
  const inSet = new Set(participants)
  const ctx: Ctx = { s, model, byId, fmt, cons: draft.constraints }
  const board = draft.board?.map((t) => t.filter((id) => inSet.has(id))) ?? null
  const onBoard = new Set(board?.flat())
  const bench = participants.filter((id) => !onBoard.has(id))
  const ev = board ? evaluate(board, ctx) : null
  const showSetup = !board || editing

  const toggle = (id: string) =>
    set((d) => {
      d.participants = d.participants.includes(id) ? d.participants.filter((x) => x !== id) : [...d.participants, id]
    })
  const run = (seed: number) => {
    const prev = { board: draft.board, options: draft.options, seed: draft.seed }
    set((d) => {
      d.seed = seed
      d.options = generate(participants, ctx, seed)
      d.board = d.options[0] ?? null
    })
    setSel(null)
    setEditing(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // ajustes manuais nunca se perdem sem volta
    if (prev.board) toast('Novos times sorteados', { action: { label: 'Desfazer', onClick: () => set((d) => Object.assign(d, prev)) } })
  }
  const teamIdx = (id: string) => board?.findIndex((t) => t.includes(id)) ?? -1
  const moveTo = (id: string, ti: number) =>
    set((d) => {
      if (!d.board) return
      d.board = d.board.map((t) => t.filter((x) => x !== id))
      d.board[ti].push(id)
      if (d.constraints.locks[id] !== undefined) d.constraints.locks[id] = ti
    })
  const tapPlayer = (id: string) => {
    if (!sel || sel === id) return setSel(sel === id ? null : id)
    const a = teamIdx(sel)
    const b = teamIdx(id)
    if (a >= 0 && b >= 0 && a !== b) {
      set((d) => {
        const bd = d.board!
        bd[a] = bd[a].map((x) => (x === sel ? id : x))
        bd[b] = bd[b].map((x) => (x === id ? sel : x))
        for (const [x, t] of [[sel, b], [id, a]] as const) if (d.constraints.locks[x] !== undefined) d.constraints.locks[x] = t
      })
      setSel(null)
    } else if (a < 0 && b >= 0) {
      moveTo(sel, b)
      setSel(null)
    } else setSel(id)
  }

  const lastMatch = [...db.matches].sort(byTimeDesc)[0]
  const list = db.players
    .filter((p) => `${p.name} ${p.nick ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, 'pt-BR'))
  const sizes = Array.from({ length: fmt.teams }, (_, i) => Math.floor(participants.length / fmt.teams) + (i < participants.length % fmt.teams ? 1 : 0))
  const strengthOf = (p: Player) => Math.round(skillScore(p, p.primary, s) + (model.stats.get(p.id)?.offset ?? 0))

  const save = () => {
    if (!board || !ev) return
    const m = newMatch(draft, fmt, board, ev)
    mutate((d) => void d.matches.push(m))
    set((d) => {
      d.board = null
      d.options = []
      d.name = ''
      d.date = ''
    })
    toast.success('Partida salva! Depois do jogo, anote o placar.')
    go({ tab: 'matches', id: m.id })
  }

  return (
    <>
      <PageTitle>Montar times</PageTitle>

      {!showSetup && (
        <div className="-mt-2 flex items-center justify-between gap-2 rounded-xl bg-muted/70 py-1 pr-1 pl-3 text-sm">
          <span className="text-muted-foreground">
            <b className="text-foreground">{plural(participants.length, 'jogador', 'jogadores')}</b> · {baseFmt.name} · {fmt.teams} times
          </span>
          <Button variant="ghost" onClick={() => setEditing(true)}><Pencil /> Editar</Button>
        </div>
      )}

      {showSetup && (
        <>
          <Section icon={Users} title="Quem vai jogar" action={<Badge variant={participants.length ? 'default' : 'secondary'} className="h-6 px-2.5 text-sm">{participants.length} de {fmt.teams * fmt.perTeam}</Badge>}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => set((d) => void (d.participants = db.players.filter((p) => p.available).map((p) => p.id)))}>
                <UserCheck /> Disponíveis
              </Button>
              {lastMatch && (
                <Button variant="outline" onClick={() => set((d) => void (d.participants = lastMatch.teams.flatMap((t) => t.playerIds).filter((id) => byId.has(id))))}>
                  <ListRestart /> Repetir última
                </Button>
              )}
              {db.groups.map((g) => (
                <Button key={g.id} variant="outline" onClick={() => set((d) => void (d.participants = [...new Set([...d.participants, ...g.playerIds.filter((id) => byId.has(id))])]))}>
                  <UsersRound /> {g.name} <span className="text-muted-foreground">{g.playerIds.length}</span>
                </Button>
              ))}
              <Dialog onOpenChange={(o) => o && setGroupName('')}>
                <DialogTrigger asChild>
                  <Button variant="outline"><BookmarkPlus /> Turmas</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Turmas</DialogTitle>
                    <DialogDescription>Salve a lista atual para marcar todo mundo com um toque da próxima vez.</DialogDescription>
                  </DialogHeader>
                  <form className="flex gap-2" onSubmit={(e) => {
                    e.preventDefault()
                    if (!groupName.trim() || !participants.length) return
                    mutate((d) => void d.groups.push({ id: uid(), name: groupName.trim(), playerIds: participants }))
                    toast.success(`Turma “${groupName.trim()}” salva com ${plural(participants.length, 'jogador', 'jogadores')}`)
                    setGroupName('')
                  }}>
                    <Input placeholder="Ex.: Vôlei de quinta" value={groupName} onChange={(e) => setGroupName(e.target.value)} aria-label="Nome da turma" />
                    <Button disabled={!groupName.trim() || !participants.length}><Save /> Salvar</Button>
                  </form>
                  {!participants.length && <p className="text-xs text-muted-foreground">Selecione os jogadores antes de salvar uma turma.</p>}
                  {db.groups.length > 0 && (
                    <ul className="divide-y">
                      {db.groups.map((g) => (
                        <li key={g.id} className="flex min-h-12 items-center justify-between">
                          <span>{g.name} <span className="text-muted-foreground">· {plural(g.playerIds.length, 'jogador', 'jogadores')}</span></span>
                          <Confirm
                            trigger={<Button variant="ghost" size="icon" aria-label={`Excluir turma ${g.name}`}><Trash /></Button>}
                            title={`Excluir a turma “${g.name}”?`}
                            description="Os jogadores continuam cadastrados."
                            action="Excluir"
                            onConfirm={() => mutate((d) => void (d.groups = d.groups.filter((x) => x.id !== g.id)))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </DialogContent>
              </Dialog>
              {participants.length > 0 && (
                <Button variant="ghost" onClick={() => set((d) => void (d.participants = []))}><Eraser /> Limpar</Button>
              )}
            </div>

            {db.players.length > 8 && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" className="pl-9" placeholder="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}

            {db.players.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {list.map((p) => {
                  const on = inSet.has(p.id)
                  return (
                    <button
                      key={p.id}
                      aria-pressed={on}
                      onClick={() => toggle(p.id)}
                      className={cn(chip, on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted', !p.available && !on && 'opacity-60')}
                    >
                      {on && <Check className="size-4" />}
                      {pname(p)}
                      <span className={cn('text-xs', on ? 'text-primary-foreground/90' : 'text-muted-foreground')}>{posShort(s, p.primary)} {strengthOf(p)}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ninguém cadastrado ainda. Use o cadastro rápido abaixo.</p>
            )}

            <Collapsible defaultOpen={!db.players.length} className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="group w-full justify-between">
                  <span className="flex items-center gap-2"><UserPlus /> Cadastro rápido</span>
                  <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(e) => {
                  e.preventDefault()
                  if (!quick.name.trim()) return
                  const id = addPlayer(quick.name.trim(), quick.pos, quick.level)
                  set((d) => void d.participants.push(id))
                  setQuick({ ...quick, name: '' })
                }}>
                  <Input placeholder="Nome" aria-label="Nome" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
                  <NativeSelect aria-label="Posição" className="w-full" value={quick.pos} onChange={(e) => setQuick({ ...quick, pos: e.target.value })}>
                    {s.positions.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.name}</NativeSelectOption>)}
                  </NativeSelect>
                  <Label className="gap-2 whitespace-nowrap">Nível
                    <Input type="number" className="w-20" min={1} max={10} value={quick.level} onChange={(e) => setQuick({ ...quick, level: Math.max(1, Math.min(10, +e.target.value || 5)) })} />
                  </Label>
                  <Button disabled={!quick.name.trim()}><UserPlus /> Adicionar</Button>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">Cria o perfil completo e já marca como presente. Detalhe as habilidades depois em Jogadores.</p>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          <Section icon={Scale} title="Formato" description={
            <>
              {participants.length > 0 && <>Times de {[...new Set(sizes)].join(' e ')} (ideal {fmt.perTeam}). </>}
              {Object.keys(fmt.required).length > 0 && `Precisa de ${Object.entries(fmt.required).map(([k, v]) => `${v} ${posName(s, k).toLowerCase()}`).join(', ')} por time.`}
            </>
          }>
            <ToggleGroup type="single" variant="outline" className="flex-wrap" value={draft.formatId} onValueChange={(v) => v && set((d) => {
              d.formatId = v
              d.teams = s.formats.find((f) => f.id === v)?.teams ?? 2
              d.board = null
              d.options = []
            })}>
              {s.formats.map((f) => <ToggleGroupItem key={f.id} value={f.id} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{f.name}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="flex items-center gap-3">
              <Label>Times</Label>
              <ToggleGroup type="single" variant="outline" value={String(draft.teams)} onValueChange={(v) => v && set((d) => {
                d.teams = +v
                d.board = null
                d.options = []
              })}>
                {[2, 3, 4].map((n) => <ToggleGroupItem key={n} value={String(n)} className="w-12 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{n}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
          </Section>

          <Collapsible defaultOpen={draft.constraints.forbid.length + draft.constraints.together.length + Object.keys(draft.constraints.positions).length > 0}>
            <Card className="py-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="group h-14 w-full justify-between rounded-xl px-4 text-base font-semibold">
                  <span className="flex items-center gap-2"><Link2 className="size-4.5 text-primary" /> Restrições <span className="text-sm font-normal text-muted-foreground">opcional</span></span>
                  <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-3 px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((k) => (
                    <NativeSelect key={k} className="w-full" aria-label={`Jogador ${k + 1}`} value={pair[k]} onChange={(e) => setPair(k ? [pair[0], e.target.value] : [e.target.value, pair[1]])}>
                      <NativeSelectOption value="">jogador…</NativeSelectOption>
                      {participants.map((id) => <NativeSelectOption key={id} value={id}>{pname(byId.get(id))}</NativeSelectOption>)}
                    </NativeSelect>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['forbid', 'together'] as const).map((kind) => (
                    <Button key={kind} variant="outline" disabled={!pair[0] || !pair[1] || pair[0] === pair[1]} onClick={() => {
                      set((d) => void d.constraints[kind].push([pair[0], pair[1]]))
                      setPair(['', ''])
                    }}>{kind === 'forbid' ? <><Link2Off /> Separar</> : <><Link2 /> Juntar</>}</Button>
                  ))}
                </div>
                <ul className="divide-y">
                  {(['forbid', 'together'] as const).flatMap((kind) =>
                    draft.constraints[kind].map(([a, b], i) => (
                      <li key={kind + i} className="flex min-h-11 items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {kind === 'forbid' ? <Link2Off className="size-4 text-muted-foreground" /> : <Link2 className="size-4 text-muted-foreground" />}
                          {pname(byId.get(a))} e {pname(byId.get(b))} {kind === 'forbid' ? 'separados' : 'juntos'}
                        </span>
                        <Button variant="ghost" size="icon" aria-label="Remover restrição" onClick={() => set((d) => void d.constraints[kind].splice(i, 1))}><X /></Button>
                      </li>
                    )),
                  )}
                </ul>
                <div className="grid gap-2 border-t pt-3">
                  <Label className="flex items-center gap-2"><Pin className="size-4 text-primary" /> Posição fixa nesta montagem</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <NativeSelect className="w-full" aria-label="Jogador" value={fixP[0]} onChange={(e) => setFixP([e.target.value, fixP[1]])}>
                      <NativeSelectOption value="">jogador…</NativeSelectOption>
                      {participants.map((id) => <NativeSelectOption key={id} value={id}>{pname(byId.get(id))}</NativeSelectOption>)}
                    </NativeSelect>
                    <NativeSelect className="w-full" aria-label="Posição" value={fixP[1]} onChange={(e) => setFixP([fixP[0], e.target.value])}>
                      <NativeSelectOption value="">posição…</NativeSelectOption>
                      {s.positions.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.name}</NativeSelectOption>)}
                    </NativeSelect>
                  </div>
                  <Button variant="outline" disabled={!fixP[0] || !fixP[1]} onClick={() => {
                    set((d) => void (d.constraints.positions[fixP[0]] = fixP[1]))
                    setFixP(['', ''])
                  }}><Pin /> Fixar posição</Button>
                  <ul className="divide-y">
                    {Object.entries(draft.constraints.positions).filter(([id]) => inSet.has(id)).map(([id, pos]) => (
                      <li key={id} className="flex min-h-11 items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><Pin className="size-4 text-muted-foreground" />{pname(byId.get(id))} joga de {posName(s, pos).toLowerCase()}</span>
                        <Button variant="ghost" size="icon" aria-label="Remover posição fixa" onClick={() => set((d) => void delete d.constraints.positions[id])}><X /></Button>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">Depois de gerar, dá para fixar alguém num time pelo cadeado e trocar a posição tocando na etiqueta (LEV, PON…).</p>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {board && ev && (
        <>
          <BalanceCard ev={ev} scale={s.learning.scale} />

          {draft.options.length > 1 && (
            <ToggleGroup type="single" variant="outline" className="w-full" value={String(draft.options.findIndex((o) => JSON.stringify(o.map((t) => t.filter((id) => inSet.has(id)))) === JSON.stringify(board)))}
              onValueChange={(v) => v && set((d) => void (d.board = d.options[+v].map((t) => [...t])))}>
              {draft.options.map((o, i) => (
                <ToggleGroupItem key={i} value={String(i)} className="flex-1 flex-col gap-0 leading-tight data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <span>Opção {i + 1}</span>
                  <span className="text-xs opacity-80">{score(evaluate(o, ctx), s.learning.scale)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeftRight className="size-4 shrink-0" />
            <span>{sel ? <>Agora toque em alguém do outro time para trocar com <b className="text-foreground">{pname(byId.get(sel))}</b>, ou em “Mover aqui”.</> : 'Toque em um jogador e depois em outro de outro time para trocar.'}</span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {board.map((ids, ti) => {
              const te = ev.teams[ti]
              const canMoveHere = sel && teamIdx(sel) !== ti
              return (
                <Card key={ti} className="gap-0 py-0">
                  <div className={cn('h-1.5', teamBg(ti))} />
                  <div className="flex min-h-14 items-center justify-between gap-2 px-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <span className={cn('size-3 rounded-full', teamBg(ti))} />
                      Time {teamLetter(ti)}
                    </h2>
                    {canMoveHere ? (
                      <Button size="sm" onClick={() => { moveTo(sel, ti); setSel(null) }}>Mover aqui</Button>
                    ) : (
                      <span className="text-sm text-muted-foreground tabular-nums" title="Força estimada ± incerteza">
                        força <b className="text-base text-foreground">{n1(te.strength)}</b> ±{n1(te.sigma)}
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col pb-2">
                    {ids.map((id) => {
                      const p = byId.get(id)!
                      const pos = te.pos[id]
                      const off = !canPlay(p, pos)
                      const locked = draft.constraints.locks[id] === ti
                      return (
                        <li key={id} className={cn('flex items-center gap-1 px-2', sel === id && 'bg-accent')}>
                          <button className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => tapPlayer(id)} aria-pressed={sel === id}>
                            <span className="truncate font-medium">{pname(p)}</span>
                            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{Math.round(playerStrength(p, pos, s, model))}</span>
                          </button>
                          <PosPicker name={pname(p)} pos={pos} off={off} fixed={draft.constraints.positions[id]} s={s}
                            onChange={(v) => set((d) => {
                              if (v) d.constraints.positions[id] = v
                              else delete d.constraints.positions[id]
                            })} />
                          <Toggle size="default" pressed={locked} aria-label={locked ? `Destravar ${pname(p)}` : `Fixar ${pname(p)} no Time ${teamLetter(ti)}`}
                            className="data-[state=on]:bg-transparent data-[state=on]:text-primary" onPressedChange={(on) => set((d) => {
                              if (on) d.constraints.locks[id] = ti
                              else delete d.constraints.locks[id]
                            })}>
                            {locked ? <Lock /> : <LockOpen className="opacity-40" />}
                          </Toggle>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              )
            })}
          </div>

          {bench.length > 0 && (
            <Section icon={TriangleAlert} title="Fora dos times" description="Toque no jogador e depois em “Mover aqui” no time certo.">
              <div className="flex flex-wrap gap-2">
                {bench.map((id) => (
                  <button key={id} aria-pressed={sel === id} className={cn(chip, sel === id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')} onClick={() => setSel(sel === id ? null : id)}>
                    {pname(byId.get(id))}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Explain ev={ev} ctx={ctx} seed={draft.seed} onSeed={(v) => set((d) => void (d.seed = v))} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3">
          {board && bench.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-destructive"><TriangleAlert className="size-4" /> {plural(bench.length, 'jogador', 'jogadores')} fora dos times — coloque num time para salvar.</p>
          )}
          {!board && participants.length < fmt.teams && (
            <p className="text-center text-sm text-muted-foreground">Marque pelo menos {fmt.teams} jogadores para sortear.</p>
          )}
          <div className="flex gap-2">
            {board ? (
              <>
                <Button variant="outline" size="lg" onClick={() => run(draft.seed + 1)} aria-label="Sortear outra combinação"><Shuffle /> <span className="max-sm:sr-only">Sortear outra</span></Button>
                <Present board={board} ev={ev!} byId={byId} s={s} title={draft.name.trim() || 'Times de hoje'} subtitle={`${longDate(draft.date)} · ${baseFmt.name}`} />
                <SaveDialog draft={draft} disabled={bench.length > 0} onSave={save} />
              </>
            ) : (
              <Button size="lg" className="h-14 flex-1 text-lg" disabled={participants.length < fmt.teams} onClick={() => run(draft.seed)}>
                <Shuffle className="size-5" /> Gerar times
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </>
  )
}

function newMatch(draft: Draft, fmt: Format, board: string[][], ev: Eval): Match {
  const now = Date.now()
  return {
    id: uid(),
    name: draft.name.trim() || `Partida ${new Date(draft.date || now).toLocaleDateString('pt-BR')}`,
    date: draft.date || undefined,
    createdAt: now,
    format: fmt,
    teams: board.map((ids, i) => ({ name: `Time ${teamLetter(i)}`, playerIds: ids, positions: ev.teams[i].pos })),
    games: [],
    notes: '',
    events: '',
    playerRatings: {},
    seed: draft.seed,
    predicted: ev.teams.map((t) => t.strength),
  }
}

const strengthDiff = (ev: Eval) => Math.max(...ev.teams.map((t) => t.strength)) - Math.min(...ev.teams.map((t) => t.strength))
// 100 = estimativa de 50/50 entre o time mais forte e o mais fraco
const balance = (ev: Eval, scale: number) => Math.round(200 * (1 - logistic(strengthDiff(ev) / scale)))
const score = (ev: Eval, scale: number) => (ev.cost >= 1000 ? 'viola restrição' : `${balance(ev, scale)}/100`)

function BalanceCard({ ev, scale }: { ev: Eval; scale: number }) {
  const b = balance(ev, scale)
  const verdict = ev.cost >= 1000 ? 'Alguma restrição não pôde ser respeitada' : b >= 90 ? 'Jogo parelho' : b >= 70 ? 'Bem equilibrado' : 'Desequilibrado — tente outra opção'
  return (
    <Card className="gap-3 px-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Equilíbrio estimado</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{ev.cost >= 1000 ? '—' : b}<span className="text-lg font-medium text-muted-foreground">/100</span></p>
          <p className="font-medium">{verdict}</p>
        </div>
        <Confidence value={ev.confidence} />
      </div>
      <Progress value={ev.cost >= 1000 ? 0 : b} aria-label="Equilíbrio estimado" />
      <p className="text-sm text-muted-foreground">
        Diferença de força {n1(strengthDiff(ev))}
        {ev.winProb !== null && <> · chance do Time A {pct(ev.winProb)}</>}. Estimativa, não garantia
        {ev.confidence < 0.3 && ' — com poucos jogos registrados, vale quase só a avaliação manual'}.
      </p>
    </Card>
  )
}

function Explain({ ev, ctx, seed, onSeed }: { ev: Eval; ctx: Ctx; seed: number; onSeed: (v: number) => void }) {
  const { s } = ctx
  return (
    <Collapsible>
      <Card className="py-0">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="group h-14 w-full justify-between rounded-xl px-4 text-base font-semibold">
            <span className="flex items-center gap-2"><Info className="size-4.5 text-primary" /> Por que esta escalação</span>
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
          {ev.reasons.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {ev.reasons.map((r, i) => <li key={i} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{r}</li>)}
            </ul>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Média por time</TableHead>
                {ev.teams.map((_, i) => <TableHead key={i} className={cn('text-right font-bold', teamText(i))}>{teamLetter(i)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.attributes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  {ev.teams.map((t, i) => <TableCell key={i} className="text-right tabular-nums">{n1(t.attrs[a.id])}</TableCell>)}
                </TableRow>
              ))}
              {s.positions.map((p) => (
                <TableRow key={p.id} className="text-muted-foreground">
                  <TableCell>Posição: {p.name}</TableCell>
                  {ev.teams.map((t, i) => <TableCell key={i} className="text-right tabular-nums">{t.posCount[p.id] ?? 0}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <h3 className="mb-1 text-sm font-semibold">O que pesou na escolha <span className="font-normal text-muted-foreground">(menor = melhor)</span></h3>
            <ul className="divide-y text-sm">
              {[...ev.parts].sort((a, b) => b.value - a.value).map((p) => (
                <li key={p.label} className="flex min-h-9 items-center justify-between"><span>{p.label}</span><span className="tabular-nums">{n1(p.value)}</span></li>
              ))}
            </ul>
          </div>
          <Label className="gap-3 text-sm font-normal text-muted-foreground">
            Semente
            <Input type="number" className="w-24" value={seed} onChange={(e) => onSeed(+e.target.value || 1)} />
            <span className="text-xs">mesma semente + mesmos dados = mesmos times</span>
          </Label>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// Tela cheia para mostrar ao grupo: nomes grandes, cores dos times, sem notas.
function Present({ board, ev, byId, s, title, subtitle }: { board: string[][]; ev: Eval; byId: Map<string, Player>; s: Ctx['s']; title: string; subtitle: string }) {
  const teams = board.map((ids, ti) => ({ name: `Time ${teamLetter(ti)}`, players: ids.map((id) => ({ name: pname(byId.get(id)), pos: posName(s, ev.teams[ti].pos[id]) })) }))
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" aria-label="Mostrar e compartilhar os times"><Presentation /> <span className="max-sm:sr-only">Mostrar</span></Button>
      </DialogTrigger>
      <DialogContent className="h-dvh max-h-none w-screen max-w-none overflow-y-auto rounded-none p-5 sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{subtitle} · Bom jogo! 🏐</DialogDescription>
        </DialogHeader>
        <ShareTeams title={title} subtitle={subtitle} teams={teams} />
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {teams.map((t, ti) => (
            <section key={ti} className="overflow-hidden rounded-2xl ring-1 ring-foreground/10">
              <h2 className={cn('px-4 py-3 text-2xl font-black text-white', teamBg(ti))}>{t.name}</h2>
              <ul className="divide-y">
                {t.players.map((p, pi) => (
                  <li key={pi} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                    <span className="text-2xl font-semibold">{p.name}</span>
                    <span className="text-sm text-muted-foreground uppercase">{p.pos}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SaveDialog({ draft, disabled, onSave }: { draft: Draft; disabled: boolean; onSave: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1" disabled={disabled}><Save /> Salvar escalação</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar partida</DialogTitle>
          <DialogDescription>Os dois campos são opcionais. Depois do jogo é só anotar o placar.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave() }}>
          <div className="grid gap-2">
            <Label htmlFor="mname">Nome</Label>
            <Input id="mname" placeholder="Ex.: Quinta à noite" value={draft.name} onChange={(e) => mutateDraft((d) => void (d.name = e.target.value))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mdate">Data e hora</Label>
            <Input id="mdate" type="datetime-local" value={draft.date} onChange={(e) => mutateDraft((d) => void (d.date = e.target.value))} />
          </div>
          <DialogFooter>
            <Button size="lg" className="w-full"><Save /> Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Etiqueta de posição que abre o seletor nativo: “Automática” devolve a escolha ao app.
function PosPicker({ name, pos, off, fixed, s, onChange }: {
  name: string
  pos: string
  off: boolean
  fixed?: string
  s: Ctx['s']
  onChange: (pos: string) => void
}) {
  return (
    <label className="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center" title={fixed ? 'Posição fixada' : off ? 'Fora da posição de costume' : 'Trocar posição'}>
      <Badge variant={off && !fixed ? 'destructive' : fixed ? 'default' : 'secondary'}>
        {fixed ? <Pin data-icon="inline-start" /> : off && <TriangleAlert data-icon="inline-start" />}
        {posShort(s, pos)}
      </Badge>
      <select aria-label={`Posição de ${name}`} className="absolute inset-0 cursor-pointer opacity-0" value={fixed ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Automática</option>
        {s.positions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  )
}
