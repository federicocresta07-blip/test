import { useState, type ReactNode } from 'react';
import { Button } from '../ui/Button.tsx';
import { Modal } from '../ui/Modal.tsx';
import { money, moneyShort } from '../../lib/format.ts';
import { ReportedOverall, ReportedPotential, ReportedValue } from './PlayerReport.tsx';
import { clubById } from '../../data/clubs.ts';
import type { MarketPlayer } from '../../lib/market-bridge.ts';
import type { OfferOutcome } from '../../services/types.ts';

/**
 * OFERTAR POR UN JUGADOR (seccion 11 — fase 5).
 *
 * Muestra lo que el club SABE del jugador —el informe, no la verdad— y deja
 * poner un numero. El club vendedor responde por calculo, en el acto.
 *
 * Los atajos de monto van sobre el valor INFORMADO, que es el unico que el
 * club conoce. Con un secretario tecnico flojo, "ofrecer el valor de mercado"
 * puede quedar 30% corto, y eso es parte del juego.
 */
export function OfferDialog({
  target,
  cash,
  pending,
  outcome,
  onSend,
  onClose,
}: {
  readonly target: MarketPlayer;
  readonly cash: number;
  readonly pending: boolean;
  readonly outcome: OfferOutcome | null;
  readonly onSend: (amount: number) => void;
  readonly onClose: () => void;
}): ReactNode {
  const [amount, setAmount] = useState(target.appraisal.value);
  const club = clubById(target.clubId);
  const affordable = amount <= cash;

  return (
    <Modal
      open
      title={`Ofertar por ${target.name}`}
      onClose={onClose}
      footer={
        outcome ? (
          <Button variant="primary" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => onSend(amount)}
              disabled={pending || !affordable || amount <= 0}
              title={affordable ? undefined : 'No hay caja suficiente'}
            >
              {pending ? 'Enviando…' : 'Enviar oferta'}
            </Button>
          </>
        )
      }
    >
      <div className="offerdialog">
        <p className="offerdialog__who">
          {club.name} · {target.position} · {target.age} años
        </p>

        {/* Lo que el club sabe de el. */}
        <dl className="offerdialog__report">
          <div>
            <dt>Nivel estimado</dt>
            <dd>
              <ReportedOverall appraisal={target.appraisal} />
            </dd>
          </div>
          <div>
            <dt>Techo estimado</dt>
            <dd>
              <ReportedPotential appraisal={target.appraisal} />
            </dd>
          </div>
          <div>
            <dt>Valor tasado</dt>
            <dd>
              <ReportedValue appraisal={target.appraisal} />
            </dd>
          </div>
          <div>
            <dt>Salario que pide</dt>
            <dd className="tnum">{moneyShort(target.appraisal.wage)}/mes</dd>
          </div>
        </dl>

        <p className="offerdialog__context">
          {target.listed
            ? `${club.name} lo puso en la lista de transferibles: va a escuchar ofertas razonables.`
            : target.need > 0.7
              ? `${club.name} lo necesita: es titular y no tiene recambio claro en ese puesto. Van a pedir bastante más que su valor.`
              : `${club.name} tiene alternativas en ese puesto, así que se puede negociar.`}
        </p>

        {outcome ? (
          <div className={`offerdialog__answer is-${outcome.verdict}`} role="status">
            <span className="offerdialog__verdict">
              {outcome.verdict === 'aceptada'
                ? 'Aceptaron'
                : outcome.verdict === 'contraoferta'
                  ? `Contraofertan ${moneyShort(outcome.counter ?? 0)}`
                  : 'Rechazaron'}
            </span>
            <p className="offerdialog__reason">“{outcome.reason}”</p>
            {outcome.closed && (
              <p className="offerdialog__closed">
                {target.name} ya es jugador tuyo. Está en el plantel y puede jugar la próxima fecha.
              </p>
            )}
          </div>
        ) : (
          <div className="offerdialog__form">
            <label className="offerdialog__label" htmlFor="offer-amount">
              Tu oferta
            </label>
            <input
              id="offer-amount"
              className="offerdialog__input tnum"
              type="number"
              min={0}
              step={100_000}
              value={amount}
              onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))}
            />
            <span className="offerdialog__hint">{money(amount)}</span>

            <div className="offerdialog__shortcuts">
              {(
                [
                  ['70% del valor', 0.7],
                  ['Valor tasado', 1],
                  ['+20%', 1.2],
                  ['+50%', 1.5],
                ] as const
              ).map(([label, factor]) => (
                <button
                  key={label}
                  className="offerdialog__shortcut"
                  onClick={() => setAmount(Math.round(target.appraisal.value * factor))}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className={`offerdialog__cash ${affordable ? '' : 'is-short'}`}>
              {affordable
                ? `En caja hay ${moneyShort(cash)}. Te quedarían ${moneyShort(cash - amount)}.`
                : `En caja hay ${moneyShort(cash)}: faltan ${moneyShort(amount - cash)}.`}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
