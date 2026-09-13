import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { LEAGUE_CLUBS, clubStrength } from '../data/league.ts';
import { apertura98Club } from '../../data/apertura98.ts';
import { clubSquad } from '../data/squad.ts';
import { gameService } from '../services/index.ts';

/**
 * ELEGIR EQUIPO, una sola vez.
 *
 * Aparece la primera vez que alguien entra y no vuelve a aparecer: el club es
 * la carrera. Por eso la pantalla pide una confirmación explícita en lugar de
 * empezar con el primer clic, y por eso dice el nivel de cada plantel: elegir
 * Platense y elegir River son dos juegos distintos, y quien elige tiene que
 * saberlo ANTES.
 *
 * Los veinte clubes son los del Apertura 1998 con sus planteles reales del
 * archivo: el que elige Boca dirige a Riquelme y a Palermo.
 */
export function TeamPickerPage({
  nombre,
  onChosen,
}: {
  /** Cómo se llama quien está eligiendo, para saludarlo. */
  readonly nombre: string | null;
  readonly onChosen: () => void;
}): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ordenados por nivel de plantel, de mayor a menor. No alfabético a
  // propósito: el orden ES la información que hace falta para elegir.
  const clubs = useMemo(
    () =>
      LEAGUE_CLUBS.map((club) => {
        const archive = apertura98Club(club.id);
        return {
          club,
          strength: clubStrength(club.id),
          squad: clubSquad(club.id).length,
          stadium: archive.stadium ?? club.stadiumName,
          capacity: archive.capacity ?? 0,
        };
      }).sort((a, b) => b.strength - a.strength),
    [],
  );

  const chosen = clubs.find((entry) => entry.club.id === selected) ?? null;

  async function confirm(): Promise<void> {
    if (selected === null || pending) return;
    setPending(true);
    setError(null);
    try {
      await gameService.chooseTeam(selected);
      onChosen();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo elegir el club');
      setPending(false);
    }
  }

  return (
    <div className="picker">
      <header className="picker__head">
        <p className="picker__kicker">{nombre ? `Hola, ${nombre}` : 'Apertura 1998'}</p>
        <h1 className="picker__title">Elegí tu club</h1>
        <p className="picker__detail">
          Se elige una vez y es para toda la carrera. Los veinte planteles son los reales
          del Apertura 1998; el nivel es el del mejor once que permite cada uno.
        </p>
      </header>

      <ul className="picker__grid">
        {clubs.map((entry) => {
          const active = entry.club.id === selected;
          return (
            <li key={entry.club.id}>
              <button
                type="button"
                className={`picker__club${active ? ' picker__club--active' : ''}`}
                // El id del club, para poder elegir uno concreto desde un
                // test sin depender de su nombre corto ni de su posición.
                data-club={entry.club.id}
                aria-pressed={active}
                onClick={() => setSelected(entry.club.id)}
              >
                <ClubBadge club={entry.club} size={40} />
                <span className="picker__name">{entry.club.shortName}</span>
                <span className="picker__meta">
                  <span className="picker__strength">{entry.strength}</span>
                  <span className="picker__players">{entry.squad} jug.</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="picker__foot">
        {chosen !== null ? (
          <div className="picker__chosen">
            <p className="picker__chosenName">{chosen.club.name}</p>
            <p className="picker__chosenDetail">
              {chosen.stadium}
              {chosen.capacity > 0 ? ` · ${chosen.capacity.toLocaleString('es-AR')} localidades` : ''}
              {` · nivel ${chosen.strength}`}
            </p>
          </div>
        ) : (
          <p className="picker__chosenDetail">Elegí un club para empezar.</p>
        )}

        {error !== null ? (
          <p className="picker__error" role="alert">
            {error}
          </p>
        ) : null}

        <Button variant="primary" onClick={confirm} disabled={selected === null || pending}>
          {pending ? 'Empezando…' : 'Dirigir este club'}
        </Button>
      </footer>
    </div>
  );
}
