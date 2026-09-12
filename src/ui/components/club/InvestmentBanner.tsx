import type { ReactNode } from 'react';
import type { InvestmentState } from '../../state/GameProvider.tsx';
import { Button } from '../ui/Button.tsx';

/**
 * Resultado de la ultima inversion (secciones 7, 8, 17).
 *
 * Cuando algo falla, el mensaje dice QUE fallo en palabras del usuario —"no
 * hay caja suficiente"— y no un codigo de error. Cuando sale bien, lo
 * confirma y se va solo: la seccion 6.12 pide confirmaciones discretas.
 */
export function InvestmentBanner({
  investment,
  onDismiss,
}: {
  readonly investment: InvestmentState;
  readonly onDismiss: () => void;
}): ReactNode {
  if (investment.error) {
    return (
      <div className="investbanner investbanner--error" role="alert">
        <span className="investbanner__text">{investment.error}</span>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Entendido
        </Button>
      </div>
    );
  }

  if (investment.done) {
    return (
      <div className="investbanner investbanner--ok" role="status">
        <span className="investbanner__text">{investment.done}</span>
      </div>
    );
  }

  return null;
}
