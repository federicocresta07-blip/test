import type { ReactNode } from 'react';
import { ColorBar } from '../ui/ProgressBar.tsx';
import { ratingColor } from '../../lib/ratings.ts';
import { decimal, percent } from '../../lib/format.ts';
import type { TeamMetrics as Metrics } from '../../lib/engine-bridge.ts';

/**
 * FEEDBACK DEL EQUIPO (seccion 6.8).
 *
 * Se actualiza al instante cuando cambia el once, porque sale del motor con
 * los jugadores que estan puestos en cada puesto. No hay una sola media que
 * explique la fuerza del equipo: hay varias dimensiones, y la media del XI
 * esta ahi como referencia, no como explicacion.
 */
export function TeamMetricsPanel({ metrics }: { readonly metrics: Metrics }): ReactNode {
  return (
    <div className="metrics">
      {metrics.missing > 0 && (
        <p className="metrics__warning">
          Faltan {metrics.missing} {metrics.missing === 1 ? 'puesto' : 'puestos'}: los valores son parciales.
        </p>
      )}

      <ul className="metrics__list">
        <MetricRow label="Ataque" value={metrics.ataque} />
        <MetricRow label="Mediocampo" value={metrics.mediocampo} />
        <MetricRow label="Defensa" value={metrics.defensa} />
        <MetricRow label="Arquero" value={metrics.arquero} />
      </ul>

      <div className="metrics__secondary">
        <SmallMetric label="Media XI" value={decimal(metrics.mediaXI, 1)} hint="Promedio de overall del once. Referencia, no explicación." />
        <SmallMetric
          label="Cohesión"
          value={String(metrics.cohesion)}
          hint="Qué tan acoplado está el grupo. Sube jugando juntos y con buenos resultados."
          color={ratingColor(metrics.cohesion)}
        />
        <SmallMetric
          label="Condición"
          value={percent(metrics.condicion)}
          hint="Energía media de los titulares elegidos."
          color={ratingColor(metrics.condicion * 100)}
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { readonly label: string; readonly value: number }): ReactNode {
  return (
    <li className="metricrow">
      <span className="metricrow__label">{label}</span>
      <span className="metricrow__bar">
        <ColorBar value={value / 100} color={ratingColor(value)} height={5} />
      </span>
      <span className="metricrow__value tnum" style={{ color: ratingColor(value) }}>
        {value}
      </span>
    </li>
  );
}

function SmallMetric({
  label,
  value,
  hint,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly color?: string;
}): ReactNode {
  return (
    <div className="smallmetric" title={hint}>
      <span className="label">{label}</span>
      <span className="smallmetric__value tnum" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
