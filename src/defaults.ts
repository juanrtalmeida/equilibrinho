import type { DB, Draft, Settings } from './types.ts'

export const SCALE = [
  '',
  'Iniciante: quase nunca executa',
  'Iniciante: executa raramente',
  'Básico: executa com muitos erros',
  'Básico: executa em situações fáceis',
  'Intermediário: regular, erra sob pressão',
  'Intermediário: confiável na maioria das vezes',
  'Avançado: bom e consistente',
  'Avançado: decide jogos às vezes',
  'Excelente: referência no grupo',
  'Excelente: nível competitivo',
]

const ATTRS: [string, string, string][] = [
  ['saque', 'Saque', 'Coloca a bola em jogo com regularidade e pressão'],
  ['recepcao', 'Recepção', 'Passe de saque na mão do levantador'],
  ['levantamento', 'Levantamento', 'Distribui bolas atacáveis com precisão'],
  ['ataque', 'Ataque', 'Finaliza com força e direção'],
  ['bloqueio', 'Bloqueio', 'Lê o atacante e fecha a rede'],
  ['defesa', 'Defesa', 'Levanta bolas atacadas'],
  ['movimentacao', 'Movimentação e cobertura', 'Se desloca e cobre os companheiros'],
  ['consistencia', 'Consistência', 'Erra pouco, mantém o nível'],
  ['decisao', 'Tomada de decisão', 'Escolhe a jogada certa'],
]

export function defaultSettings(): Settings {
  return {
    positions: [
      { id: 'levantador', name: 'Levantador' },
      { id: 'oposto', name: 'Oposto' },
      { id: 'ponteiro', name: 'Ponteiro' },
      { id: 'central', name: 'Central' },
      { id: 'libero', name: 'Líbero' },
    ],
    attributes: ATTRS.map(([id, name, desc]) => ({ id, name, desc })),
    // Peso de cada atributo na força do jogador naquela posição (ausente = 1).
    posWeights: {
      levantador: { levantamento: 3, decisao: 2, defesa: 1.5, consistencia: 1.5 },
      oposto: { ataque: 3, bloqueio: 2, saque: 1.5 },
      ponteiro: { ataque: 2, recepcao: 2.5, defesa: 1.5 },
      central: { bloqueio: 3, ataque: 2, movimentacao: 1.5 },
      libero: { recepcao: 3, defesa: 3, movimentacao: 2, ataque: 0, bloqueio: 0, levantamento: 0.5 },
    },
    formats: [
      {
        id: '6x6', name: 'Vôlei 6x6', teams: 2, perTeam: 6,
        required: { levantador: 1 }, desired: { ponteiro: 2, central: 2, oposto: 1 },
      },
      { id: '4x4', name: 'Vôlei 4x4', teams: 2, perTeam: 4, required: { levantador: 1 }, desired: { ponteiro: 2 } },
      { id: 'livre', name: 'Livre (sem posições)', teams: 2, perTeam: 6, required: {}, desired: {} },
    ],
    weights: { strength: 1, skills: 0.5, positions: 1, dependency: 0.3, uncertainty: 0.2, synergy: 1 },
    learning: { k: 6, priorN: 5, scale: 8, maxDelta: 4 },
  }
}

export const emptyDB = (): DB => ({ version: 1, players: [], matches: [], groups: [], settings: defaultSettings() })

export const emptyDraft = (): Draft => ({
  formatId: '6x6',
  teams: 2,
  participants: [],
  constraints: { locks: {}, forbid: [], together: [] },
  seed: 1,
  options: [],
  board: null,
  name: '',
  date: '',
})
