import { useMemo, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { RatingBadge } from '../components/ui/Badge.tsx';
import { FormStrip } from '../components/dashboard/NextMatchCard.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { LEAGUE_CLUB_IDS, leagueTeams } from '../data/league.ts';
import { naturalOverall, teamStrengthOf } from '../lib/engine-bridge.ts';
import { outcomeOf, recordsOfClub, seasonTable } from '../lib/season-bridge.ts';
import { tacticsLabel } from '../lib/tactics-labels.ts';
import { decimal } from '../lib/format.ts';
import type { Dimension } from '../../domain/dimensions.ts';

/**
 * RIVALES (seccion 13) — fase 7 del plan.
 *
 * El perfil de un club del torneo: su plantel, su posicion, su forma, sus
 * fortalezas y sus debilidades.
 *
 * Las fortalezas no son etiquetas escritas a mano: salen de
 * `computeTeamStrength`, el mismo calculo de nueve dimensiones que el motor
 * usa para resolver los partidos (seccion 30). Si un club es fuerte de pelota
 * parada, es porque lo es cuando juega.
 */

/**
 * Nombre de cada una de las nueve dimensiones del motor.
 *
 * Se tipa contra `Dimension` a proposito: asi, si el motor agrega o renombra
 * una, el typecheck lo marca. La primera version tenia 'bandas' —que no
 * existe— y le faltaba 'presion', y el resultado era una etiqueta cruda en
 * pantalla.
 */
const DIMENSION_LABEL: Record<Dimension, string> = {
  ataque: 'Ataque',
  mediocampo: 'Mediocampo',
  defensa: 'Defensa',
  arquero: 'Arquero',
  fisico: 'Físico',
  creacion: 'Creación',
  presion: 'Presión',
  contraataque: 'Contraataque',
  balonParado: 'Pelota parada',
};

function labelOf(key: string): string {
  return DIMENSION_LABEL[key as Dimension] ?? key;
}

export function RivalsPage({ clubId }: { readonly clubId?: string | undefined }): ReactNode {
  const state = useGameState();
  const table = useMemo(() => seasonTable(state.season.records), [state.season.records]);
  const teams = useMemo(() => leagueTeams(), []);

  if (!clubId) {
    return (
      <div className="page">
        <Panel
          title="Rivales del torneo"
          subtitle="Los veinte clubes de Primera División. Cada perfil sale del mismo motor que juega los partidos"
          padded={false}
        >
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Club</th>
                <th style={{ width: 96 }}>Formación</th>
                <th style={{ width: 54, textAlign: 'right' }}>Ataque</th>
                <th style={{ width: 54, textAlign: 'right' }}>Medio</th>
                <th style={{ width: 54, textAlign: 'right' }}>Defensa</th>
                <th style={{ width: 96 }}>Forma</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const team = teams.get(row.clubId);
                const strength = team ? teamStrengthOf(team) : null;
                const club = clubById(row.clubId);
                return (
                  <tr key={row.clubId} className={row.clubId === state.club.id ? 'is-own' : ''}>
                    <td className="tnum secondary">{row.position}</td>
                    <td>
                      <span className="tablerow__club">
                        <ClubBadge club={club} size={20} />
                        <span className="truncate">{club.name}</span>
                      </span>
                    </td>
                    <td className="secondary tnum">{team?.tactics.formationId ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {strength ? <RatingBadge value={strength.dimensions.ataque} size="sm" /> : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {strength ? <RatingBadge value={strength.dimensions.mediocampo} size="sm" /> : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {strength ? <RatingBadge value={strength.dimensions.defensa} size="sm" /> : '—'}
                    </td>
                    <td>
                      <FormStrip form={row.form} />
                    </td>
                    <td>
                      <Link to={`/informacion/rivales/${row.clubId}`} className="fixturerow__link">
                        perfil →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </Panel>
      </div>
    );
  }

  if (!LEAGUE_CLUB_IDS.includes(clubId)) {
    return (
      <div className="page page--narrow">
        <Panel title="Rival">
          <EmptyState
            title="Ese club no juega este torneo"
            detail="Los clubes de Primera Nacional existen en el juego, pero su campeonato todavía no se simula."
            action={
              <Link to="/informacion/rivales">
                <Button variant="primary">Ver los rivales del torneo</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const club = clubById(clubId);
  const team = teams.get(clubId);
  const row = table.find((entry) => entry.clubId === clubId);
  const strength = team ? teamStrengthOf(team) : null;
  const history = recordsOfClub(state.season.records, clubId).slice(0, 6);

  // Fortalezas y debilidades: las tres dimensiones mas altas y las tres mas
  // bajas de las nueve que calcula el motor.
  const ranked = strength
    ? Object.entries(strength.dimensions)
        .map(([key, value]) => ({ key, value: value as number }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="page">
      <Panel
        title={club.name}
        subtitle={
          row
            ? `${row.position}º con ${row.points} ${row.points === 1 ? 'punto' : 'puntos'} · ${row.played} ${row.played === 1 ? 'fecha' : 'fechas'}`
            : 'Sin partidos jugados'
        }
        actions={
          <Link to="/informacion/rivales">
            <Button size="sm" variant="ghost">
              Ver todos
            </Button>
          </Link>
        }
      >
        <div className="rivalhead">
          <div className="rivalhead__identity">
            <ClubBadge club={club} size={56} />
            <div className="col">
              <span className="rivalhead__stadium">{club.stadiumName}</span>
              {team && (
                <span className="rivalhead__tactics">
                  {team.tactics.formationId} · {tacticsLabel.mentality(team.tactics.mentality)} ·{' '}
                  {tacticsLabel.passingStyle(team.tactics.passingStyle)} · presión{' '}
                  {tacticsLabel.level(team.tactics.pressing).toLowerCase()}
                </span>
              )}
              {row && <FormStrip form={row.form} />}
            </div>
          </div>

          {strength && (
            <div className="rivalhead__dims">
              {ranked.map((entry) => (
                <div className="rivaldim" key={entry.key}>
                  <span className="rivaldim__label">{labelOf(entry.key)}</span>
                  <div className="rivaldim__bar">
                    <span
                      className="rivaldim__fill"
                      style={{ width: `${Math.max(0, Math.min(100, entry.value))}%` }}
                    />
                  </div>
                  <span className="rivaldim__value tnum">{Math.round(entry.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {ranked.length >= 6 && (
          <p className="rivalverdict">
            Fuerte en{' '}
            <strong>
              {ranked
                .slice(0, 2)
                .map((entry) => labelOf(entry.key).toLowerCase())
                .join(' y ')}
            </strong>
            . Flojo en{' '}
            <strong>
              {ranked
                .slice(-2)
                .map((entry) => labelOf(entry.key).toLowerCase())
                .join(' y ')}
            </strong>
            . Los nueve valores los calcula <strong>computeTeamStrength</strong>, el mismo cálculo
            con el que el motor resuelve sus partidos.
          </p>
        )}
      </Panel>

      {history.length > 0 && (
        <Panel title="Últimos partidos">
          <div className="rivalhistory">
            {history.map((record) => {
              const rival = clubById(
                record.homeClubId === clubId ? record.awayClubId : record.homeClubId,
              );
              const result = outcomeOf(record, clubId);
              return (
                <Link
                  to={`/competicion/partido/${record.fixtureId}`}
                  key={record.fixtureId}
                  className="rivalhistory__row"
                >
                  <span className={`formstrip__dot is-${result}`}>{result}</span>
                  <span className="truncate">
                    {record.homeClubId === clubId ? 'vs' : 'en'} {rival.name}
                  </span>
                  <span className="tnum">
                    {record.homeGoals} — {record.awayGoals}
                  </span>
                  <span className="muted">Fecha {record.round}</span>
                </Link>
              );
            })}
          </div>
        </Panel>
      )}

      {team && (
        <Panel
          title="Plantel"
          subtitle={`${team.players.length} jugadores · cohesión ${team.chemistry}`}
          padded={false}
        >
          <DataTable>
            <thead>
              <tr>
                <th>Jugador</th>
                <th style={{ width: 50 }}>Pos</th>
                <th style={{ width: 44, textAlign: 'right' }}>Edad</th>
                <th style={{ width: 56, textAlign: 'right' }}>Overall</th>
                <th style={{ width: 56, textAlign: 'right' }}>Goles</th>
              </tr>
            </thead>
            <tbody>
              {[...team.players]
                .sort((a, b) => naturalOverall(b) - naturalOverall(a))
                .map((player) => {
                  const totals = state.season.totals[player.id];
                  return (
                    <tr key={player.id}>
                      <td className="truncate">{player.name}</td>
                      <td className="secondary">{player.position}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{player.age}</td>
                      <td style={{ textAlign: 'right' }}>
                        <RatingBadge value={naturalOverall(player)} size="sm" />
                      </td>
                      <td className="tnum" style={{ textAlign: 'right' }}>
                        {totals?.goals ? totals.goals : <span className="muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </DataTable>
        </Panel>
      )}

      <Panel title="De dónde salen estos datos">
        <div className="clubnotes">
          <p>
            El plantel y los atributos de este club los genera el mismo generador que usa la
            calibración del motor, de forma determinista: el club siempre tiene los mismos
            jugadores. Los nombres son inventados, como en todo el prototipo.
          </p>
          <p>
            Las nueve dimensiones de fuerza no son etiquetas puestas a mano: las calcula{' '}
            <strong>computeTeamStrength</strong> sobre el once que el motor pondría hoy. Si acá dice
            que es flojo de pelota parada, lo es cuando juega. Y en el partido, esas dimensiones se
            cruzan con las tuyas (sección 32 del motor), así que un rival fuerte por las bandas
            castiga distinto según con qué lo enfrentes. Promedio del plantel:{' '}
            <strong className="tnum">
              {decimal(
                team
                  ? team.players.reduce((total, player) => total + naturalOverall(player), 0) /
                      team.players.length
                  : 0,
                1,
              )}
            </strong>
            .
          </p>
        </div>
      </Panel>
    </div>
  );
}
