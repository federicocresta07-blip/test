import type { ReactNode } from 'react';
import type { PlayerAppraisal } from '../../../domain/market.ts';
import { moneyShort } from '../../lib/format.ts';
import { ratingColor } from '../../lib/ratings.ts';
import { Tooltip } from '../ui/Tooltip.tsx';

/**
 * EL INFORME SOBRE UN JUGADOR AJENO (secciones 7, 10 — fase 5).
 *
 * No se muestra un overall: se muestra un rango. Del propio plantel se sabe
 * todo, porque se entrena con el; de uno ajeno se sabe lo que informa el
 * ojeador, y el ancho de ese informe sale del efecto del rol.
 *
 * Es el mismo patron que en inferiores, y por el mismo motivo: sin esto, el
 * ojeador y el secretario tecnico no tendrian para que existir.
 */

export function ReportedOverall({
  appraisal,
  size = 'md',
}: {
  readonly appraisal: PlayerAppraisal;
  readonly size?: 'sm' | 'md';
}): ReactNode {
  const exact = appraisal.overallMargin === 0;

  return (
    <Tooltip
      side="top"
      content={
        exact ? (
          <>Tu ojeador lo ve con precisión total.</>
        ) : (
          <>
            Tu ojeador lo estima en <strong>{appraisal.overall}</strong>, con un margen de{' '}
            <strong>±{appraisal.overallMargin} puntos</strong>. Su nivel real está entre{' '}
            {appraisal.overallLow} y {appraisal.overallHigh}.
          </>
        )
      }
    >
      <span className={`reported reported--${size}`}>
        <span className="reported__value tnum" style={{ color: ratingColor(appraisal.overall) }}>
          {appraisal.overall}
        </span>
        {!exact && (
          <span className="reported__margin tnum">
            ±{appraisal.overallMargin}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

export function ReportedValue({ appraisal }: { readonly appraisal: PlayerAppraisal }): ReactNode {
  const exact = appraisal.valueMargin === 0;

  return (
    <Tooltip
      side="top"
      content={
        exact ? (
          <>Tu secretario técnico lo tasa con precisión total.</>
        ) : (
          <>
            Tasación con un margen del <strong>{Math.round(appraisal.valueMargin * 100)}%</strong>:
            su valor real está entre {moneyShort(appraisal.valueLow)} y{' '}
            {moneyShort(appraisal.valueHigh)}.
          </>
        )
      }
    >
      <span className="reportedvalue">
        <span className="tnum">{moneyShort(appraisal.value)}</span>
        {!exact && (
          <span className="reportedvalue__margin tnum">
            ±{Math.round(appraisal.valueMargin * 100)}%
          </span>
        )}
      </span>
    </Tooltip>
  );
}

/** El rango de potencial informado, que es mas ancho que el de nivel. */
export function ReportedPotential({
  appraisal,
}: {
  readonly appraisal: PlayerAppraisal;
}): ReactNode {
  const width = appraisal.potentialHigh - appraisal.potentialLow;
  return (
    <Tooltip
      side="top"
      content={
        <>
          Adivinar el techo de un jugador es más difícil que ver cuánto rinde hoy, así que el rango
          es más ancho: {width} puntos. Su techo real está dentro.
        </>
      }
    >
      <span className="reportedpot tnum">
        {appraisal.potentialLow}–{appraisal.potentialHigh}
      </span>
    </Tooltip>
  );
}
