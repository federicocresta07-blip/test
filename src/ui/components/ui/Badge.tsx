import type { ReactNode } from 'react';
import { ratingColor } from '../../lib/ratings.ts';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
  readonly title?: string;
}): ReactNode {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

/**
 * Overall 1-100 con el color de su tramo. Es el componente que fija la
 * lectura de calidad en toda la app (secciones 6.2, 6.3).
 */
export function RatingBadge({
  value,
  size = 'md',
  title,
}: {
  readonly value: number;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly title?: string;
}): ReactNode {
  return (
    <span
      className={`rating rating--${size} tnum`}
      style={{ color: ratingColor(value), borderColor: ratingColor(value) }}
      title={title}
    >
      {Math.round(value)}
    </span>
  );
}

export type PlayerStatus = 'lesionado' | 'suspendido' | 'riesgo' | 'fatigado' | 'descontento' | 'forma' | 'baja-forma';

const STATUS_META: Record<PlayerStatus, { icon: string; tone: BadgeTone; label: string }> = {
  lesionado: { icon: '✚', tone: 'danger', label: 'Lesionado' },
  suspendido: { icon: '⊘', tone: 'danger', label: 'Suspendido' },
  riesgo: { icon: '▣', tone: 'warn', label: 'Riesgo de suspensión' },
  fatigado: { icon: '◗', tone: 'warn', label: 'Fatigado' },
  descontento: { icon: '!', tone: 'info', label: 'Descontento' },
  forma: { icon: '▲', tone: 'ok', label: 'En buena forma' },
  'baja-forma': { icon: '▼', tone: 'warn', label: 'En baja' },
};

/** Icono compacto de estado con tooltip nativo (seccion 6.11). */
export function StatusBadge({
  status,
  detail,
}: {
  readonly status: PlayerStatus;
  readonly detail?: string;
}): ReactNode {
  const meta = STATUS_META[status];
  return (
    <span
      className={`status status--${meta.tone}`}
      title={detail ? `${meta.label}: ${detail}` : meta.label}
      aria-label={meta.label}
    >
      {meta.icon}
    </span>
  );
}
