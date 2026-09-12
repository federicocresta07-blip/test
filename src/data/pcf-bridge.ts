/**
 * PUENTE ENTRE LOS DATOS DE PC FUTBOL Y EL MOTOR.
 *
 * PC Apertura 98 guarda DIEZ atributos por jugador. El motor de este juego usa
 * VEINTINUEVE. Asi que nueve se toman tal cual del archivo y veinte se derivan
 * de los que si estan.
 *
 * Eso hay que decirlo con precision, porque es la diferencia entre un dato y
 * una estimacion nuestra:
 *
 * - `ORIGINAL`: el valor sale del archivo sin tocarlo.
 * - `DERIVADO`: lo calculamos a partir de uno o dos atributos originales.
 *   Es reproducible y no tiene azar, pero NO es un dato historico.
 *
 * `PCF_ATTRIBUTE_SOURCE` de abajo dice, atributo por atributo, cual es cual, y
 * `attributesFromPcf` devuelve las dos cosas separadas.
 *
 * COMO SE VERIFICA QUE EL MAPEO NO DEFORMA A LOS JUGADORES
 * =======================================================
 *
 * El motor calcula su propio overall por puesto con veintinueve pesos. PC
 * Futbol calcula su media con cuatro atributos. Son dos formulas
 * independientes, asi que comparar las dos sobre los 1318 jugadores es una
 * prueba real: si el mapeo estuviera mal, el overall del motor se despegaria
 * de la media original. Lo verifica `tests/pcf-bridge.test.ts`.
 */

import { clampAttribute, type Attributes, type PartialAttributes } from '../domain/attributes.ts';
import type { Position } from '../domain/positions.ts';
import { Rng } from '../core/rng.ts';
import { createPlayer, type Player } from '../domain/player.ts';
import type { Apertura98Player } from './apertura98.ts';

/** Los diez atributos de PC Futbol, en el orden en que estan en el archivo. */
export type PcfAttributes = {
  readonly velocidad: number;
  readonly resistencia: number;
  readonly agresividad: number;
  readonly calidad: number;
  readonly remate: number;
  readonly regate: number;
  readonly pase: number;
  readonly tiro: number;
  readonly entradas: number;
  readonly portero: number;
};

/** De donde sale cada atributo del motor. */
export const PCF_ATTRIBUTE_SOURCE = {
  // --- Los nueve que salen del archivo sin tocar ---
  velocidad: 'original: velocidad',
  resistencia: 'original: resistencia',
  agresividad: 'original: agresividad',
  tecnica: 'original: calidad',
  regate: 'original: regate',
  paseCorto: 'original: pase',
  definicion: 'original: remate',
  quite: 'original: entradas',
  reflejos: 'original: portero',

  // --- Los veinte derivados ---
  aceleracion: 'derivado de velocidad y agilidad implicita',
  fuerza: 'derivado de agresividad y peso',
  salto: 'derivado de agresividad y altura',
  agilidad: 'derivado de velocidad',
  paseLargo: 'derivado de pase y calidad',
  centros: 'derivado de pase',
  control: 'derivado de calidad y regate',
  remate: 'derivado de tiro',
  juegoAereo: 'derivado de agresividad y altura',
  tirosLibres: 'derivado de tiro y calidad',
  penales: 'derivado de remate',
  marcaje: 'original: entradas',
  vision: 'derivado de calidad y pase',
  decisiones: 'derivado de calidad',
  posicionamiento: 'derivado de entradas y calidad (segun el puesto)',
  concentracion: 'derivado de entradas y calidad (segun el puesto)',
  trabajoEquipo: 'derivado de calidad',
  manos: 'derivado de portero',
  achique: 'derivado de portero',
  saque: 'derivado de portero',
} as const;

/** Los diecinueve roles de PC Futbol, mapeados a los once puestos del motor. */
export const PCF_ROLE_TO_POSITION: Readonly<Record<string, Position>> = {
  Portero: 'POR',
  'Lateral derecho': 'LD',
  'Lateral izquierdo': 'LI',
  Libre: 'DFC',
  'Central izquierdo': 'DFC',
  'Central derecho': 'DFC',
  'Centrocampista derecha': 'MC',
  'Interior derecho': 'MC',
  'Delantero centro': 'DC',
  'Medio centro organizador': 'MC',
  'Centrocampista izquierda': 'MC',
  'Extremo derecho': 'ED',
  'Media punta por el centro': 'MCO',
  'Extremo izquierdo': 'EI',
  'Medio centro defensivo': 'MCD',
  'Media punta derecha': 'MCO',
  'Media punta izquierda': 'MCO',
  'Interior izquierdo': 'MC',
};

/** Cuando no hay rol utilizable, la demarcacion alcanza para elegir puesto. */
export const PCF_DEMARCATION_TO_POSITION: Readonly<Record<string, Position>> = {
  Portero: 'POR',
  Defensa: 'DFC',
  Medio: 'MC',
  Delantero: 'DC',
};

/**
 * El puesto del motor para un jugador de PC Futbol.
 *
 * Se prefiere el primer rol, que es el mas especifico que guarda el archivo, y
 * se cae a la demarcacion si el rol no mapea. Los roles secundarios se
 * devuelven aparte: el motor los usa como posiciones alternativas y asi un
 * lateral que tambien es central no juega fuera de puesto.
 */
export function positionFromPcf(
  roles: readonly (string | null)[],
  demarcation: string,
): { readonly position: Position; readonly secondary: readonly Position[] } {
  const mapped: Position[] = [];
  for (const role of roles) {
    if (!role) continue;
    const pos = PCF_ROLE_TO_POSITION[role];
    if (pos && !mapped.includes(pos)) mapped.push(pos);
  }
  const fallback = PCF_DEMARCATION_TO_POSITION[demarcation] ?? 'MC';
  const position = mapped[0] ?? fallback;

  // El arco no se mezcla con el resto de la cancha.
  //
  // Tres de los 143 arqueros del archivo traen un rol de campo en el segundo
  // slot: Burgos y Costanzo figuran como laterales izquierdos ademas de
  // arqueros. Tomarlo literal habilita al motor a poner a Burgos de lateral
  // sin penalizacion por jugar fuera de puesto, que es un bug de juego
  // disfrazado de fidelidad al dato. Se filtra en las dos direcciones.
  const secondary = mapped
    .slice(1)
    .filter((pos) => (position === 'POR' ? pos === 'POR' : pos !== 'POR'));

  return { position, secondary };
}

/** Mezcla ponderada de dos valores, redondeada y acotada a la escala del motor. */
function mix(a: number, b: number, weightA: number): number {
  return clampAttribute(a * weightA + b * (1 - weightA));
}

/**
 * Cuanto aporta la altura a los atributos aereos.
 *
 * La altura esta en el archivo pero para 635 de los 1318 jugadores es un valor
 * centinela. Cuando falta se devuelve 0 y el atributo queda apoyado solo en la
 * agresividad, que si esta siempre.
 */
function heightBonus(height: number | null): number {
  if (height === null) return 0;
  return clampAttribute((height - 178) * 1.6) - 0;
}

export type PcfMappingInput = {
  readonly attributes: PcfAttributes;
  readonly position: Position;
  readonly height: number | null;
  readonly weight: number | null;
};

/**
 * Convierte los diez atributos de PC Futbol en los veintinueve del motor.
 *
 * Determinista y sin azar: los mismos diez numeros dan siempre los mismos
 * veintinueve. Eso importa porque permite regenerar el dataset y obtener
 * exactamente lo mismo, y porque un jugador no cambia entre partidas.
 */
export function attributesFromPcf(input: PcfMappingInput): {
  readonly attributes: Attributes;
  readonly original: readonly string[];
  readonly derived: readonly string[];
} {
  const a = input.attributes;
  const keeper = input.position === 'POR';
  // Puestos donde el motor pesa mucho lo defensivo: ahi los mentales se
  // derivan de entradas en lugar de calidad.
  const defensive = input.position === 'DFC' || input.position === 'LD'
    || input.position === 'LI' || input.position === 'MCD';
  const tall = heightBonus(input.height);
  const heavy = input.weight === null ? 0 : clampAttribute((input.weight - 74) * 2);

  const attrs: Record<string, number> = {
    // --- Originales ---
    velocidad: a.velocidad,
    resistencia: a.resistencia,
    agresividad: a.agresividad,
    tecnica: a.calidad,
    regate: a.regate,
    paseCorto: a.pase,
    definicion: a.remate,
    quite: a.entradas,
    reflejos: a.portero,

    // --- Derivados ---
    // La aceleracion acompania a la velocidad; en PC Futbol son un solo
    // atributo, asi que se reparte con una leve ventaja para la velocidad.
    aceleracion: clampAttribute(a.velocidad * 0.96),
    agilidad: clampAttribute(a.velocidad * 0.94 + a.regate * 0.06),
    // La fuerza y el salto se apoyan en la agresividad, que es lo mas cercano
    // que guarda PC Futbol a una dimension fisica de choque, mas el fisico
    // real del jugador cuando esta.
    fuerza: heavy === 0 ? a.agresividad : mix(a.agresividad, heavy, 0.75),
    salto: tall === 0 ? clampAttribute(a.agresividad * 0.9) : mix(a.agresividad, tall, 0.7),
    juegoAereo: tall === 0 ? mix(a.agresividad, a.remate, 0.6) : mix(a.agresividad, tall, 0.65),
    // El pase de PC Futbol es uno solo: el largo y los centros salen de ahi.
    paseLargo: mix(a.pase, a.calidad, 0.8),
    centros: clampAttribute(a.pase * 0.95),
    control: mix(a.calidad, a.regate, 0.65),
    // TI (tiro) es potencia de disparo; RM (remate) es definicion. El motor
    // separa `remate` de `definicion`, asi que cada uno toma el suyo.
    remate: a.tiro,
    tirosLibres: mix(a.tiro, a.calidad, 0.6),
    penales: mix(a.remate, a.calidad, 0.7),
    marcaje: a.entradas,
    // Los mentales no existen en PC Futbol y son la derivacion mas gruesa de
    // todo el mapeo. Se apoyan en calidad, que es el atributo de "clase"
    // general del juego.
    //
    // Pero en los puestos defensivos se apoyan en ENTRADAS, no en calidad. La
    // primera version usaba calidad para todos y dejaba a los defensores tres
    // o cuatro puntos por debajo de su media original de forma sistematica,
    // porque el overall del motor pesa mucho el posicionamiento y la
    // concentracion en esos puestos. Se midio por puesto sobre los 1318
    // jugadores y por eso se cambio.
    vision: mix(a.calidad, a.pase, 0.6),
    decisiones: clampAttribute(a.calidad * 0.95),
    posicionamiento: keeper
      ? a.portero
      : defensive
        ? mix(a.entradas, a.calidad, 0.65)
        : mix(a.calidad, a.entradas, 0.7),
    concentracion: keeper
      ? clampAttribute(a.portero * 0.97)
      : defensive
        ? mix(a.entradas, a.calidad, 0.55)
        : clampAttribute(a.calidad * 0.93),
    trabajoEquipo: clampAttribute(a.calidad * 0.9),
    // Los de arquero salen todos de PO, el unico que PC Futbol dedica al puesto.
    manos: clampAttribute(a.portero * 0.97),
    achique: mix(a.portero, a.velocidad, 0.85),
    saque: mix(a.portero, a.pase, 0.7),
  };

  const original: string[] = [];
  const derived: string[] = [];
  for (const [key, source] of Object.entries(PCF_ATTRIBUTE_SOURCE)) {
    (source.startsWith('original') ? original : derived).push(key);
  }

  return { attributes: attrs as unknown as Attributes, original, derived };
}

/** La media de PC Futbol, con su formula: promedio entero de cuatro atributos. */
export function pcfMedia(a: PcfAttributes): number {
  return Math.floor((a.velocidad + a.resistencia + a.agresividad + a.calidad) / 4);
}

/** Atributos distintivos, para mostrar en la interfaz sin los 29. */
export function highlightsFromPcf(a: PcfAttributes): PartialAttributes {
  return {
    velocidad: a.velocidad,
    resistencia: a.resistencia,
    agresividad: a.agresividad,
    tecnica: a.calidad,
    definicion: a.remate,
    regate: a.regate,
    paseCorto: a.pase,
    remate: a.tiro,
    quite: a.entradas,
    reflejos: a.portero,
  };
}

// ============================================================
// De un jugador del PKF a un jugador del motor
// ============================================================


/**
 * Estado de partida que PC Futbol no guarda.
 *
 * Forma, moral y fatiga no son historia: son el estado del jugador en un
 * momento del torneo, y el archivo no los tiene. Se derivan de una semilla
 * fija por jugador para que la partida arranque con un plantel vivo (alguien
 * en racha, alguien enojado) y no con veintitres jugadores identicos.
 *
 * Es deterministico: el mismo jugador arranca siempre igual. Y va marcado en
 * la ficha como estado inicial, no como dato del archivo.
 */
function initialCondition(seed: string, media: number) {
  const rng = new Rng(`condicion:${seed}`);
  return {
    form: clampAttribute(media + rng.intBetween(-14, 12)),
    morale: clampAttribute(58 + rng.intBetween(-16, 24)),
    fatigue: rng.intBetween(0, 18),
    sharpness: clampAttribute(78 + rng.intBetween(-8, 16)),
  };
}

/** La edad al 1 de julio de 1998, o una estimada cuando la fecha no sirve. */
const AGE_FALLBACK = 26;

/**
 * Convierte un jugador del Apertura 98 en un jugador del motor.
 *
 * Lo que sale del archivo: nombre, dorsal, fecha de nacimiento, edad,
 * nacionalidad, altura, peso, demarcacion, roles y los diez atributos.
 * Lo derivado: los veinte atributos que el motor tiene y PC Futbol no, mas la
 * experiencia, la regularidad y la condicion inicial.
 */
export function playerFromApertura98(raw: Apertura98Player, clubId: string): Player {
  const { position, secondary } = positionFromPcf(raw.roles, raw.dem);
  const pcf: PcfAttributes = {
    velocidad: raw.a.ve,
    resistencia: raw.a.re,
    agresividad: raw.a.ag,
    calidad: raw.a.ca,
    remate: raw.a.rm,
    regate: raw.a.rg,
    pase: raw.a.pa,
    tiro: raw.a.ti,
    entradas: raw.a.en,
    portero: raw.a.po,
  };
  const { attributes } = attributesFromPcf({
    attributes: pcf,
    position,
    height: raw.h,
    weight: raw.w,
  });
  const age = raw.age ?? AGE_FALLBACK;
  const media = pcfMedia(pcf);

  return createPlayer({
    id: `pcf-${clubId}-${raw.p}`,
    name: raw.n,
    position,
    age,
    attributes,
    secondaryPositions: secondary,
    // La experiencia crece con la edad: es lo unico razonable cuando el
    // archivo no guarda partidos jugados en la carrera.
    experience: clampAttribute((age - 17) * 6 + 20),
    // La regularidad se apoya en calidad, que es el atributo de clase.
    consistency: clampAttribute(raw.a.ca * 0.85 + 8),
    condition: initialCondition(`${clubId}:${raw.p}`, media),
  });
}
