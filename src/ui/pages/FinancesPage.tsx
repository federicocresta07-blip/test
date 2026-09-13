import { type ReactNode } from 'react';
import { MATCHES_PER_MONTH } from '../../domain/finances.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { money, moneyShort, percent } from '../lib/format.ts';

/**
 * FINANZAS DEL CLUB (secciones 9 y 12) — fase 6 del plan.
 *
 * NINGUNA LÍNEA DE ESTA PANTALLA ES UN NÚMERO ESCRITO A MANO. Cada una trae de
 * dónde sale, y eso no es decorado: es la regla que hace que el juego no pueda
 * mentir. Hasta esta fase las finanzas eran cinco constantes, y se podía
 * vender a medio plantel sin que la masa salarial se moviera.
 *
 * Las cuentas están en `domain/finances.ts`. Acá solo se muestran.
 */
export function FinancesPage(): ReactNode {
  const state = useGameState();
  const finances = state.finances;
  const positive = finances.balance >= 0;
  const wageAlert = finances.wageShare > 0.9;

  // La escala de las barras: la línea más grande del balance, para que
  // ingresos y gastos se puedan comparar a simple vista.
  const scale = Math.max(
    ...finances.income.map((line) => line.monthly),
    ...finances.expenses.map((line) => Math.abs(line.monthly)),
    1,
  );

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Caja"
          value={moneyShort(finances.cash)}
          hint="Lo que hay hoy: la caja inicial más lo que entró por la puerta y por ventas, menos obras y fichajes"
        />
        <SummaryCell
          label="Balance mensual"
          value={`${positive ? '+' : '−'}${moneyShort(Math.abs(finances.balance))}`}
          tone={positive ? 'ok' : 'warn'}
          hint={positive ? 'El club gana plata cada mes' : 'El club pierde plata cada mes'}
        />
        <SummaryCell
          label="Presupuesto de fichajes"
          value={moneyShort(finances.transferBudget)}
          hint="Derivado: la caja menos un colchón de mes y medio de gastos, más parte de lo que el club va a generar"
        />
        <SummaryCell
          label="Masa salarial"
          value={`${moneyShort(finances.wageBill)}/mes`}
          {...(wageAlert ? { tone: 'warn' as const } : {})}
          hint={`${percent(finances.wageShare)} de lo que el club gana se va en sueldos`}
        />
      </div>

      {wageAlert && (
        <Panel title="Los sueldos se están comiendo el club">
          <div className="clubnotes">
            <p>
              El <strong>{percent(finances.wageShare)}</strong> de lo que entra se va en sueldos.
              Con esa proporción no queda margen para obras ni para fichar: cada contrato nuevo
              empuja el balance más abajo. Se arregla vendiendo o llenando la cancha.
            </p>
          </div>
        </Panel>
      )}

      <div className="ledgerpair">
        <Panel
          title="Ingresos"
          subtitle={`${moneyShort(finances.monthlyIncome)} por mes`}
        >
          <ul className="ledger">
            {finances.income.map((line) => (
              <LedgerRow
                key={line.id}
                label={line.label}
                amount={line.monthly}
                source={line.source}
                scale={scale}
                tone="in"
              />
            ))}
          </ul>
        </Panel>

        <Panel
          title="Gastos"
          subtitle={`${moneyShort(finances.monthlyExpenses)} por mes`}
        >
          <ul className="ledger">
            {finances.expenses.map((line) => (
              <LedgerRow
                key={line.id}
                label={line.label}
                amount={Math.abs(line.monthly)}
                source={line.source}
                scale={scale}
                tone="out"
              />
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="El balance del mes"
        subtitle="Ingresos contra gastos, con todo lo de arriba sumado"
      >
        <div className="balancebar">
          <div className="balancebar__row">
            <span className="balancebar__label">Ingresos</span>
            <ProgressBar
              value={finances.monthlyIncome / Math.max(finances.monthlyIncome, finances.monthlyExpenses, 1)}
              label={`Ingresos ${moneyShort(finances.monthlyIncome)}`}
            />
            <span className="balancebar__value tnum">{moneyShort(finances.monthlyIncome)}</span>
          </div>
          <div className="balancebar__row">
            <span className="balancebar__label">Gastos</span>
            <ProgressBar
              value={finances.monthlyExpenses / Math.max(finances.monthlyIncome, finances.monthlyExpenses, 1)}
              tone={positive ? 'accent' : 'danger'}
              label={`Gastos ${moneyShort(finances.monthlyExpenses)}`}
            />
            <span className="balancebar__value tnum">{moneyShort(finances.monthlyExpenses)}</span>
          </div>
          <div className={`balancebar__total ${positive ? 'is-ok' : 'is-warn'}`}>
            <span>Resultado del mes</span>
            <strong className="tnum">
              {positive ? '+' : '−'}
              {money(Math.abs(Math.round(finances.balance)))}
            </strong>
          </div>
        </div>
      </Panel>

      <Panel
        title="El estadio es la palanca"
        subtitle="La recaudación es el único ingreso que el manager mueve semana a semana"
        actions={
          <Link to="/club/estadio">
            <Button size="sm" variant="ghost">
              Ir al estadio
            </Button>
          </Link>
        }
      >
        <div className="financenote">
          <div className="financenote__facts">
            <Fact
              label="Socios"
              value={state.stadium.members.toLocaleString('es-AR')}
              detail="dato del archivo de 1998"
            />
            <Fact
              label="Entrada"
              value={money(state.stadium.ticketPrice)}
              detail="tu decisión"
            />
            <Fact
              label="Recaudación media"
              value={
                finances.averageGate > 0 ? moneyShort(finances.averageGate) : 'sin partidos'
              }
              detail={`se cuentan ${MATCHES_PER_MONTH} partidos de local por mes`}
            />
            <Fact
              label="Reputación"
              value={String(state.stadium.reputation)}
              detail="de los socios y el aforo; define TV y sponsor"
            />
          </div>
          <p className="muted">
            La cuota social y la televisión entran todos los meses y el manager casi no las mueve.
            Lo que sí mueve es la cancha: llenarla depende del precio que cobre, de cómo vaya el
            equipo y de contra quién juegue. Por eso el balance de un club chico depende del
            resultado deportivo mucho más que el de uno grande.
          </p>
        </div>
      </Panel>

      <Panel title="De dónde sale cada número">
        <div className="clubnotes">
          <p>
            Hasta la fase 6 esta pantalla no existía y las finanzas eran{' '}
            <strong>cinco constantes escritas a mano</strong>: caja, presupuesto, masa salarial,
            ingreso y gasto mensual. El problema no era que estuvieran mal, era que no podían estar
            bien: se podía ampliar el estadio y el ingreso no se movía, o vender a medio plantel y
            el presupuesto de fichajes quedaba igual.
          </p>
          <p>
            Ahora lo único escrito a mano es <strong>la caja con la que arranca el club</strong>,
            que es el punto de partida de la partida y no se puede calcular de nada. Todo lo demás
            se deriva: los sueldos son la suma de los contratos del plantel y del cuerpo técnico, el
            mantenimiento sale del nivel de cada instalación, la recaudación de los partidos que
            realmente se jugaron de local, y la televisión y el sponsor de la reputación, que sale
            de los socios y el aforo que trae el archivo.
          </p>
          <p>
            Por eso cada línea de arriba dice de dónde viene. Si alguna no lo dijera, sería un
            número inventado.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function LedgerRow({
  label,
  amount,
  source,
  scale,
  tone,
}: {
  readonly label: string;
  readonly amount: number;
  readonly source: string;
  readonly scale: number;
  readonly tone: 'in' | 'out';
}): ReactNode {
  return (
    <li className="ledger__row">
      <div className="ledger__head">
        <span className="ledger__label">{label}</span>
        <span className="ledger__amount tnum">{moneyShort(amount)}</span>
      </div>
      <div className="ledger__barwrap">
        <div
          className={`ledger__bar ledger__bar--${tone}`}
          style={{ width: `${Math.max(1, (amount / scale) * 100)}%` }}
        />
      </div>
      <span className="ledger__source muted">{source}</span>
    </li>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}): ReactNode {
  return (
    <div className="financefact">
      <span className="financefact__label">{label}</span>
      <strong className="financefact__value tnum">{value}</strong>
      <span className="financefact__detail muted">{detail}</span>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: 'ok' | 'warn';
}): ReactNode {
  return (
    <div className={`clubsummary__cell ${tone ? `is-${tone}` : ''}`}>
      <span className="clubsummary__label">{label}</span>
      <strong className="clubsummary__value tnum">{value}</strong>
      {hint && <span className="clubsummary__hint">{hint}</span>}
    </div>
  );
}
