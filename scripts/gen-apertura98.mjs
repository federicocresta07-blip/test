/**
 * GENERA `src/data/apertura98.ts` A PARTIR DE LOS DATOS EXTRAIDOS DEL PKF.
 *
 *   node scripts/gen-apertura98.mjs
 *
 * Lee `data/pc_apertura_98/` y escribe un modulo con los veinte clubes de
 * Primera y sus planteles reales. Se guardan los DIEZ atributos crudos de PC
 * Futbol, no los veintinueve del motor: el mapeo lo hace `pcf-bridge.ts` en
 * tiempo de ejecucion, asi que se puede ajustar sin regenerar nada y siempre
 * queda claro cual es el dato original.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const players = JSON.parse(readFileSync('data/pc_apertura_98/players.json', 'utf8'));
const teams = JSON.parse(readFileSync('data/pc_apertura_98/teams.json', 'utf8'));
const primera = JSON.parse(readFileSync('data/pc_apertura_98/argentina_primera.json', 'utf8'));
const coaches = JSON.parse(readFileSync('data/pc_apertura_98/coaches.json', 'utf8'));

const PRIMERA_IDS = primera.teams.map((t) => t.id);

/**
 * Ids cortos y estables para el juego. El id del extractor lleva el puntero
 * del PKF y cambiaria si se regenerara desde otro archivo.
 */
const SHORT_ID = {
  'river-2025': 'river', 'san-lorenzo-1825': 'sanlorenzo', 'vélez-1506': 'velez',
  'argentinos-jrs-1607': 'argentinos', 'newell-s-1849': 'newells',
  'belgrano-1633': 'belgrano', 'lanús-1530': 'lanus',
  'rosario-central-2142': 'central', 'gim-esgrima-lp-1850': 'gimnasia',
  'independiente-1731': 'independiente', 'racing-1818': 'racing', 'boca-1816': 'boca',
  'huracán-1594': 'huracan', 'platense-1548': 'platense', 'gimnasia-j-1804': 'jujuy',
  'ferro-1580': 'ferro', 'colón-1521': 'colon',
  'estudiantes-lp-1742': 'estudiantes', 'talleres-cba-1759': 'talleres',
  'unión-1699': 'union',
};

/**
 * Colores institucionales. NO salen del PKF: el formato no guarda los colores
 * del club. Vienen de los dos datasets de clubes que ya tenia el proyecto
 * (`src/ui/data/clubs.ts` y `src/data/clausura-1998/clubs.ts`), que los traen
 * declarados. Es dato nuestro, no del archivo.
 */
const COLORS = {
  river: ['#e2001a', '#ffffff'], boca: ['#0a3c8c', '#f2c500'],
  racing: ['#6cace4', '#ffffff'], independiente: ['#d9202a', '#ffffff'],
  sanlorenzo: ['#0d2c6b', '#c8102e'], velez: ['#0b3c8d', '#ffffff'],
  estudiantes: ['#e2001a', '#ffffff'], huracan: ['#e2001a', '#ffffff'],
  lanus: ['#7b2033', '#ffffff'], argentinos: ['#e2001a', '#ffffff'],
  talleres: ['#0b3c8d', '#ffffff'], belgrano: ['#6cace4', '#ffffff'],
  newells: ['#e2001a', '#000000'], central: ['#0b3c8d', '#f2c500'],
  platense: ['#8b1a1a', '#ffffff'], gimnasia: ['#0b3c8d', '#ffffff'],
  jujuy: ['#0b3c8d', '#ffffff'], ferro: ['#0b7a3b', '#ffffff'],
  colon: ['#e2001a', '#000000'], union: ['#e2001a', '#ffffff'],
};

/** Siglas para el badge dibujado, cuando el club no tiene escudo real. */
const BADGE = {
  river: 'CARP', boca: 'CABJ', racing: 'RC', independiente: 'CAI', sanlorenzo: 'CASLA',
  velez: 'CAV', estudiantes: 'EDLP', huracan: 'CAH', lanus: 'CAL', argentinos: 'AAAJ',
  talleres: 'CAT', belgrano: 'CAB', newells: 'NOB', central: 'CARC', platense: 'CAP',
  gimnasia: 'GELP', jujuy: 'GEJ', ferro: 'FCO', colon: 'CAC', union: 'CAU',
};

const byTeam = new Map();
for (const p of players) {
  if (!PRIMERA_IDS.includes(p.team_id)) continue;
  if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, []);
  byTeam.get(p.team_id).push(p);
}

const coachByTeam = new Map(coaches.map((c) => [c.team_id, c]));
const teamById = new Map(teams.map((t) => [t.id, t]));

function esc(s) {
  return JSON.stringify(s ?? null);
}

const clubLines = [];
const squadLines = [];

for (const id of PRIMERA_IDS) {
  const short = SHORT_ID[id];
  if (!short) throw new Error(`sin id corto para ${id}`);
  const t = teamById.get(id);
  const squad = byTeam.get(id) ?? [];
  const coach = coachByTeam.get(id);
  const [primary, secondary] = COLORS[short];

  clubLines.push(
    `  {\n` +
      `    id: '${short}',\n` +
      `    name: ${esc(t.long_name || t.short_name)},\n` +
      `    shortName: ${esc(t.short_name)},\n` +
      `    badge: '${BADGE[short]}',\n` +
      `    primaryColor: '${primary}',\n` +
      `    secondaryColor: '${secondary}',\n` +
      `    stadium: ${esc(t.stadium_name)},\n` +
      `    capacity: ${t.stadium_capacity},\n` +
      `    founded: ${t.founded},\n` +
      `    members: ${t.members},\n` +
      `    president: ${esc(t.president)},\n` +
      `    sponsor: ${esc(t.sponsor)},\n` +
      `    kit: ${esc(t.kit)},\n` +
      `    coach: ${esc(coach ? coach.full_name : null)},\n` +
      `    tactics: ${JSON.stringify({
        toque: t.tactics?.toque_pct ?? null,
        contragolpe: t.tactics?.contragolpe_pct ?? null,
        ataque: t.tactics?.tipo_ataque ?? null,
        entradas: t.tactics?.tipo_entradas ?? null,
        marcaje: t.tactics?.marcaje ?? null,
        despejes: t.tactics?.despejes ?? null,
        presion: t.tactics?.presion ?? null,
      })},\n` +
      `    pcfPointer: ${t.pcf_pointer},\n` +
      `  },`,
  );

  const rows = squad
    .slice()
    .sort((a, b) => (b.overall - a.overall) || a.full_name.localeCompare(b.full_name, 'es'))
    .map((p) => {
      const a = p.attributes;
      const attrs =
        `{ ve: ${a.velocidad}, re: ${a.resistencia}, ag: ${a.agresividad}, ` +
        `ca: ${a.calidad}, rm: ${a.remate}, rg: ${a.regate}, pa: ${a.pase}, ` +
        `ti: ${a.tiro}, en: ${a.entradas}, po: ${a.portero} }`;
      const roles = p.roles.length ? `[${p.roles.map((r) => esc(r)).join(', ')}]` : '[]';
      return (
        `    { p: ${p.pcf_pointer}, n: ${esc(p.full_name)}, s: ${esc(p.short_name)}, ` +
        `d: ${p.shirt_number_reliable ? p.shirt_number : 'null'}, ` +
        `dem: ${esc(p.position_original)}, roles: ${roles}, ` +
        `birth: ${esc(p.birth_date)}, age: ${p.age ?? 'null'}, ` +
        `nat: ${esc(p.nationality)}, h: ${p.height ?? 'null'}, w: ${p.weight ?? 'null'}, ` +
        `a: ${attrs}, off: ${p.source_offset} },`
      );
    });

  squadLines.push(`  ${short}: [\n${rows.join('\n')}\n  ],`);
}

const out = `/**
 * TORNEO APERTURA 1998 — LOS VEINTE CLUBES Y SUS PLANTELES REALES.
 *
 * GENERADO por \`node scripts/gen-apertura98.mjs\` desde \`data/pc_apertura_98/\`.
 * No editar a mano.
 *
 * Los jugadores, sus dorsales, sus fechas de nacimiento y sus DIEZ atributos
 * salen de \`EQ003003.PKF\`, el archivo de equipos de PC Apertura 6.0. Cada uno
 * lleva su offset de origen.
 *
 * Se guardan los diez atributos de PC Futbol tal como estan en el archivo, no
 * los veintinueve del motor: el mapeo lo hace \`pcf-bridge.ts\` en tiempo de
 * ejecucion. Asi el dato original queda siempre distinguible de lo derivado, y
 * el mapeo se puede ajustar sin regenerar este archivo.
 *
 * LO QUE NO SALE DEL PKF, y por lo tanto es nuestro:
 * - los colores institucionales de cada club (el formato no los guarda)
 * - las siglas del badge
 * - el contrato de cada jugador (el formato no guarda contratos)
 * - la forma, la moral y la fatiga, que son estado de partida y no historia
 */

/** Los diez atributos de PC Futbol, con las siglas del juego. */
export type Apertura98Attributes = {
  readonly ve: number; readonly re: number; readonly ag: number; readonly ca: number;
  readonly rm: number; readonly rg: number; readonly pa: number; readonly ti: number;
  readonly en: number; readonly po: number;
};

export type Apertura98Player = {
  /** Puntero del jugador en el PKF. */
  readonly p: number;
  readonly n: string;
  readonly s: string;
  /** Dorsal, o null cuando el juego no lo poblo para ese equipo. */
  readonly d: number | null;
  /** Demarcacion original: Portero, Defensa, Medio o Delantero. */
  readonly dem: string;
  /** Hasta seis roles, del mas especifico al menos. */
  readonly roles: readonly string[];
  readonly birth: string | null;
  readonly age: number | null;
  readonly nat: string | null;
  readonly h: number | null;
  readonly w: number | null;
  readonly a: Apertura98Attributes;
  /** Offset del registro en EQ003003.PKF. */
  readonly off: number;
};

export type Apertura98Club = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly badge: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly stadium: string | null;
  readonly capacity: number | null;
  readonly founded: number | null;
  readonly members: number | null;
  readonly president: string | null;
  readonly sponsor: string | null;
  readonly kit: string | null;
  readonly coach: string | null;
  readonly tactics: {
    readonly toque: number | null;
    readonly contragolpe: number | null;
    readonly ataque: string | null;
    readonly entradas: string | null;
    readonly marcaje: string | null;
    readonly despejes: string | null;
    readonly presion: string | null;
  };
  readonly pcfPointer: number;
};

export const APERTURA98_CLUBS: readonly Apertura98Club[] = [
${clubLines.join('\n')}
];

export const APERTURA98_SQUADS: Readonly<Record<string, readonly Apertura98Player[]>> = {
${squadLines.join('\n')}
};

export const APERTURA98_SOURCE = {
  file: 'EQ003003.PKF',
  game: 'PC Apertura 6.0 (1998)',
  clubs: ${PRIMERA_IDS.length},
  players: ${[...byTeam.values()].reduce((n, s) => n + s.length, 0)},
} as const;

const BY_ID = new Map(APERTURA98_CLUBS.map((c) => [c.id, c]));

export function apertura98Club(id: string): Apertura98Club {
  const found = BY_ID.get(id);
  if (!found) throw new Error(\`Club desconocido en el Apertura 98: \${id}\`);
  return found;
}

export function apertura98Squad(id: string): readonly Apertura98Player[] {
  return APERTURA98_SQUADS[id] ?? [];
}
`;

writeFileSync('src/data/apertura98.ts', out);
const total = [...byTeam.values()].reduce((n, s) => n + s.length, 0);
console.log(`src/data/apertura98.ts: ${PRIMERA_IDS.length} clubes, ${total} jugadores`);
for (const id of PRIMERA_IDS) {
  const s = byTeam.get(id) ?? [];
  console.log(`  ${SHORT_ID[id].padEnd(14)} ${String(s.length).padStart(2)} jugadores`);
}
