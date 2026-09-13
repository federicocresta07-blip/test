import { useMemo, useState, type ReactNode } from 'react';
import {
  EXPANSION_STEPS,
  MAX_TICKET_PRICE,
  MIN_TICKET_PRICE,
  REFERENCE_TICKET_PRICE,
  expansionCost,
  expansionUpkeep,
  expansionWeeks,
  matchRevenue,
} from '../../domain/stadium.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { InvestmentBanner } from '../components/club/InvestmentBanner.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { money, moneyShort, percent } from '../lib/format.ts';
import { momentumFrom, reputationOf } from '../lib/stadium-bridge.ts';
import { projectProgress } from '../models/index.ts';

/**
 * EL ESTADIO (seccion 9) — fase 6 del plan.
 *
 * LA CAPACIDAD Y LOS SOCIOS SON DATO REAL. Salen de `EQ003003.PKF`: River con
 * 76.687 de aforo y 63.000 socios, Platense con 12.657 y 7.500. La pantalla
 * muestra el aforo original aparte del de juego, asi que se ve qué es dato
 * histórico y qué construyó el manager.
 *
 * Lo que el manager decide acá son dos cosas, y las dos tienen filo:
 *
 * 1. EL PRECIO DE LA ENTRADA. Más caro recauda más por persona y puede
 *    recaudar menos en total. La pantalla muestra la curva completa para que
 *    la decisión se tome mirando, no adivinando.
 * 2. LA AMPLIACIÓN. Es la inversión más grande y más lenta del juego: la de
 *    10.000 asientos no entra en una temporada.
 */
export function StadiumPage(): ReactNode {
  const state = useGameState();
  const { investment, setTicketPrice, expandStadium, dismissInvestment } = useGame();
  const [draftPrice, setDraftPrice] = useState<number | null>(null);

  const stadium = state.stadium;
  const price = draftPrice ?? stadium.ticketPrice;
  const work = state.projects.find((project) => project.kind === 'estadio');

  /**
   * La curva de recaudación contra el precio.
   *
   * Se calcula con el MISMO modelo que cobra los partidos, contra el próximo
   * rival y con la posición y la racha de hoy. No es una ilustración: es la
   * cuenta que se va a hacer el domingo.
   */
  const curve = useMemo(() => {
    const own = { name: stadium.name, capacity: stadium.capacity, members: stadium.members };
    const nextFixture = state.fixtures.find((fixture) => fixture.score === null);
    const opponentId =
      nextFixture?.homeClubId === state.club.id
        ? nextFixture?.awayClubId
        : nextFixture?.homeClubId;
    const opponent = state.clubs.find((club) => club.id === opponentId);
    const row = state.table.find((entry) => entry.clubId === state.club.id);
    const position = state.table.findIndex((entry) => entry.clubId === state.club.id) + 1;

    // La reputación del rival sale de SU estadio: es lo que decide cuánta
    // gente arrastra. Acá había un error mío —calculaba la del rival con
    // nuestra propia capacidad y nuestros propios socios— que hacía que la
    // curva diera lo mismo contra Boca que contra Belgrano.
    const opponentReputation = opponentId ? reputationOf(opponentId) : 60;

    // Las condiciones del proximo partido. Son las mismas para toda la curva:
    // lo unico que se mueve entre barras es el precio.
    const conditions = {
      stadium: own,
      opponentReputation,
      position: position > 0 ? position : Math.ceil(state.table.length / 2) || 10,
      clubsInLeague: Math.max(2, state.table.length || 20),
      momentum: momentumFrom(row?.form ?? []),
      importance: 0.5,
    };

    // Once precios repartidos por el rango real, no una lista escrita a mano:
    // aca habia una lista de la escala vieja (5, 10, 15...) que despues del
    // cambio de escala quedaba entera por debajo del minimo, asi que las once
    // barras daban lo mismo y "el mejor precio" salia $5.
    const steps = 10;
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const value = Math.round(
        MIN_TICKET_PRICE + ((MAX_TICKET_PRICE - MIN_TICKET_PRICE) * index) / steps,
      );
      return { price: value, revenue: matchRevenue({ ...conditions, ticketPrice: value }) };
    });
    const best = points.reduce(
      (top, entry) => (entry.revenue.total > top.revenue.total ? entry : top),
      points[0] as (typeof points)[number],
    );
    const max = Math.max(...points.map((entry) => entry.revenue.total));
    return { points, best, max, conditions, opponentName: opponent?.shortName ?? null };
  }, [stadium, state.fixtures, state.table, state.clubs, state.club.id]);

  /**
   * La prevision del precio elegido, calculada con ESE precio.
   *
   * Antes tomaba el punto mas cercano de la curva, y mover el deslizador no
   * cambiaba nada hasta cruzar el punto medio entre dos barras: la pantalla
   * parecia muerta. La curva es para comparar; la prevision es exacta.
   */
  const current = {
    price,
    revenue: matchRevenue({ ...curve.conditions, ticketPrice: price }),
  };

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Capacidad"
          value={stadium.capacity.toLocaleString('es-AR')}
          hint={
            stadium.builtSeats > 0
              ? `${stadium.originalCapacity.toLocaleString('es-AR')} del archivo de 1998 más ${stadium.builtSeats.toLocaleString('es-AR')} que construiste`
              : `Aforo real de ${stadium.name} en 1998, del archivo del juego`
          }
        />
        <SummaryCell
          label="Socios"
          value={stadium.members.toLocaleString('es-AR')}
          hint="Dato del archivo. Son el piso de la asistencia y la cuota social, que es el ingreso más estable del club"
        />
        <SummaryCell
          label="Entrada"
          value={money(stadium.ticketPrice)}
          hint={`El mejor precio para el próximo partido sería ${money(curve.best.price)}`}
          {...(stadium.ticketPrice === curve.best.price ? { tone: 'ok' as const } : {})}
        />
        <SummaryCell
          label="Recaudación media"
          value={
            state.finances.averageGate > 0 ? moneyShort(state.finances.averageGate) : '—'
          }
          hint={
            stadium.gates.length > 0
              ? `Promedio de ${stadium.gates.length} ${stadium.gates.length === 1 ? 'partido' : 'partidos'} de local`
              : 'Todavía no jugaste de local'
          }
        />
      </div>

      <InvestmentBanner investment={investment} onDismiss={dismissInvestment} />

      <Panel
        title="El precio de la entrada"
        subtitle="Subirlo recauda más por persona y puede recaudar menos en total"
      >
        <div className="ticketpick">
          <div className="ticketpick__control">
            <input
              id="precio-entrada"
              className="ticketpick__range"
              type="range"
              min={MIN_TICKET_PRICE}
              max={MAX_TICKET_PRICE}
              step={1}
              value={price}
              onChange={(event) => setDraftPrice(Number(event.target.value))}
              aria-label="Precio de la entrada"
            />
            <div className="ticketpick__value">
              <strong className="tnum">{money(price)}</strong>
              <span className="muted">
                {price === REFERENCE_TICKET_PRICE ? 'precio de referencia' : ''}
              </span>
            </div>
            <Button
              size="sm"
              disabled={investment.pending || price === stadium.ticketPrice}
              onClick={() => {
                void setTicketPrice(price);
                setDraftPrice(null);
              }}
            >
              {price === stadium.ticketPrice ? 'Precio actual' : 'Fijar este precio'}
            </Button>
          </div>

          <div className="ticketpick__preview">
            <span className="ticketpick__previewlabel">
              Con este precio, el próximo partido
              {curve.opponentName ? ` contra ${curve.opponentName}` : ''}
            </span>
            <div className="ticketpick__stats">
              <Stat
                label="Asistencia"
                value={current.revenue.attendance.toLocaleString('es-AR')}
                detail={percent(current.revenue.occupancy)}
              />
              <Stat
                label="Entradas vendidas"
                value={current.revenue.ticketsSold.toLocaleString('es-AR')}
                detail="el socio no paga entrada"
              />
              <Stat label="Recaudación" value={moneyShort(current.revenue.total)} detail="para el club" />
            </div>
          </div>
        </div>

        <div className="pricecurve" role="img" aria-label="Recaudación según el precio de la entrada">
          {curve.points.map((entry) => {
            const height = curve.max > 0 ? entry.revenue.total / curve.max : 0;
            // La barra que marca donde esta el precio elegido es la mas
            // cercana: la prevision de arriba es exacta, esta es la referencia
            // visual.
            const isCurrent =
              curve.points.reduce(
                (closest, candidate) =>
                  Math.abs(candidate.price - price) < Math.abs(closest.price - price)
                    ? candidate
                    : closest,
                curve.points[0] as (typeof curve.points)[number],
              ).price === entry.price;
            const isBest = entry.price === curve.best.price;
            return (
              <div className="pricecurve__col" key={entry.price}>
                <div className="pricecurve__barwrap">
                  <div
                    className={[
                      'pricecurve__bar',
                      isBest ? 'is-best' : '',
                      isCurrent ? 'is-current' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ height: `${Math.max(3, height * 100)}%` }}
                    title={`${money(entry.price)} — ${moneyShort(entry.revenue.total)} con ${entry.revenue.attendance.toLocaleString('es-AR')} personas`}
                  />
                </div>
                <span className="pricecurve__price tnum">{entry.price}</span>
              </div>
            );
          })}
        </div>
        <p className="pricecurve__legend muted">
          Cada barra es un precio; la altura es lo que recaudaría el próximo partido. La curva tiene
          máximo: a partir de cierto precio entra tan poca gente que se recauda menos. El mejor
          precio depende del rival, de la posición y de la racha, así que cambia fecha a fecha.
        </p>
      </Panel>

      <Panel
        title="Ampliar el estadio"
        subtitle="La inversión más grande y más lenta del juego. Sube el techo de todo lo demás"
      >
        {work ? (
          <div className="stadiumwork">
            <div className="stadiumwork__head">
              <strong>{work.label}</strong>
              <Badge tone="accent">
                {work.weeksLeft} {work.weeksLeft === 1 ? 'semana' : 'semanas'} restantes
              </Badge>
            </div>
            <ProgressBar
              value={projectProgress(work)}
              label={`${Math.round(projectProgress(work) * 100)}% de la obra`}
            />
            <p className="muted">
              La obra avanza una semana por fecha jugada. Cuando termine, los asientos entran a la
              capacidad y empieza a correr su mantenimiento. No se puede encarar otra mientras esta
              siga en curso.
            </p>
          </div>
        ) : (
          <div className="expandgrid">
            {EXPANSION_STEPS.map((seats) => {
              const cost = expansionCost(seats, stadium.capacity);
              const weeks = expansionWeeks(seats);
              const affordable = state.finances.cash >= cost;
              return (
                <div className="expandcard" key={seats}>
                  <span className="expandcard__seats tnum">
                    +{seats.toLocaleString('es-AR')}
                  </span>
                  <span className="expandcard__to">
                    hasta {(stadium.capacity + seats).toLocaleString('es-AR')} de aforo
                  </span>
                  <dl className="expandcard__facts">
                    <div>
                      <dt>Costo</dt>
                      <dd className="tnum">{moneyShort(cost)}</dd>
                    </div>
                    <div>
                      <dt>Obra</dt>
                      <dd className="tnum">{weeks} semanas</dd>
                    </div>
                    <div>
                      <dt>Mantenimiento</dt>
                      <dd className="tnum">{moneyShort(expansionUpkeep(seats))}/mes</dd>
                    </div>
                  </dl>
                  <Button
                    size="sm"
                    variant={affordable ? 'primary' : 'ghost'}
                    disabled={!affordable || investment.pending}
                    onClick={() =>
                      void expandStadium(
                        seats,
                        `Empezó la ampliación de ${seats.toLocaleString('es-AR')} asientos`,
                      )
                    }
                  >
                    {affordable ? 'Encarar la obra' : 'No alcanza la caja'}
                  </Button>
                  {weeks > 19 && (
                    <span className="expandcard__warn">
                      No entra en una temporada de 19 fechas
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="Recaudación partido por partido"
        subtitle="Lo que entró de verdad, con el precio que estaba vigente ese día"
      >
        {stadium.gates.length === 0 ? (
          <EmptyState
            title="Todavía no jugaste de local"
            detail="La recaudación aparece acá después de cada partido en tu cancha."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Fecha</th>
                <th>Rival</th>
                <th style={{ textAlign: 'right' }}>Público</th>
                <th style={{ textAlign: 'right' }}>Ocupación</th>
                <th style={{ textAlign: 'right' }}>Entrada</th>
                <th style={{ textAlign: 'right' }}>Recaudación</th>
              </tr>
            </thead>
            <tbody>
              {stadium.gates.map((gate) => (
                <tr key={gate.round}>
                  <td className="tnum">{gate.round}ª</td>
                  <td>{gate.opponentName}</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>
                    {gate.attendance.toLocaleString('es-AR')}
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }}>
                    {percent(gate.occupancy)}
                  </td>
                  <td className="tnum muted" style={{ textAlign: 'right' }}>
                    {money(gate.ticketPrice)}
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }}>
                    {moneyShort(gate.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <Panel title="De dónde salen estos números">
        <div className="clubnotes">
          <p>
            <strong>La capacidad y los socios son dato real</strong>, del archivo de equipos de PC
            Apertura 98: {stadium.name} con {stadium.originalCapacity.toLocaleString('es-AR')} de
            aforo y {stadium.members.toLocaleString('es-AR')} socios. La reputación del club (
            {stadium.reputation}) se calcula de esos dos números, y con ella el reparto de
            televisión y el sponsor. Los socios pesan más que el aforo: una cancha grande y vacía no
            hace grande a un club.
          </p>
          <p>
            <strong>La asistencia es nuestro modelo</strong>, no un dato: no existe fuente de
            público partido por partido del Apertura 98. Arranca del piso de socios y encima suma
            gente que decide según el rival, la posición en la tabla, la racha, la importancia del
            partido y el precio. Y tiene un techo que no se discute: el aforo.
          </p>
          <p>
            <strong>El socio no paga entrada.</strong> Paga la cuota todos los meses y por eso
            entra. Es lo que hace que un club con muchos socios tenga ingreso estable y uno con
            pocos dependa de llenar la cancha.
          </p>
        </div>
      </Panel>
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

function Stat({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}): ReactNode {
  return (
    <div className="ticketstat">
      <span className="ticketstat__label">{label}</span>
      <strong className="ticketstat__value tnum">{value}</strong>
      <span className="ticketstat__detail muted">{detail}</span>
    </div>
  );
}
