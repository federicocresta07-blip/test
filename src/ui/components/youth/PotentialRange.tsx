import type { ReactNode } from 'react';
import type { ScoutingReport } from '../../models/index.ts';
import { ratingColor } from '../../lib/ratings.ts';

/**
 * EL POTENCIAL DE UN JUVENIL, COMO RANGO (seccion 7 — fase 4).
 *
 * La barra va de 40 a 95 —el rango util de la escala para un juvenil— y el
 * tramo pintado es lo que el ojeador informa. Se dibuja asi, y no como un
 * numero, porque el ancho ES la informacion: un tramo corto se puede usar para
 * decidir y uno largo no.
 *
 * La marca del nivel de hoy va sobre la misma escala, para que se vea de un
 * vistazo cuanto le falta.
 */

const SCALE_MIN = 40;
const SCALE_MAX = 95;

function position(value: number): number {
  return ((Math.max(SCALE_MIN, Math.min(SCALE_MAX, value)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

export function PotentialRange({
  report,
  current,
  size = 'md',
}: {
  readonly report: ScoutingReport;
  /** Nivel actual del jugador, para marcarlo sobre la misma escala. */
  readonly current: number;
  readonly size?: 'md' | 'lg';
}): ReactNode {
  const left = position(report.low);
  const right = position(report.high);
  const now = position(current);

  return (
    <div className={`potrange potrange--${size}`}>
      <div
        className="potrange__track"
        title={`El ojeador estima su techo entre ${report.low} y ${report.high}. Hoy está en ${current}.`}
      >
        <span
          className="potrange__band"
          style={{
            left: `${left}%`,
            width: `${Math.max(2, right - left)}%`,
            background: `linear-gradient(90deg, ${ratingColor(report.low)}, ${ratingColor(report.high)})`,
          }}
        />
        <span className="potrange__now" style={{ left: `${now}%` }} aria-hidden="true" />
      </div>

      <span className="potrange__label tnum">
        {report.low}–{report.high}
        <span className="potrange__width"> · {report.width} pts</span>
      </span>
    </div>
  );
}
