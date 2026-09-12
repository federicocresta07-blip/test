import type { ReactNode } from 'react';

export function ProgressBar({
  value,
  tone = 'accent',
  label,
  height = 6,
}: {
  /** 0..1 */
  readonly value: number;
  readonly tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'custom';
  readonly label?: string;
  readonly height?: number;
  readonly color?: string;
}): ReactNode {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`progress progress--${tone}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      title={label}
    >
      <div className="progress__fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

/** Barra con color explicito, para escalas como energia u overall. */
export function ColorBar({
  value,
  color,
  height = 4,
  label,
}: {
  readonly value: number;
  readonly color: string;
  readonly height?: number;
  readonly label?: string;
}): ReactNode {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" style={{ height }} title={label}>
      <div className="progress__fill" style={{ width: `${clamped * 100}%`, background: color }} />
    </div>
  );
}
