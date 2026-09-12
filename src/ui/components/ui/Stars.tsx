import type { ReactNode } from 'react';

/** Escala ★☆☆☆☆ a ★★★★★ para staff e instalaciones (seccion 7). */
export function Stars({
  value,
  max = 5,
  size = 'md',
}: {
  readonly value: number;
  readonly max?: number;
  readonly size?: 'sm' | 'md';
}): ReactNode {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <span className={`stars stars--${size}`} aria-label={`${filled} de ${max} estrellas`}>
      {'★'.repeat(filled)}
      <span className="stars__empty">{'☆'.repeat(max - filled)}</span>
    </span>
  );
}
