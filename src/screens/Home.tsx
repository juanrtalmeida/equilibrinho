import { ChevronRight, Clock, Shuffle, Trophy, UserPlus, Volleyball } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { addPlayer, useDB, useModel } from '../store.ts'
import { matchTime } from '../engine/rating.ts'
import { byTimeDesc, fmtDate, matchSummary, pct, type Go } from '../fmt.ts'
import { Section, Stat } from '../ui.tsx'

export function Home({ go }: { go: Go }) {
  const db = useDB()
  const model = useModel()
  const pending = db.matches.filter((m) => !m.games.length).sort(byTimeDesc)
  const recent = db.matches.filter((m) => m.games.length).sort(byTimeDesc).slice(0, 5)
  const decided = model.calib.filter((c) => c.favoriteWon !== null)
  const hit = decided.filter((c) => c.favoriteWon).length

  return (
    <>
      <header className="flex items-center gap-3 pt-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Volleyball className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equilibrinho</h1>
          <p className="text-sm text-muted-foreground">Times parelhos, sem treta. Aprende a cada jogo.</p>
        </div>
      </header>

      {!db.players.length && (
        <Section icon={UserPlus} title="Bora começar" className="bg-accent/60" description="Cadastre a galera uma vez; os perfis ficam salvos e servem para todas as partidas.">
          <Button size="lg" onClick={() => go({ tab: 'players', id: addPlayer() })}>
            <UserPlus /> Cadastrar jogador
          </Button>
        </Section>
      )}

      <Button size="lg" className="h-16 text-lg" onClick={() => go({ tab: 'build' })}>
        <Shuffle className="size-5" /> Montar times
      </Button>

      {pending.map((m) => (
        <button key={m.id} onClick={() => go({ tab: 'matches', id: m.id })} className="flex items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-primary/40 transition-colors hover:bg-accent/50">
          <Clock className="size-5 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">{m.name}</span>
            <span className="text-sm text-muted-foreground">
              {fmtDate(matchTime(m))} · {m.teams.map((t) => `${t.name} (${t.playerIds.length})`).join(' × ')}
            </span>
          </span>
          <Badge variant="secondary">anotar placar</Badge>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      ))}

      <div className="grid grid-cols-3 gap-2">
        <Stat value={db.players.length} label="jogadores" />
        <Stat value={db.matches.filter((m) => m.games.length).length} label="partidas" />
        <Stat value={decided.length ? pct(hit / decided.length) : '—'} label="favorito venceu" />
      </div>

      {recent.length > 0 && (
        <Section icon={Trophy} title="Últimos resultados">
          <ul className="-mx-2 flex flex-col">
            {recent.map((m) => (
              <li key={m.id}>
                <button onClick={() => go({ tab: 'matches', id: m.id })} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 text-left hover:bg-muted">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{matchSummary(m)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
