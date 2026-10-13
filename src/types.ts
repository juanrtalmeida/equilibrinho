export interface Player {
  id: string
  name: string
  nick?: string
  available: boolean
  notes: string
  primary: string
  secondary: string[]
  skills: Record<string, number> // atributo -> 1..10
  createdAt: number
}

export interface Format {
  id: string
  name: string
  teams: number
  perTeam: number
  required: Record<string, number> // posição -> quantidade por time
  desired: Record<string, number>
}

export interface Constraints {
  locks: Record<string, number> // jogador -> índice do time
  forbid: [string, string][]
  together: [string, string][]
}

export interface Team {
  name: string
  playerIds: string[]
  positions?: Record<string, string> // jogador -> posição atuada
}

// Um jogo entre dois times da partida (permite rodízio com 3+ times).
export interface Game {
  a: number
  b: number
  sets: [number, number][]
}

export interface Match {
  id: string
  name: string
  date?: string
  createdAt: number
  format: Format
  teams: Team[]
  games: Game[]
  notes: string
  events: string
  durationMin?: number
  playerRatings: Record<string, number> // avaliação individual opcional 1..10
  seed: number
  predicted: number[] // força estimada de cada time ao salvar
}

export interface Group {
  id: string
  name: string
  playerIds: string[]
}

export interface Named {
  id: string
  name: string
  desc?: string
}

export interface Weights {
  strength: number
  skills: number
  positions: number
  dependency: number
  uncertainty: number
  synergy: number
}

export interface Settings {
  positions: Named[]
  attributes: Named[]
  posWeights: Record<string, Record<string, number>>
  formats: Format[]
  weights: Weights
  learning: { k: number; priorN: number; scale: number; maxDelta: number }
}

export interface DB {
  version: 1
  players: Player[]
  matches: Match[]
  groups: Group[]
  settings: Settings
}

export interface Draft {
  formatId: string
  teams: number
  participants: string[]
  constraints: Constraints
  seed: number
  options: string[][][]
  board: string[][] | null
  name: string
  date: string
}
