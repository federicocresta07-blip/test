// Seccion 43: las cinco etapas del motor, una por una.
// Y secciones 45, 46: arquero y balon parado.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { Rng } from '../src/core/rng.ts';
import { buildAutomaticLineup } from '../src/domain/lineup.ts';
import { buildTacticalProfile, createTactics, type Tactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { createPlayer, type Player } from '../src/domain/player.ts';
import { computeTeamStrength, rateLineup, type TeamStrength } from '../src/ratings/team-strength.ts';
import { resolveControl } from '../src/engine/control.ts';
import { creationIndex, denialIndex, resolveVolume } from '../src/engine/chance-volume.ts';
import {
  attackQualityIndex,
  boxDefenseIndex,
  createChance,
  resolveChanceMix,
} from '../src/engine/chances.ts';
import { goalProbability, resolveChance } from '../src/engine/conversion.ts';
import { resolveSetPieces } from '../src/engine/set-pieces.ts';
import { projectTeam, resultProbabilities } from '../src/engine/projection.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';

const context = { isHome: false, importance: 0.4, chemistry: 60 };
const NO_EFFECT = { control: 0, shotVolume: 0, chanceQuality: 0, counterBonus: 0, setPieceBonus: 0 };

function strengthOf(target: number, tactics: Partial<Tactics> = {}, players?: readonly Player[]): TeamStrength {
  const team: Team = createTeam({
    id: 'x', name: `Equipo ${target}`,
    players: players ?? buildSquad({ target, prefix: `E${target}`, seed: `etapas-${target}` }),
    chemistry: 60, tactics: createTactics(tactics),
  });
  const profile = buildTacticalProfile(team.tactics);
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const rated = rateLineup(lineup, profile, context, DEFAULT_CONFIG, new Rng('etapas'));
  return computeTeamStrength(team, lineup, profile, rated, DEFAULT_CONFIG);
}

// --- ETAPA 1 ---

test('etapa 1: la posesion siempre reparte el 100% y respeta los limites', () => {
  const combos: readonly [number, number][] = [[82, 60], [60, 82], [75, 75], [90, 55]];
  for (const [h, a] of combos) {
    const control = resolveControl(strengthOf(h), strengthOf(a), NO_EFFECT, NO_EFFECT, true, DEFAULT_CONFIG);
    assert.ok(Math.abs(control.homePossession + control.awayPossession - 1) < 1e-9);
    assert.ok(control.homePossession >= DEFAULT_CONFIG.control.possessionFloor);
    assert.ok(control.homePossession <= 1 - DEFAULT_CONFIG.control.possessionFloor);
  }
});

test('etapa 1: el mejor mediocampo maneja mas la pelota', () => {
  const strong = resolveControl(strengthOf(84), strengthOf(68), NO_EFFECT, NO_EFFECT, true, DEFAULT_CONFIG);
  const weak = resolveControl(strengthOf(68), strengthOf(84), NO_EFFECT, NO_EFFECT, true, DEFAULT_CONFIG);
  assert.ok(strong.homePossession > 0.55);
  assert.ok(weak.homePossession < 0.45);
});

test('etapa 1: tener la pelota no es lo mismo que ser mejor', () => {
  // Dos equipos iguales; uno juega a la posesion y el otro directo.
  const possession = strengthOf(78, { passingStyle: 'posesion', tempo: 'lento' });
  const direct = strengthOf(78, { passingStyle: 'directo', tempo: 'rapido' });
  const control = resolveControl(possession, direct, NO_EFFECT, NO_EFFECT, false, DEFAULT_CONFIG);
  assert.ok(control.homePossession > 0.53, 'el que quiere la pelota la tiene mas');
  // Pero el que juega directo no genera menos por ceder la pelota.
  const rng = new Rng('directo');
  const directVolume = resolveVolume(direct, possession, control.awayPossession, control.openness, NO_EFFECT, false, DEFAULT_CONFIG, rng);
  assert.ok(directVolume.expectedShots > 5, 'el juego directo tiene que seguir generando');
});

// --- ETAPA 2 ---

test('etapa 2: generar y evitar son cosas distintas', () => {
  const creative = strengthOf(80, { passingStyle: 'posesion', mentality: 'ofensiva' });
  const solid = strengthOf(80, { formationId: '5-3-2', mentality: 'defensiva' });
  assert.ok(creationIndex(creative) > creationIndex(solid), 'el ofensivo genera mas');
  assert.ok(denialIndex(solid) > denialIndex(creative), 'el defensivo evita mas');
});

test('etapa 2: mas ventaja ofensiva, mas remates', () => {
  const rng = new Rng('volumen');
  const good = resolveVolume(strengthOf(85), strengthOf(65), 0.5, 0.5, NO_EFFECT, false, DEFAULT_CONFIG, rng);
  const bad = resolveVolume(strengthOf(65), strengthOf(85), 0.5, 0.5, NO_EFFECT, false, DEFAULT_CONFIG, rng);
  assert.ok(good.edge > 0 && bad.edge < 0);
  assert.ok(good.expectedShots > bad.expectedShots * 1.2, `${good.expectedShots} vs ${bad.expectedShots}`);
});

test('etapa 2: los remates nunca se van de rango', () => {
  const rng = new Rng('rango');
  for (let i = 0; i < 2000; i += 1) {
    const v = resolveVolume(strengthOf(90), strengthOf(40), 0.72, 1, NO_EFFECT, true, DEFAULT_CONFIG, rng);
    assert.ok(v.shots >= DEFAULT_CONFIG.chances.minShots);
    assert.ok(v.shots <= DEFAULT_CONFIG.chances.maxShots);
  }
});

// --- ETAPA 3 ---

test('etapa 3: el reparto de ocasiones suma 1 y nunca es negativo', () => {
  for (const edge of [-30, -10, 0, 10, 30]) {
    const mix = resolveChanceMix(strengthOf(78), edge, DEFAULT_CONFIG);
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `suma ${total}`);
    for (const [kind, share] of Object.entries(mix)) assert.ok(share > 0, `${kind} = ${share}`);
  }
});

test('etapa 3: con mas ventaja ofensiva aparecen mas ocasiones claras', () => {
  const team = strengthOf(78);
  const weakEdge = resolveChanceMix(team, -20, DEFAULT_CONFIG);
  const strongEdge = resolveChanceMix(team, 20, DEFAULT_CONFIG);
  assert.ok(strongEdge.ocasionClara > weakEdge.ocasionClara, 'mas claras');
  assert.ok(strongEdge.remateLejano < weakEdge.remateLejano, 'menos remates de afuera');
});

test('etapa 3: atacar por las bandas produce mas cabezazos (seccion 32)', () => {
  const wings = resolveChanceMix(strengthOf(78, { attackFocus: 'bandas', width: 'ancho' }), 0, DEFAULT_CONFIG);
  const central = resolveChanceMix(strengthOf(78, { attackFocus: 'centro', width: 'estrecho' }), 0, DEFAULT_CONFIG);
  assert.ok(wings.cabezazo > central.cabezazo * 1.15, `${wings.cabezazo} vs ${central.cabezazo}`);
});

test('etapa 3: buscar la contra produce ocasiones de campo abierto', () => {
  const counter = resolveChanceMix(strengthOf(78, { formationId: '5-3-2', counterAttack: true }), 0, DEFAULT_CONFIG);
  const patient = resolveChanceMix(strengthOf(78, { formationId: '4-2-3-1', passingStyle: 'posesion' }), 0, DEFAULT_CONFIG);
  assert.ok(counter.contraataque > patient.contraataque);
});

test('etapa 3: atacar mejor que el rival da ocasiones mas claras', () => {
  const good = attackQualityIndex(strengthOf(86)) - boxDefenseIndex(strengthOf(64));
  const bad = attackQualityIndex(strengthOf(64)) - boxDefenseIndex(strengthOf(86));
  assert.ok(good > 0 && bad < 0);
});

test('etapa 3: el xG de cada tipo de ocasion respeta el orden futbolistico', () => {
  const team = strengthOf(78);
  const rng = new Rng('xg');
  const xgOf = (kind: Parameters<typeof createChance>[1]): number =>
    createChance('local', kind, team, NO_EFFECT, false, DEFAULT_CONFIG, rng).xg;
  const penalty = xgOf('penal');
  const clear = xgOf('ocasionClara');
  const good = xgOf('ocasionBuena');
  const longRange = xgOf('remateLejano');
  assert.ok(penalty > clear, 'un penal vale mas que una ocasion clara');
  assert.ok(clear > good, 'una ocasion clara vale mas que una buena');
  assert.ok(good > longRange, 'un remate de afuera es la peor ocasion');
  assert.ok(longRange > 0.01);
});

// --- ETAPA 4 ---

test('etapa 4: un gran definidor convierte mas la misma ocasion (seccion 33)', () => {
  const base = buildSquad({ target: 78, prefix: 'Conv', seed: 'conv' });
  const id = base[9]!.id;
  const withStar = base.map((p) =>
    p.id === id
      ? createPlayer({ id, name: 'Killer', position: 'DC', attributes: attributesFor('DC', 90, { remate: 94, calidad: 92 }) })
      : p,
  );
  const withPoor = base.map((p) =>
    p.id === id
      ? createPlayer({ id, name: 'Flojo', position: 'DC', attributes: attributesFor('DC', 62, { remate: 52 }) })
      : p,
  );

  const rng = new Rng('def');
  const defense = strengthOf(76);
  const star = strengthOf(78, {}, withStar);
  const poor = strengthOf(78, {}, withPoor);

  const starShooter = star.players.find((r) => r.player.id === id)!;
  const poorShooter = poor.players.find((r) => r.player.id === id)!;

  const starChance = createChance('local', 'ocasionBuena', star, NO_EFFECT, false, DEFAULT_CONFIG, rng, { shooter: starShooter });
  const poorChance = createChance('local', 'ocasionBuena', poor, NO_EFFECT, false, DEFAULT_CONFIG, rng, { shooter: poorShooter });

  const starP = goalProbability(starChance, defense, 1, 0, 1, DEFAULT_CONFIG);
  const poorP = goalProbability(poorChance, defense, 1, 0, 1, DEFAULT_CONFIG);
  assert.ok(starP > poorP * 1.25, `el crack tiene que convertir mas: ${starP} vs ${poorP}`);
});

test('etapa 4: un gran arquero baja la probabilidad de gol (seccion 45)', () => {
  const attack = strengthOf(78);
  const rng = new Rng('gk');
  const chance = createChance('local', 'ocasionBuena', attack, NO_EFFECT, false, DEFAULT_CONFIG, rng);

  const squad = buildSquad({ target: 74, prefix: 'GK', seed: 'gk' });
  const eliteGk = squad.map((p, i) =>
    i === 0 ? createPlayer({ id: p.id, name: 'Arquerazo', position: 'POR', attributes: attributesFor('POR', 91) }) : p,
  );
  const poorGk = squad.map((p, i) =>
    i === 0 ? createPlayer({ id: p.id, name: 'Flojo', position: 'POR', attributes: attributesFor('POR', 58) }) : p,
  );

  const elite = goalProbability(chance, strengthOf(74, {}, eliteGk), 1, 0, 1, DEFAULT_CONFIG);
  const poor = goalProbability(chance, strengthOf(74, {}, poorGk), 1, 0, 1, DEFAULT_CONFIG);
  assert.ok(poor > elite * 1.12, `el arquero tiene que pesar: ${elite} vs ${poor}`);
});

test('etapa 4: el arquero puede tener un dia extraordinario (seccion 45)', () => {
  const attack = strengthOf(78);
  const defense = strengthOf(78);
  const rng = new Rng('dia');
  const chance = createChance('local', 'ocasionBuena', attack, NO_EFFECT, false, DEFAULT_CONFIG, rng);
  const inspired = goalProbability(chance, defense, 0.75, 0, 1, DEFAULT_CONFIG);
  const normal = goalProbability(chance, defense, 1, 0, 1, DEFAULT_CONFIG);
  const bad = goalProbability(chance, defense, 1.25, 0, 1, DEFAULT_CONFIG);
  assert.ok(inspired < normal && normal < bad);
});

test('etapa 4: la probabilidad de gol nunca se sale de sus limites', () => {
  const rng = new Rng('limites');
  const attack = strengthOf(95);
  const defense = strengthOf(30);
  for (const kind of ['ocasionClara', 'ocasionBuena', 'remateLejano', 'cabezazo', 'contraataque', 'balonParado', 'tiroLibre', 'penal'] as const) {
    const chance = createChance('local', kind, attack, NO_EFFECT, true, DEFAULT_CONFIG, rng);
    const p = goalProbability(chance, defense, 1.4, 0, 1.2, DEFAULT_CONFIG);
    assert.ok(p > 0 && p <= DEFAULT_CONFIG.conversion.maxGoalProbability, `${kind}: ${p}`);
  }
});

test('etapa 4: el resultado del remate es coherente', () => {
  const rng = new Rng('remate');
  const attack = strengthOf(80);
  const defense = strengthOf(76);
  for (let i = 0; i < 3000; i += 1) {
    const chance = createChance('local', 'ocasionBuena', attack, NO_EFFECT, false, DEFAULT_CONFIG, rng);
    const outcome = resolveChance(chance, defense, 1, 0, 1, DEFAULT_CONFIG, rng);
    if (outcome.goal) {
      assert.ok(outcome.onTarget && !outcome.saved && !outcome.corner, 'un gol va al arco y no es atajada');
    }
    if (outcome.saved) assert.ok(outcome.onTarget, 'solo se ataja lo que va al arco');
    if (outcome.corner) assert.ok(!outcome.onTarget, 'el corner sale de un remate desviado o rechazado');
  }
});

test('etapa 4: la conversion media queda en valores de futbol', () => {
  const rng = new Rng('conversion');
  const attack = strengthOf(72);
  const defense = strengthOf(72);
  let shots = 0;
  let goals = 0;
  let xg = 0;
  const mix = resolveChanceMix(attack, 0, DEFAULT_CONFIG);
  const kinds = Object.keys(mix) as (keyof typeof mix)[];
  const weights = kinds.map((k) => mix[k]);
  for (let i = 0; i < 20_000; i += 1) {
    const kind = kinds[rng.weightedIndex(weights)]!;
    const chance = createChance('local', kind, attack, NO_EFFECT, false, DEFAULT_CONFIG, rng);
    xg += chance.xg;
    shots += 1;
    if (resolveChance(chance, defense, 1, 0, 1, DEFAULT_CONFIG, rng).goal) goals += 1;
  }
  const conversion = goals / shots;
  assert.ok(conversion > 0.07 && conversion < 0.15, `conversion ${(conversion * 100).toFixed(1)}%`);
  assert.ok(Math.abs(xg / shots - conversion) < 0.02, 'el xG tiene que predecir los goles');
});

// --- BALON PARADO (seccion 46) ---

test('un equipo especialista en balon parado genera mas peligro con la pelota quieta', () => {
  const rng = new Rng('bp');
  const specialists = buildSquad({ target: 78, prefix: 'BP', seed: 'bp' }).map((p) =>
    createPlayer({
      id: p.id, name: p.name, position: p.position,
      attributes: attributesFor(p.position, 78, { agresividad: 89, pase: 90, tiro: 92 }),
    }),
  );
  const expert = strengthOf(78, { setPieceFocus: true }, specialists);
  const plain = strengthOf(78, { setPieceFocus: false });
  const rival = strengthOf(76);

  assert.ok(expert.dimensions.balonParado > plain.dimensions.balonParado + 5);

  const count = (team: TeamStrength): number => {
    let total = 0;
    for (let i = 0; i < 400; i += 1) {
      total += resolveSetPieces('local', team, rival, 0, 11, DEFAULT_CONFIG, rng).chances.length;
    }
    return total / 400;
  };
  assert.ok(count(expert) > count(plain), 'el especialista tiene que generar mas remates de balon parado');
});

test('los corners y los penales salen en cantidades razonables (secciones 46, 50)', () => {
  const rng = new Rng('corners');
  const team = strengthOf(78);
  const rival = strengthOf(78);
  let corners = 0;
  let penalties = 0;
  const runs = 3000;
  for (let i = 0; i < runs; i += 1) {
    const outcome = resolveSetPieces('local', team, rival, 0, 11, DEFAULT_CONFIG, rng);
    corners += outcome.corners;
    penalties += outcome.penalties;
  }
  assert.ok(corners / runs > 2.5 && corners / runs < 8, `corners ${corners / runs}`);
  assert.ok(penalties / runs > 0.03 && penalties / runs < 0.3, `penales ${penalties / runs}`);
});

// --- MODELO PROBABILISTICO (seccion 44) ---

test('la proyeccion de goles esperados es sensata', () => {
  const strong = strengthOf(84);
  const weak = strengthOf(66);
  const good = projectTeam(strong, weak, 13, 15, NO_EFFECT, true, DEFAULT_CONFIG);
  const poor = projectTeam(weak, strong, 9, -15, NO_EFFECT, false, DEFAULT_CONFIG);
  assert.ok(good.expectedGoals > poor.expectedGoals * 1.5);
  assert.ok(good.expectedGoals > 0.5 && good.expectedGoals < 5);
  assert.ok(good.expectedSetPieceShots > 0, 'el balon parado tiene que aportar');
});

test('las probabilidades de resultado suman 1 y ordenan bien', () => {
  const even = resultProbabilities(1.4, 1.4);
  assert.ok(Math.abs(even.homeWin + even.draw + even.awayWin - 1) < 1e-6);
  assert.ok(Math.abs(even.homeWin - even.awayWin) < 1e-6, 'con goles iguales tiene que ser simetrico');

  const favourite = resultProbabilities(2.2, 0.9);
  assert.ok(favourite.homeWin > favourite.awayWin);
  assert.ok(favourite.awayWin > 0.02, 'la sorpresa nunca es imposible');

  const goalless = resultProbabilities(0.4, 0.4);
  assert.ok(goalless.draw > even.draw, 'con menos goles hay mas empates');
});
