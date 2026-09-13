/**
 * PUENTE ENTRE LOS DATOS DE PC FUTBOL Y EL MOTOR.
 *
 * Ya casi no hay puente. El motor usa los MISMOS DIEZ atributos que guarda
 * `EQ003003.PKF`, con los mismos nombres, asi que `attributesFromPcf` es una
 * identidad y no queda nada derivado.
 *
 * Lo que este archivo sigue haciendo es lo que no es un atributo:
 *
 * - traducir los diecinueve ROLES del archivo a los once puestos del motor,
 * - impedir que un arquero quede habilitado como jugador de campo,
 * - armar el estado de partida (forma, moral, fatiga) que el archivo no
 *   guarda, y la experiencia y la regularidad, que tampoco.
 *
 * QUE HABIA ANTES. El motor tenia veintinueve atributos y aca se derivaban
 * veinte: `vision` de calidad, `centros` de pase, `manos` de portero, el juego
 * aereo de la agresividad y la altura. Veinte numeros por jugador que parecian
 * datos y eran nuestra estimacion, sin ninguna forma de verificarlos. Al bajar
 * el motor a diez atributos esa capa se fue entera, y con ella el problema.
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

/**
 * De donde sale cada atributo del motor.
 *
 * Los diez. Todos originales: el motor usa exactamente los que guarda el
 * archivo, asi que no hay nada que derivar.
 *
 * Esta tabla existia con veintinueve entradas, nueve originales y veinte
 * derivadas, y era la parte mas debil del proyecto: veinte numeros por jugador
 * que parecian datos y eran nuestra estimacion. Se fue entera al bajar el motor
 * a diez atributos.
 */
export const PCF_ATTRIBUTE_SOURCE = {
  velocidad: 'original: velocidad (VE)',
  resistencia: 'original: resistencia (RE)',
  agresividad: 'original: agresividad (AG)',
  calidad: 'original: calidad (CA)',
  remate: 'original: remate (RM)',
  regate: 'original: regate (RG)',
  pase: 'original: pase (PA)',
  tiro: 'original: tiro (TI)',
  entradas: 'original: entradas (EN)',
  portero: 'original: portero (PO)',
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

export type PcfMappingInput = {
  readonly attributes: PcfAttributes;
  readonly position: Position;
  /** Ya no se usan: quedan en la firma porque el dataset los trae. */
  readonly height: number | null;
  readonly weight: number | null;
};

/**
 * Los atributos del motor a partir de los del archivo.
 *
 * Es una IDENTIDAD. El motor usa los mismos diez que guarda PC Futbol, con los
 * mismos nombres, asi que esta funcion solo acota a la escala 1..100 y
 * devuelve. Antes derivaba veinte atributos con mezclas ponderadas, la altura
 * y el peso; todo eso se fue.
 *
 * Se mantiene la funcion en lugar de borrarla porque es el unico lugar por el
 * que los datos del archivo entran al motor, y el test que verifica que los
 * diez lleguen intactos apunta aca.
 */
export function attributesFromPcf(input: PcfMappingInput): {
  readonly attributes: Attributes;
  readonly original: readonly string[];
  readonly derived: readonly string[];
} {
  const a = input.attributes;
  const attributes: Attributes = {
    velocidad: clampAttribute(a.velocidad),
    resistencia: clampAttribute(a.resistencia),
    agresividad: clampAttribute(a.agresividad),
    calidad: clampAttribute(a.calidad),
    remate: clampAttribute(a.remate),
    regate: clampAttribute(a.regate),
    pase: clampAttribute(a.pase),
    tiro: clampAttribute(a.tiro),
    entradas: clampAttribute(a.entradas),
    portero: clampAttribute(a.portero),
  };
  return { attributes, original: Object.keys(PCF_ATTRIBUTE_SOURCE), derived: [] };
}

/** La media de PC Futbol, con su formula: promedio entero de cuatro atributos. */
export function pcfMedia(a: PcfAttributes): number {
  return Math.floor((a.velocidad + a.resistencia + a.agresividad + a.calidad) / 4);
}

/**
 * Atributos distintivos para la interfaz.
 *
 * Con diez atributos no hace falta elegir: se muestran todos.
 */
export function highlightsFromPcf(a: PcfAttributes): PartialAttributes {
  return {
    velocidad: a.velocidad,
    resistencia: a.resistencia,
    agresividad: a.agresividad,
    calidad: a.calidad,
    remate: a.remate,
    regate: a.regate,
    pase: a.pase,
    tiro: a.tiro,
    entradas: a.entradas,
    portero: a.portero,
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
 * Del archivo: nombre, dorsal, fecha de nacimiento, edad, nacionalidad,
 * altura, peso, demarcacion, roles y los diez atributos, que entran sin
 * tocarse.
 *
 * Nuestro: la experiencia, la regularidad y la condicion inicial. Los tres van
 * declarados como tales y ninguno es un atributo.
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
    condition: initialCondition(`${clubId}:${raw.p}`, pcfMedia(pcf)),
  });
}
