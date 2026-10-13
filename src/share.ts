// Gera a imagem dos times em canvas (sem rede, sem deps) e compartilha pelo menu nativo do celular.

export interface ShareTeam {
  name: string
  players: { name: string; pos: string }[]
}

// Mesmas cores de --color-team-* (index.css), em hex para qualquer canvas.
const TEAM_COLORS = ['#d9541e', '#1f6fb8', '#2e8b4f', '#8a4fc4']
const BG = '#f7f4ee'
const INK = '#1d2230'
const MUTED = '#6b7080'
const FONT = '"Geist Variable", system-ui, sans-serif'

const W = 1080
const PAD = 64
const GAP = 32
const HEAD = 96
const ROW = 76

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

export function teamsText(title: string, teams: ShareTeam[]) {
  return [`🏐 ${title}`, ...teams.map((t) => `\n*${t.name}*\n${t.players.map((p) => `• ${p.name}`).join('\n')}`)].join('\n')
}

export async function teamsImage(title: string, subtitle: string, teams: ShareTeam[]): Promise<Blob> {
  await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 26px ${FONT}`)]).catch(() => {})
  const cols = teams.length === 1 ? 1 : 2
  const colW = (W - PAD * 2 - GAP * (cols - 1)) / cols
  const rowsOfTeams: ShareTeam[][] = []
  for (let i = 0; i < teams.length; i += cols) rowsOfTeams.push(teams.slice(i, i + cols))
  const blockH = (r: ShareTeam[]) => HEAD + Math.max(...r.map((t) => t.players.length)) * ROW + 16
  const top = PAD + 150
  const H = top + rowsOfTeams.reduce((a, r) => a + blockH(r) + GAP, 0) + 60

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `800 64px ${FONT}`
  ctx.fillText(fit(ctx, title, W - PAD * 2), PAD, PAD + 60)
  ctx.fillStyle = MUTED
  ctx.font = `500 32px ${FONT}`
  ctx.fillText(fit(ctx, subtitle, W - PAD * 2), PAD, PAD + 112)

  let y = top
  rowsOfTeams.forEach((r, ri) => {
    const h = blockH(r)
    r.forEach((t, ci) => {
      const x = PAD + ci * (colW + GAP)
      const color = TEAM_COLORS[(ri * cols + ci) % TEAM_COLORS.length]
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(x, y, colW, h, 28)
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = color
      ctx.fillRect(x, y, colW, HEAD)
      ctx.restore()
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 44px ${FONT}`
      ctx.fillText(fit(ctx, t.name, colW - 48), x + 28, y + 64)
      t.players.forEach((p, pi) => {
        const ry = y + HEAD + pi * ROW
        if (pi) {
          ctx.fillStyle = '#ebe7df'
          ctx.fillRect(x + 28, ry, colW - 56, 2)
        }
        ctx.font = `500 22px ${FONT}`
        const pos = p.pos.toUpperCase()
        const posW = ctx.measureText(pos).width
        ctx.fillStyle = MUTED
        ctx.fillText(pos, x + colW - 28 - posW, ry + 48)
        ctx.fillStyle = INK
        ctx.font = `600 38px ${FONT}`
        ctx.fillText(fit(ctx, p.name, colW - 84 - posW), x + 28, ry + 52)
      })
    })
    y += h + GAP
  })

  ctx.fillStyle = MUTED
  ctx.font = `500 24px ${FONT}`
  const foot = 'Equilibrinho · times parelhos'
  ctx.fillText(foot, W - PAD - ctx.measureText(foot).width, H - 36)

  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Falha ao gerar imagem'))), 'image/png'))
}

// Chamar dentro do clique: o iOS só abre o menu de compartilhar com o gesto ainda ativo,
// por isso a imagem (assíncrona) é gerada antes, em teamsImage.
// 'shared' = menu nativo usado; 'downloaded' = sem suporte a arquivos (desktop), PNG baixado; 'cancelled' = menu fechado.
export async function shareImage(blob: Blob, title: string) {
  const file = new File([blob], `times-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title })
      return 'shared' as const
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' as const
      // outro erro (ex.: permissão negada): cai para o download
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'downloaded' as const
}
