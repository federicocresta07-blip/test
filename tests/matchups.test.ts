// Seccion 32: los cruces tacticos se miden entre si.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { Rng } from '../src/core/rng.ts';
import { buildAutomaticLineup } from '../src/domain/lineup.ts';
import { buildTacticalProfile, createTactics, type Tactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { computeTeamStrength, rateLineup, type TeamStrength } from '../src/ratings/team-strength.ts';
import { resolveMatchups } from '../src/engine/tactical-matchups.ts';
import { buildSquad } from '../src/data/squad-builder.ts';
import { createPlayer } from '../src/domain/player.ts';
import { attributesFor } from '../src/data/squad-builder.ts';

const context = { isHome: false, importance: 0.4, chemistry: 60 };
const squad = (prefix: string, target = 78) => buildSquad({ target, prefix, seed: `${prefix}-cruce` });

function strength(name: string, tactics: Partial<Tactics>, target = 78, players = squad(name, target)): TeamStrength {
  const team: Team = createTeam({
    id: name, name, players, chemistry: 60, tactics: createTactics(tactics),
  });
  const profile = buildTacticalProfile(team.tactics);
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const rated = rateLineup(lineup, profile, context, DEFAULT_CONFIG, new Rng('cruce'));
  return computeTeamStrength(team, lineup, profile, rated, DEFAULT_CONFIG);
}

const HIGH_PRESS: Partial<Tactics> = { formationId: '4-3-3', pressing: 'alta', defensiveLine: 'alta', tempo: 'rapido', passingStyle: 'mixto' };
const SLOW_POSSESSION: Partial<Tactics> = { formationId: '4-2-3-1', pressing: 'media', passingStyle: 'posesion', tempo: 'lento' };
const DIRECT_COUNTER: Partial<Tactics> = { formationId: '5-3-2', pressing: 'baja', passingStyle: 'directo', counterAttack: true, defensiveLine: 'baja' };
const LOW_BLOCK: Partial<Tactics> = { formationId: '5-3-2', mentality: 'muy defensiva', pressing: 'baja', defensiveLine: 'baja', width: 'estrecho' };
const CENTRAL_ATTACK: Partial<Tactics> = { formationId: '4-2-3-1', attackFocus: 'centro', width: 'estrecho', mentality: 'ofensiva' };
const WING_ATTACK: Partial<Tactics> = { formationId: '4-3-3', attackFocus: 'bandas', width: 'ancho', mentality: 'ofensiva' };

test('la presion alta le gana el control a la salida en posesion lenta', () => {
  const press = strength('Presion', HIGH_PRESS);
  const slow = strength('Posesion', SLOW_POSSESSION);
  const outcome = resolveMatchups(press, slow, DEFAULT_CONFIG);
  assert.ok(outcome.home.control > 0.3, `el que presiona deberia ganar control: ${outcome.home.control}`);
  assert.ok(outcome.home.control > outcome.away.control);
  assert.ok(outcome.homeNotes.length > 0, 'el cruce tiene que quedar explicado');
});

test('pero la presion alta sufre contra el juego directo y la contra', () => {
  const press = strength('Presion', HIGH_PRESS);
  const direct = strength('Directo', DIRECT_COUNTER);
  const outcome = resolveMatchups(press, direct, DEFAULT_CONFIG);
  assert.ok(outcome.away.counterBonus > 0.02, `el directo deberia sacar ventaja en la contra: ${outcome.away.counterBonus}`);
  assert.ok(outcome.away.counterBonus > outcome.home.counterBonus);
});

test('el bloque cerrado tapa el ataque central', () => {
  const block = strength('Bloque', LOW_BLOCK);
  const central = strength('Central', CENTRAL_ATTACK);
  const outcome = resolveMatchups(block, central, DEFAULT_CONFIG);
  assert.ok(outcome.away.chanceQuality < -0.01, `al que ataca por el medio le tiene que costar: ${outcome.away.chanceQuality}`);
});

test('pero el bloque cerrado sufre con buenos extremos y centros', () => {
  // Extremos y laterales de nivel alto: el cruce tiene que premiar el juego por afuera.
  const wingers = squad('Bandas').map((p) =>
    p.position === 'ED' || p.position === 'EI' || p.position === 'LD' || p.position === 'LI'
      ? createPlayer({
          id: p.id, name: p.name, position: p.position,
          attributes: attributesFor(p.position, 86, { velocidad: 90, regate: 90, pase: 90 }),
        })
      : p,
  );
  const block = strength('Bloque', LOW_BLOCK);
  const wings = strength('Bandas', WING_ATTACK, 78, wingers);
  const outcome = resolveMatchups(block, wings, DEFAULT_CONFIG);
  assert.ok(outcome.away.chanceQuality > 0.02, `los centros tienen que lastimar: ${outcome.away.chanceQuality}`);
});

test('los efectos son empujones chicos, nunca bonus enormes', () => {
  const combos: readonly Partial<Tactics>[] = [HIGH_PRESS, SLOW_POSSESSION, DIRECT_COUNTER, LOW_BLOCK, CENTRAL_ATTACK, WING_ATTACK];
  for (const a of combos) {
    for (const b of combos) {
      const outcome = resolveMatchups(strength('A', a), strength('B', b), DEFAULT_CONFIG);
      for (const effect of [outcome.home, outcome.away]) {
        assert.ok(Math.abs(effect.control) <= 4, `control ${effect.control}`);
        assert.ok(Math.abs(effect.chanceQuality) <= 0.25, `calidad ${effect.chanceQuality}`);
        assert.ok(Math.abs(effect.shotVolume) <= 0.2, `volumen ${effect.shotVolume}`);
        assert.ok(Math.abs(effect.counterBonus) <= 0.25, `contra ${effect.counterBonus}`);
      }
    }
  }
});

test('con la escala global en cero los cruces se desactivan', () => {
  const outcome = resolveMatchups(
    strength('Presion', HIGH_PRESS),
    strength('Posesion', SLOW_POSSESSION),
    { ...DEFAULT_CONFIG, matchups: { ...DEFAULT_CONFIG.matchups, globalScale: 0 } },
  );
  assert.equal(outcome.home.control, 0);
  assert.equal(outcome.away.chanceQuality, 0);
});

test('dos tacticas identicas no se sacan ventaja', () => {
  const a = strength('A', HIGH_PRESS);
  const b = strength('B', HIGH_PRESS);
  const outcome = resolveMatchups(a, b, DEFAULT_CONFIG);
  assert.ok(Math.abs(outcome.home.control - outcome.away.control) < 0.5);
  assert.ok(Math.abs(outcome.home.chanceQuality - outcome.away.chanceQuality) < 0.03);
});
