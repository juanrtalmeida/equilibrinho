import type { ComponentType, ReactNode } from 'react'
import { Sprout, Gauge, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardDescription } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { pct, plural } from './fmt.ts'

export function Confidence({ value, n }: { value: number; n?: number }) {
  const [label, Icon] = value < 0.3 ? ['poucos dados', Sprout] : value < 0.6 ? ['confiança média', Gauge] : ['confiança boa', ShieldCheck]
  return (
    <Badge variant={value < 0.6 ? 'secondary' : 'outline'} title={`Confiança ${pct(value)}`}>
      <Icon data-icon="inline-start" />
      {label}
      {n !== undefined && ` · ${plural(n, 'jogo')}`}
    </Badge>
  )
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">sem histórico</span>
  const w = 120
  const h = 28
  const lo = Math.min(...values) - 1
  const hi = Math.max(...values) + 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - lo) / (hi - lo)) * h}`).join(' ')
  return (
    <svg className={cn('text-primary', className)} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Evolução da força estimada">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Section({ icon: Icon, title, description, action, children, className }: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="size-4.5 text-primary" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {children !== undefined && <CardContent className="flex flex-col gap-3">{children}</CardContent>}
    </Card>
  )
}

// Confirmação para ações destrutivas; `trigger` deve ser um único elemento clicável.
export function Confirm({ trigger, title, description, action = 'Confirmar', destructive = true, onConfirm }: {
  trigger: ReactNode
  title: string
  description?: ReactNode
  action?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {action}
    </div>
  )
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-card p-3 text-center ring-1 ring-foreground/10">
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
