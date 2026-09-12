// Secciones 30 y 33: fuerza por dimensiones y calidad individual.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { Rng } from '../src/core/rng.ts';
import { DIMENSIONS } from '../src/domain/dimensions.ts';
import { buildAutomaticLineup } from '../src/domain/lineup.ts';
import { createPlayer, type Player } from '../src/domain/player.ts';
import { buildTacticalProfile, createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { computeTeamStrength, rateLineup } from '../src/ratings/team-strength.ts';
import { applyNumericalDisadvantage } from '../src/engine/live-team.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';

const context = { isHome: false, importance: 0.4, chemistry: 60 };

function strengthOf(team: Team, seed: string | number = 1) {
  const profile = buildTacticalProfile(team.tactics);
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const rated = rateLineup(lineup, profile, context, DEFAULT_CONFIG, new Rng(seed));
  return computeTeamStrength(team, lineup, profile, rated, DEFAULT_CONFIG);
}

function teamOf(target: number, formationId = '4-3-3', players?: readonly Player[]): Team {
  return createTeam({
    id: 'x', name: 'Equipo',
    players: players ?? buildSquad({ target, prefix: 'EQ', seed: 'fuerza' }),
    chemistry: 60,
    tactics: createTactics({ formationId }),
  });
}

test('el motor calcula las nueve dimensiones, no una media', () => {
  const s = strengthOf(teamOf(78));
  for (const dimension of DIMENSIONS) {
    const value = s.dimensions[dimension];
    assert.ok(Number.isFinite(value) && value >= 1 && value <= 100, `${dimension} = ${value}`);
  }
  const values = DIMENSIONS.map((d) => s.dimensions[d]);
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread > 4, 'las dimensiones tienen que diferenciarse entre si');
});

test('un equipo mejor tiene mejores dimensiones', () => {
  const good = strengthOf(teamOf(84));
  const poor = strengthOf(teamOf(66));
  for (const dimension of DIMENSIONS) {
    assert.ok(good.dimensions[dimension] > poor.dimensions[dimension], `${dimension}`);
  }
});

test('un delantero de clase levanta el ataque sin tocar la defensa (seccion 33)', () => {
  const base = buildSquad({ target: 76, prefix: 'EQ', seed: 'fuerza' });
  // El ejemplo de la especificacion: overall 90, definicion 94, posicionamiento 92.
  const star = createPlayer({
    id: base[9]?.id ?? 'star', name: 'Crack', position: 'DC',
    attributes: attributesFor('DC', 90, { definicion: 94, posicionamiento: 92 }),
  });
  const withStar = base.map((p) => (p.id === star.id ? star : p));

  const before = strengthOf(teamOf(76, '4-3-3', base));
  const after = strengthOf(teamOf(76, '4-3-3', withStar));

  assert.ok(after.dimensions.ataque > before.dimensions.ataque + 2, 'el ataque tiene que subir claramente');
  assert.ok(after.topFinisher > before.topFinisher + 8, 'el motor tiene que detectar al definidor');
  assert.ok(Math.abs(after.dimensions.defensa - before.dimensions.defensa) < 1.5, 'la defensa no cambia');
  assert.ok(
    after.keyPlayers.some((k) => k.player.id === star.id && k.role === 'goleador'),
    'el crack tiene que aparecer como jugador decisivo',
  );
});

test('a igual overall, el especialista mueve su area y no el resto', () => {
  // Mismo nivel general, distinto reparto: un 9 de 80 con definicion 94
  // convierte mejor, pero no hace mejor al equipo en todo.
  const base = buildSquad({ target: 78, prefix: 'EQ', seed: 'especialista' });
  const id = base[9]?.id ?? 'dc';
  const finisher = createPlayer({
    id, name: 'Definidor', position: 'DC',
    attributes: attributesFor('DC', 80, { definicion: 94, posicionamiento: 90 }),
  });
  const allRounder = createPlayer({
    id, name: 'Completo', position: 'DC', attributes: attributesFor('DC', 80),
  });

  const withFinisher = strengthOf(teamOf(78, '4-3-3', base.map((p) => (p.id === id ? finisher : p))));
  const withAllRounder = strengthOf(teamOf(78, '4-3-3', base.map((p) => (p.id === id ? allRounder : p))));

  assert.ok(withFinisher.topFinisher > withAllRounder.topFinisher + 2.5, 'el especialista define mejor');
  assert.ok(
    Math.abs(withFinisher.dimensions.mediocampo - withAllRounder.dimensions.mediocampo) < 1,
    'y eso no toca el mediocampo',
  );
});

test('el arquero define su propia dimension (seccion 45)', () => {
  const base = buildSquad({ target: 76, prefix: 'EQ', seed: 'arquero' });
  const elite = base.map((p, i) =>
    i === 0
      ? createPlayer({ id: p.id, name: 'Arquerazo', position: 'POR', attributes: attributesFor('POR', 91) })
      : p,
  );
  const weak = base.map((p, i) =>
    i === 0
      ? createPlayer({ id: p.id, name: 'Arquero flojo', position: 'POR', attributes: attributesFor('POR', 62) })
      : p,
  );
  const strongGk = strengthOf(teamOf(76, '4-3-3', elite));
  const weakGk = strengthOf(teamOf(76, '4-3-3', weak));

  assert.ok(strongGk.dimensions.arquero - weakGk.dimensions.arquero > 15);
  assert.ok(strongGk.goalkeeperRating - weakGk.goalkeeperRating > 20);
  assert.ok(Math.abs(strongGk.dimensions.ataque - weakGk.dimensions.ataque) < 1, 'el arquero no ataca');
});

test('la formacion redistribuye la fuerza del mismo plantel (seccion 31)', () => {
  const squad = buildSquad({ target: 78, prefix: 'EQ', seed: 'forma' });
  const attacking = strengthOf(teamOf(78, '4-3-3', squad));
  const defensive = strengthOf(teamOf(78, '5-3-2', squad));

  assert.ok(attacking.dimensions.presion > defensive.dimensions.presion, 'el 4-3-3 presiona mas');
  assert.ok(defensive.dimensions.defensa > attacking.dimensions.defensa, 'el 5-3-2 defiende mas');
  assert.ok(defensive.dimensions.contraataque > attacking.dimensions.contraataque, 'y sale mejor de contra');
});

test('la tactica mueve las dimensiones sin regalar nada', () => {
  const squad = buildSquad({ target: 78, prefix: 'EQ', seed: 'tact' });
  const offensive = strengthOf(
    createTeam({ id: 'a', name: 'A', players: squad, chemistry: 60, tactics: createTactics({ formationId: '4-4-2', mentality: 'muy ofensiva' }) }),
  );
  const defensive = strengthOf(
    createTeam({ id: 'b', name: 'B', players: squad, chemistry: 60, tactics: createTactics({ formationId: '4-4-2', mentality: 'muy defensiva' }) }),
  );
  assert.ok(offensive.dimensions.ataque > defensive.dimensions.ataque);
  assert.ok(defensive.dimensions.defensa > offensive.dimensions.defensa);
  const offensiveTotal = offensive.dimensions.ataque + offensive.dimensions.defensa;
  const defensiveTotal = defensive.dimensions.ataque + defensive.dimensions.defensa;
  assert.ok(Math.abs(offensiveTotal - defensiveTotal) < 1.5, 'la mentalidad reparte, no crea fuerza');
});

test('el motor detecta jugadores decisivos con su rol (seccion 33)', () => {
  const s = strengthOf(teamOf(80));
  assert.ok(s.keyPlayers.length >= 1 && s.keyPlayers.length <= 3);
  for (const key of s.keyPlayers) {
    assert.ok(['goleador', 'creador', 'lider defensivo', 'arquero'].includes(key.role));
  }
});

test('jugar con uno menos golpea el ataque mas que la defensa', () => {
  const s = strengthOf(teamOf(78));
  const down = applyNumericalDisadvantage(s, 1, DEFAULT_CONFIG);
  const attackLoss = s.dimensions.ataque - down.dimensions.ataque;
  const defenseLoss = s.dimensions.defensa - down.dimensions.defensa;
  assert.ok(attackLoss > defenseLoss, 'con diez se sufre mas arriba');
  assert.ok(attackLoss > 4, 'una expulsion tiene que doler');
});
