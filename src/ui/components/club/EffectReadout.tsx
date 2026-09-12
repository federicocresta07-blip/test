import type { ReactNode } from 'react';
import type { EffectConsumer, EffectUnit, StaffEffect } from '../../../domain/staff.ts';
import { decimal } from '../../lib/format.ts';
import { Tooltip } from '../ui/Tooltip.tsx';

/**
 * EFECTO DE UN PROFESIONAL, MOSTRADO SIN AMBIGÜEDAD (seccion 7, fase 3).
 *
 * Tres cosas quedan a la vista:
 *   1. qué mejora, en palabras;
 *   2. cuánto entrega HOY, y si las instalaciones lo están limitando, cuánto
 *      daría sin ese límite;
 *   3. quién consume ese efecto — y si todavía no lo consume nadie, en qué
 *      fase se construye el módulo que lo va a usar.
 *
 * El punto 3 es el que evita los boosts mágicos: un efecto no puede dar a
 * entender que hace algo que el juego todavía no hace.
 */
export function EffectReadout({ effect }: { readonly effect: StaffEffect }): ReactNode {
  return (
    <div className="effect">
      <span className="effect__what">{effect.spec.effect}</span>

      <div className="effect__values">
        <span className="effect__actual" style={{ color: 'var(--ok)' }}>
          {formatEffect(effect.actual, effect.unit, effect.direction)}
        </span>
        {effect.limited && (
          <Tooltip
            side="top"
            content={
              <>
                Con instalaciones a la altura de su nivel daría{' '}
                <strong>{formatEffect(effect.nominal, effect.unit, effect.direction)}</strong>. Hoy
                aprovecha el {Math.round(effect.utilisation * 100)}%.
              </>
            }
          >
            <span className="effect__nominal">
              de {formatEffect(effect.nominal, effect.unit, effect.direction)} posible
            </span>
          </Tooltip>
        )}
      </div>

      <ConsumerNote consumer={effect.consumer} />
    </div>
  );
}

/** Dice quién usa el efecto, o que todavía nadie lo usa. */
export function ConsumerNote({ consumer }: { readonly consumer: EffectConsumer }): ReactNode {
  if (consumer.kind === 'implementado') {
    return (
      <span className="consumer consumer--live" title={`Se aplica en la ${consumer.where}`}>
        Se aplica hoy
      </span>
    );
  }
  return (
    <span
      className="consumer consumer--pending"
      title={`El módulo ${consumer.module} se construye en la fase ${consumer.phase} del plan`}
    >
      Todavía no se aplica · {consumer.module}, fase {consumer.phase}
    </span>
  );
}

/**
 * Formatea el efecto según su unidad y su dirección.
 * Un efecto que reduce se muestra como reducción, no como número crudo:
 * "−32% de recuperación" se entiende; "32%" no dice si sube o baja.
 */
export function formatEffect(
  value: number,
  unit: EffectUnit,
  direction: 'mejora' | 'reduce',
): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : decimal(rounded, 1);
  switch (unit) {
    case 'porcentaje':
      return direction === 'mejora' ? `+${text}%` : `−${text}%`;
    case 'puntos':
      return `±${text} pts`;
    case 'nivel':
      return `nivel ${text} de 5`;
  }
}
