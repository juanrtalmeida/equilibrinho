import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Database, Download, GraduationCap, Plus, RotateCcw, Scale, Shirt, Trash, TriangleAlert, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { exportBackup, importBackup, mutate, resetAll, uid, useDB } from '../store.ts'
import { defaultSettings } from '../defaults.ts'
import type { Format, Weights } from '../types.ts'
import { plural } from '../fmt.ts'
import { Confirm, PageTitle, Section } from '../ui.tsx'

const WEIGHTS: [keyof Weights, string, string][] = [
  ['strength', 'Diferença de força', 'Igualar a força média dos times'],
  ['skills', 'Perfil de habilidades', 'Evitar um time só de atacantes e outro só de defensores'],
  ['positions', 'Posições', 'Cobrir posições obrigatórias e distribuir funções'],
  ['dependency', 'Dependência de destaque', 'Espalhar os jogadores mais fortes'],
  ['uncertainty', 'Novatos', 'Espalhar jogadores pouco observados'],
  ['synergy', 'Peso das sinergias', 'Quanto o histórico de parcerias conta na força do time'],
]

export function SettingsScreen() {
  const db = useDB()
  const s = db.settings
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])
  const updFmt = (id: string, fn: (f: Format) => void) => mutate((d) => fn(d.settings.formats.find((f) => f.id === id)!))

  return (
    <>
      <PageTitle>Dados e ajustes</PageTitle>

      <Section icon={Database} title="Backup" className="ring-primary/40"
        description={<>Os dados ficam <b className="text-foreground">só neste aparelho</b>, sem nuvem e sem sincronização. Para trocar de celular ou não perder nada se o navegador limpar os dados, exporte um backup e importe no outro aparelho.</>}>
        <p className="text-sm text-muted-foreground">
          {plural(db.players.length, 'jogador', 'jogadores')} · {plural(db.matches.length, 'partida')}
          {persisted !== null && (persisted ? ' · armazenamento protegido pelo navegador' : ' · o navegador pode limpar os dados se faltar espaço')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={exportBackup}><Download /> Exportar</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Importar</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) setPending(await f.text())
        }} />
        <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Substituir os dados deste aparelho?</AlertDialogTitle>
              <AlertDialogDescription>Todos os jogadores, partidas e ajustes atuais serão trocados pelos do backup. Se quiser guardar os atuais, exporte antes.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => {
                try {
                  importBackup(pending!)
                  toast.success('Backup restaurado.')
                } catch (err) {
                  toast.error(`Não deu para importar: ${(err as Error).message}`)
                }
                setPending(null)
              }}>Substituir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <Section icon={Scale} title="Critérios do balanceamento" description="Quanto cada critério pesa na hora de sortear. Mudou, recalcula na hora.">
        {WEIGHTS.map(([k, label, desc]) => (
          <div key={k} className="grid gap-2 py-1">
            <div className="flex items-baseline justify-between">
              <Label>{label}</Label>
              <span className="font-semibold tabular-nums">{s.weights[k].toFixed(1)}</span>
            </div>
            <Slider min={0} max={3} step={0.1} value={[s.weights[k]]} aria-label={label} onValueChange={([v]) => mutate((d) => void (d.settings.weights[k] = v))} />
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </Section>

      <Section icon={GraduationCap} title="Aprendizado" description="Como o app ajusta as forças a partir dos placares.">
        <div className="grid grid-cols-3 gap-2">
          {([
            ['k', 'Velocidade', 0, 20, 0.5],
            ['priorN', 'Jogos p/ confiar', 1, 50, 1],
            ['maxDelta', 'Ajuste máx./jogo', 0, 20, 0.5],
          ] as const).map(([k, label, min, max, step]) => (
            <div key={k} className="grid gap-2">
              <Label htmlFor={`l-${k}`} className="text-xs">{label}</Label>
              <Input id={`l-${k}`} type="number" min={min} max={max} step={step} value={s.learning[k]}
                onChange={(e) => mutate((d) => void (d.settings.learning[k] = Math.max(min, +e.target.value || min)))} />
            </div>
          ))}
        </div>
        <Button variant="outline" className="self-start" onClick={() => mutate((d) => {
          d.settings.weights = defaultSettings().weights
          d.settings.learning = defaultSettings().learning
        })}><RotateCcw /> Restaurar padrões</Button>
      </Section>

      <Section icon={Shirt} title="Formatos de jogo">
        {s.formats.map((f) => (
          <Collapsible key={f.id} className="rounded-lg border">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="group w-full justify-between">
                {f.name}
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3 px-3 pb-3">
              <div className="grid gap-2">
                <Label htmlFor={`fn-${f.id}`}>Nome</Label>
                <Input id={`fn-${f.id}`} value={f.name} onChange={(e) => updFmt(f.id, (x) => void (x.name = e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor={`ft-${f.id}`}>Times</Label>
                  <Input id={`ft-${f.id}`} type="number" min={2} max={4} value={f.teams} onChange={(e) => updFmt(f.id, (x) => void (x.teams = Math.max(2, Math.min(4, +e.target.value || 2))))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`fp-${f.id}`}>Por time</Label>
                  <Input id={`fp-${f.id}`} type="number" min={1} max={12} value={f.perTeam} onChange={(e) => updFmt(f.id, (x) => void (x.perTeam = Math.max(1, +e.target.value || 1)))} />
                </div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Posição</TableHead><TableHead>Obrigatório</TableHead><TableHead>Desejável</TableHead></TableRow></TableHeader>
                <TableBody>
                  {s.positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      {(['required', 'desired'] as const).map((k) => (
                        <TableCell key={k}>
                          <Input className="w-20" type="number" min={0} max={6} aria-label={`${p.name} ${k === 'required' ? 'obrigatório' : 'desejável'}`} value={f[k][p.id] ?? 0} onChange={(e) => updFmt(f.id, (x) => {
                            if (+e.target.value > 0) x[k][p.id] = +e.target.value
                            else delete x[k][p.id]
                          })} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {s.formats.length > 1 && (
                <Confirm
                  trigger={<Button variant="destructive" className="self-start"><Trash /> Excluir formato</Button>}
                  title={`Excluir o formato “${f.name}”?`}
                  description="Partidas já salvas guardam uma cópia do formato e não são afetadas."
                  action="Excluir"
                  onConfirm={() => mutate((d) => void (d.settings.formats = d.settings.formats.filter((x) => x.id !== f.id)))}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
        <Button variant="outline" className="self-start" onClick={() => mutate((d) => void d.settings.formats.push({ id: uid(), name: 'Novo formato', teams: 2, perTeam: 6, required: {}, desired: {} }))}>
          <Plus /> Formato
        </Button>
      </Section>

      <Section icon={Shirt} title="Posições e pesos" description="Peso de cada habilidade na força do jogador em cada posição (0 = não conta, 1 = normal). Toque no nome da posição para renomear.">
        <div className="-mx-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Habilidade</TableHead>
                {s.positions.map((p) => (
                  <TableHead key={p.id}>
                    <Input className="h-9 w-28 font-semibold" value={p.name} aria-label="Nome da posição" onChange={(e) => mutate((d) => void (d.settings.positions.find((x) => x.id === p.id)!.name = e.target.value))} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.attributes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4">{a.name}</TableCell>
                  {s.positions.map((p) => (
                    <TableCell key={p.id}>
                      <Input className="h-9 w-20" type="number" min={0} max={5} step={0.5} aria-label={`Peso de ${a.name} para ${p.name}`} value={s.posWeights[p.id]?.[a.id] ?? 1}
                        onChange={(e) => mutate((d) => void ((d.settings.posWeights[p.id] ??= {})[a.id] = +e.target.value))} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <AddNamed label="posição" onAdd={(name) => mutate((d) => void d.settings.positions.push({ id: uid(), name }))} />
        <AddNamed label="habilidade" onAdd={(name) => mutate((d) => void d.settings.attributes.push({ id: uid(), name, desc: '' }))} />
      </Section>

      <Section icon={TriangleAlert} title="Zona de perigo">
        <Confirm
          trigger={<Button variant="destructive" className="self-start"><Trash /> Apagar todos os dados</Button>}
          title="Apagar tudo deste aparelho?"
          description="Jogadores, partidas, turmas e ajustes somem e não dá para desfazer. Exporte um backup antes."
          action="Apagar tudo"
          onConfirm={() => {
            resetAll()
            toast('Dados apagados.')
          }}
        />
      </Section>
    </>
  )
}

function AddNamed({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault()
      if (!name.trim()) return
      onAdd(name.trim())
      setName('')
    }}>
      <Input placeholder={`Nova ${label}`} aria-label={`Nome da nova ${label}`} value={name} onChange={(e) => setName(e.target.value)} />
      <Button variant="outline" disabled={!name.trim()}><Plus /> Adicionar</Button>
    </form>
  )
}
