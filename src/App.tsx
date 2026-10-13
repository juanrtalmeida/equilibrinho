import { useState } from 'react'
import { ChartColumn, House, Settings, Shuffle, Trophy, Users } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import type { Route, Tab } from './fmt.ts'
import { Home } from './screens/Home.tsx'
import { Players } from './screens/Players.tsx'
import { Build } from './screens/Build.tsx'
import { Matches } from './screens/Matches.tsx'
import { Analysis } from './screens/Analysis.tsx'
import { SettingsScreen } from './screens/Settings.tsx'

const TABS: [Tab, string, typeof House][] = [
  ['home', 'Início', House],
  ['players', 'Jogadores', Users],
  ['build', 'Montar', Shuffle],
  ['matches', 'Partidas', Trophy],
  ['analysis', 'Análises', ChartColumn],
  ['settings', 'Dados', Settings],
]

export default function App() {
  const [route, setRoute] = useState<Route>({ tab: 'home' })
  const go = (r: Route) => {
    setRoute(r)
    window.scrollTo(0, 0)
  }
  const screens = {
    home: <Home go={go} />,
    players: <Players go={go} id={route.id} />,
    build: <Build go={go} />,
    matches: <Matches go={go} id={route.id} />,
    analysis: <Analysis go={go} />,
    settings: <SettingsScreen />,
  }
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-40">{screens[route.tab]}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Seções">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map(([t, label, Icon]) => {
            const on = route.tab === t
            return (
              <button
                key={t}
                aria-current={on ? 'page' : undefined}
                onClick={() => go({ tab: t })}
                className={cn(
                  'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:bg-accent',
                  on && 'text-primary',
                )}
              >
                <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition-colors', on && 'bg-accent')}>
                  <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </nav>
      <Toaster position="top-center" richColors closeButton />
    </>
  )
}
