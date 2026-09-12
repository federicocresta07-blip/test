import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Button } from '../ui/Button.tsx';
import { Link } from '../../router/router.tsx';
import { useGameState } from '../../state/GameProvider.tsx';
import { moneyShort, signed } from '../../lib/format.ts';

/**
 * FINANZAS (secciones 5.5, 12).
 *
 * Resumen deportivo, no contable: caja, presupuesto, masa salarial y el
 * balance del mes. El detalle por rubro es la fase 6.
 */
export function FinanceWidget(): ReactNode {
  const { finances } = useGameState();
  const balance = finances.monthlyIncome - finances.monthlyExpenses;
  const wageShare = finances.wageBill / Math.max(1, finances.monthlyExpenses);

  return (
    <Panel
      title="Finanzas"
      actions={
        <Link to="/club/finanzas">
          <Button size="sm" variant="ghost">
            Detalle
          </Button>
        </Link>
      }
    >
      <div className="financegrid">
        <FinanceCell label="Caja" value={moneyShort(finances.cash)} emphasis />
        <FinanceCell label="Presupuesto fichajes" value={moneyShort(finances.transferBudget)} />
        <FinanceCell label="Ingresos del mes" value={moneyShort(finances.monthlyIncome)} tone="ok" />
        <FinanceCell label="Gastos del mes" value={moneyShort(finances.monthlyExpenses)} tone="danger" />
      </div>

      <div className="financebalance">
        <div className="row row--between">
          <span className="label">Balance mensual</span>
          <span
            className="tnum"
            style={{
              color: balance >= 0 ? 'var(--ok)' : 'var(--danger)',
              fontWeight: 'var(--fw-semibold)',
            }}
          >
            {signed(balance / 1_000_000, 1)} M
          </span>
        </div>
        <div className="financewages">
          <div className="row row--between">
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Masa salarial sobre los gastos
            </span>
            <span className="tnum secondary" style={{ fontSize: 'var(--fs-xs)' }}>
              {Math.round(wageShare * 100)}%
            </span>
          </div>
          <ProgressBar
            value={wageShare}
            tone={wageShare > 0.7 ? 'danger' : wageShare > 0.55 ? 'warn' : 'accent'}
            label={`${moneyShort(finances.wageBill)} de salarios`}
          />
        </div>
      </div>
    </Panel>
  );
}

function FinanceCell({
  label,
  value,
  tone,
  emphasis = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'ok' | 'danger';
  readonly emphasis?: boolean;
}): ReactNode {
  return (
    <div className="financecell">
      <span className="label">{label}</span>
      <span
        className={`financecell__value tnum ${emphasis ? 'is-emphasis' : ''}`}
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
