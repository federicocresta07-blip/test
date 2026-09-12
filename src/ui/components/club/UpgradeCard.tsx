import type { ReactNode } from 'react';
import { moneyShort } from '../../lib/format.ts';
import { Button } from '../ui/Button.tsx';
import { Stars } from '../ui/Stars.tsx';

/**
 * BLOQUE DE INVERSION (seccion 16 — componente del sistema de diseño).
 *
 * Es el mismo bloque para mejorar un profesional, mejorar una instalación o
 * contratar a un candidato. Que sea uno solo es deliberado: el criterio de la
 * fase 3 pide que staff e instalaciones se lean como partes de un mismo
 * sistema de desarrollo, y eso empieza por presentar la decisión igual en los
 * dos casos.
 *
 * Siempre muestra las cuatro cosas que hacen falta para decidir:
 *   1. a qué nivel se pasa;
 *   2. qué cambia exactamente, valor de antes y valor de después;
 *   3. cuánto cuesta hoy y cuánto suma al gasto mensual;
 *   4. cuánto tarda.
 *
 * Y cuando no se puede pagar, dice cuánto falta en lugar de solo apagar el
 * botón.
 */

/** Una línea de "esto pasa de X a Y". */
export type UpgradeChange = {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  /** `mejora` se lee en verde; `coste` en ámbar. */
  readonly tone?: 'mejora' | 'coste' | undefined;
  readonly hint?: string | undefined;
};

export function UpgradeCard({
  heading,
  nextLevel,
  changes,
  cost,
  weeks,
  cash,
  actionLabel = 'Mejorar',
  onConfirm,
  busy = false,
  note,
}: {
  readonly heading: string;
  /** Nivel al que se pasa, para mostrarlo en estrellas. */
  readonly nextLevel: number;
  readonly changes: readonly UpgradeChange[];
  readonly cost: number;
  readonly weeks: number | null;
  /** Caja disponible, para calcular cuánto falta. */
  readonly cash: number;
  readonly actionLabel?: string;
  readonly onConfirm: () => void;
  readonly busy?: boolean;
  readonly note?: ReactNode | undefined;
}): ReactNode {
  const shortfall = cost - cash;
  const affordable = shortfall <= 0;

  return (
    <div className={`upgrade ${affordable ? '' : 'is-blocked'}`}>
      <header className="upgrade__head">
        <span className="upgrade__heading">{heading}</span>
        <Stars value={nextLevel} size="sm" />
      </header>

      <dl className="upgrade__changes">
        {changes.map((change) => (
          <div className="upgrade__change" key={change.label} title={change.hint}>
            <dt>{change.label}</dt>
            <dd>
              <span className="upgrade__from tnum">{change.from}</span>
              <span className="upgrade__arrow" aria-hidden="true">
                →
              </span>
              <span className={`upgrade__to tnum upgrade__to--${change.tone ?? 'mejora'}`}>
                {change.to}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <footer className="upgrade__foot">
        <div className="upgrade__price">
          <span className="upgrade__cost tnum">{moneyShort(cost)}</span>
          {weeks !== null && (
            <span
              className="upgrade__weeks"
              title="El calendario se construye en la fase 7. Hasta entonces la mejora se aplica al instante y las semanas son informativas."
            >
              {weeks} {weeks === 1 ? 'semana' : 'semanas'} de trabajo
            </span>
          )}
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={onConfirm}
          disabled={busy || !affordable}
          title={affordable ? undefined : `Faltan ${moneyShort(shortfall)} en caja`}
        >
          {actionLabel}
        </Button>
      </footer>

      {!affordable && (
        <p className="upgrade__shortfall">
          Faltan <strong className="tnum">{moneyShort(shortfall)}</strong> en caja.
        </p>
      )}
      {note && <p className="upgrade__note">{note}</p>}
    </div>
  );
}

/** Estado de "no hay nada más que invertir acá". */
export function AtMaxLevel({ what }: { readonly what: string }): ReactNode {
  return (
    <div className="upgrade upgrade--max">
      <span className="upgrade__heading">Nivel máximo</span>
      <p className="upgrade__note">{what} ya está en cinco estrellas. No hay mejora pendiente.</p>
    </div>
  );
}
