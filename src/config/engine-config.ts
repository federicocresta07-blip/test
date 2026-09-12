/**
 * PARAMETROS CENTRALES DEL MOTOR (seccion 52).
 *
 * Todo numero que afecte el equilibrio del juego vive aqui. El resto del
 * codigo no debe contener constantes "magicas": si hay que recalibrar el
 * motor, se toca este archivo y se vuelve a correr `npm run calibrate`.
 *
 * El objeto se exporta como `DEFAULT_CONFIG` y el motor acepta overrides
 * parciales, asi que se puede probar una variante sin editar el archivo.
 */

import type { FamiliarityTier } from '../domain/positions.ts';

export type EngineConfig = {
  /** Rendimiento efectivo del jugador (secciones 27, 35, 36, 37, 40). */
  readonly performance: {
    /** Overall de referencia de la liga; el motor mide todo en relacion a esto. */
    readonly leagueAverageRating: number;
    /** Puntos de overall que aporta la forma al pasar de 50 a 100. */
    readonly formSwing: number;
    /** Puntos de overall que aporta la moral al pasar de 50 a 100. */
    readonly moraleSwing: number;
    /** Puntos que se pierden con fatiga 100 (jugador fundido). */
    readonly fatiguePenalty: number;
    /** Puntos que se pierden con una lesion leve arrastrada (condicion fisica). */
    readonly sharpnessSwing: number;
    /** Desvio estandar base de la variacion de partido. */
    readonly matchVariationSd: number;
    /** Reduccion del desvio por consistencia/experiencia altas. */
    readonly matchVariationConsistencyEffect: number;
    /** Corte del azar de rendimiento, en desvios. */
    readonly matchVariationMaxSd: number;
    /** Bonus/castigo maximo por experiencia en partidos de alta importancia. */
    readonly experienceBigMatchSwing: number;
    /** Penalizacion por jugar fuera de posicion, por nivel de familiaridad. */
    readonly positionPenaltyByTier: Readonly<Record<FamiliarityTier, number>>;
    /** Penalizacion cuando la posicion asignada es secundaria del jugador. */
    readonly secondaryPositionPenalty: number;
    /**
     * Cuanto pesa la aptitud por atributos del puesto asignado frente al
     * overall natural. Con 0.35, un MC con buen marcaje sufre algo menos
     * como DFC que un MC puramente creativo.
     */
    readonly positionAttributeMix: number;
    /** Tope, en puntos de overall, del ajuste anterior. */
    readonly positionAttributeCap: number;
    /** Penalizacion maxima por desajuste tactico (rol que no le queda). */
    readonly tacticalFitSwing: number;
  };

  /** Fuerza del equipo por dimensiones (secciones 30, 31, 39). */
  readonly teamStrength: {
    /** Exponente de la media de potencia: >1 hace pesar mas a los cracks (seccion 33). */
    readonly powerMeanExponent: number;
    /** Puntos que mueve la quimica al pasar de 50 a 100 (seccion 39). */
    readonly chemistrySwing: number;
    /** Peso del arquero en la dimension ARQUERO (el resto lo aporta la defensa). */
    readonly goalkeeperDimensionWeight: number;
  };

  /**
   * Cruces tacticos (seccion 32).
   * Son empujones chicos: inclinan las probabilidades, no deciden el partido.
   */
  readonly matchups: {
    /** Escala global de todos los cruces. Con 0 se desactivan por completo. */
    readonly globalScale: number;
    /** Presion alta contra salida en posesion: control para el que presiona. */
    readonly pressVsPossessionControl: number;
    /** Juego directo/contra contra presion alta: calidad de ocasion para el directo. */
    readonly directVsPressCounter: number;
    /** Bloque bajo contra ataque central: baja la calidad de las ocasiones rivales. */
    readonly lowBlockVsCentral: number;
    /** Bloque bajo contra buenos extremos y centros: la sube. */
    readonly lowBlockVsWings: number;
    /** Linea alta contra ataque veloz: regala contras. */
    readonly highLineVsPace: number;
    /** Posesion sin presion rival: control gratis. */
    readonly possessionVsLowPress: number;
    /** Equipo ancho contra equipo estrecho: mas ocasiones por afuera. */
    readonly widthVsNarrow: number;
    /** Superioridad fisica contra juego tecnico y lento. */
    readonly physicalVsSlow: number;
    /** Especialista en balon parado contra equipo flojo de aereo. */
    readonly setPieceVsWeakAerial: number;
  };

  /** Etapa 1: control del partido (seccion 43). */
  readonly control: {
    /** Cuanta posesion mueve 1 punto de ventaja de control (en fraccion por punto). */
    readonly possessionSensitivity: number;
    /** Posesion minima y maxima que puede tener un equipo. */
    readonly possessionFloor: number;
    /** Empuje de posesion por jugar de local (seccion 34). */
    readonly homePossessionBonus: number;
    /** Peso de cada dimension en la capacidad de controlar el partido. */
    readonly weights: {
      readonly mediocampo: number;
      readonly creacion: number;
      readonly presion: number;
      readonly fisico: number;
      readonly defensa: number;
    };
  };

  /** Etapa 2: generacion de ocasiones (seccion 43). */
  readonly chances: {
    /**
     * Remates de juego por equipo y partido en un cruce parejo.
     * Los remates de balon parado se suman aparte (seccion 46).
     */
    readonly baseShots: number;
    /** Sensibilidad de los remates a la diferencia ataque/defensa. */
    readonly qualitySensitivity: number;
    /** Cuanto empujan los remates la posesion (poco: no todo es tener la pelota). */
    readonly possessionElasticity: number;
    /** Bonus multiplicativo de remates por localia (seccion 34). */
    readonly homeShotBonus: number;
    /** Desvio relativo del ruido de volumen de remates. */
    readonly volumeNoiseSd: number;
    /** Limites duros de remates por equipo, para que nunca salga un absurdo. */
    readonly minShots: number;
    readonly maxShots: number;
  };

  /** Etapa 3: calidad de las ocasiones, estilo xG (secciones 43, 44). */
  readonly chanceQuality: {
    /** xG base por tipo de ocasion. */
    readonly baseXg: {
      readonly ocasionClara: number;
      readonly ocasionBuena: number;
      readonly remateLejano: number;
      readonly cabezazo: number;
      readonly balonParado: number;
      readonly penal: number;
      readonly contraataque: number;
    };
    /** Reparto base de los remates de juego entre tipos de ocasion. */
    readonly baseMix: {
      readonly ocasionClara: number;
      readonly ocasionBuena: number;
      readonly remateLejano: number;
      readonly cabezazo: number;
      readonly contraataque: number;
    };
    /** Cuanto reparte la ventaja ofensiva hacia ocasiones mas claras. */
    readonly edgeToClearChances: number;
    /** Modulacion del xG por calidad del remate/posicionamiento del atacante. */
    readonly attackerQualityEffect: number;
    /** Corte de xG por remate. */
    readonly minXgPerShot: number;
    readonly maxXgPerShot: number;
  };

  /** Etapa 4: conversion (secciones 43, 45). */
  readonly conversion: {
    /** Efecto de la definicion del ejecutor sobre la probabilidad de gol (seccion 33). */
    readonly finishingEffect: number;
    /** Efecto del arquero rival sobre la probabilidad de gol (seccion 45). */
    readonly goalkeeperEffect: number;
    /**
     * Presion defensiva sobre el remate (seccion 43, etapa 4).
     * Es un efecto chico: la defensa rival ya pesa en el volumen y en la
     * calidad de las ocasiones; aqui solo incomoda la ejecucion.
     */
    readonly defensivePressureEffect: number;
    /** Desvio del "dia" del arquero: partidos extraordinarios y partidos malos. */
    readonly goalkeeperFormSd: number;
    /** Probabilidad de que un remate no convertido termine en corner. */
    readonly cornerFromShot: number;
    /** Probabilidad de que un remate no convertido vaya al arco (para estadistica). */
    readonly onTargetBase: number;
    readonly onTargetXgEffect: number;
    /** Limites de probabilidad de gol por remate. */
    readonly minGoalProbability: number;
    readonly maxGoalProbability: number;
  };

  /** Balon parado (seccion 46). */
  readonly setPieces: {
    /** Corners base por equipo (ademas de los que genera cada remate). */
    readonly baseCorners: number;
    /** Corners extra por ventaja ofensiva. */
    readonly cornerEdgeEffect: number;
    /** Probabilidad de que un corner produzca un remate. */
    readonly cornerToShot: number;
    /** Empuje de la dimension BALON PARADO sobre esa probabilidad. */
    readonly setPieceAbilityEffect: number;
    /** Tiros libres directos peligrosos por partido y equipo. */
    readonly directFreeKicks: number;
    /** Probabilidad de gol de un tiro libre directo con ejecutor medio. */
    readonly freeKickBaseGoal: number;
    /** Penales por equipo y partido (Poisson). */
    readonly penaltyRate: number;
    /** Probabilidad de gol de un penal con ejecutor medio. */
    readonly penaltyBaseGoal: number;
  };

  /**
   * Efecto del marcador (seccion 43, etapa 5).
   * El que va perdiendo se juega mas y el que gana se repliega y sale de contra.
   */
  readonly scoreState: {
    /** Minuto a partir del cual el marcador cambia el comportamiento. */
    readonly fromMinute: number;
    /** Ocasiones extra del que pierde, por gol de desventaja (Poisson). */
    readonly trailingExtraChances: number;
    /** Contras extra del que gana (Poisson). */
    readonly leadingExtraCounters: number;
    /** Castigo de calidad por jugar apurado. */
    readonly trailingQualityPenalty: number;
    /** Bonus de calidad de las contras del que gana. */
    readonly leadingCounterQuality: number;
    /** Tope de goles de desventaja que se tienen en cuenta. */
    readonly maxDeficitConsidered: number;
  };

  /** Desarrollo temporal del partido (secciones 37, 47). */
  readonly timeline: {
    readonly regularMinutes: number;
    /** Minutos de descuento medios por mitad. */
    readonly stoppageMeanFirstHalf: number;
    readonly stoppageMeanSecondHalf: number;
    /** Peso relativo de ocasiones por tramo de 15 minutos (el final es mas abierto). */
    readonly segmentWeights: readonly number[];
    /** Fatiga que acumula un titular en 90 minutos con resistencia media. */
    readonly fatiguePer90: number;
    /** Efecto de la resistencia sobre la fatiga acumulada. */
    readonly staminaEffect: number;
    /**
     * Cuanta fatiga acumula un arquero respecto de un jugador de campo.
     * Corre una fraccion de lo que corren los demas, asi que juega todos los
     * partidos sin fundirse (seccion 37).
     */
    readonly goalkeeperFatigueFactor: number;
    /** Cuanto castiga la fatiga acumulada en partido al rendimiento del tramo final. */
    readonly inMatchFatigueEffect: number;
    /**
     * Cuanto pesa la diferencia de piernas frescas entre los dos equipos sobre
     * la calidad de las ocasiones del tramo final (seccion 37). Con 0.35, una
     * diferencia de 20 puntos de fatiga mueve el xG de la ocasion un 7%.
     */
    readonly lateFatigueQualityEffect: number;
  };

  /** Cambios automaticos (seccion 47). */
  readonly substitutions: {
    readonly maxSubs: number;
    /** Minutos en los que la IA evalua cambios. */
    readonly windows: readonly number[];
    /** Fatiga desde la que un titular es candidato a salir. */
    readonly fatigueThreshold: number;
    /** Rating por debajo del cual un titular es candidato a salir. */
    readonly poorRatingThreshold: number;
    /** Diferencia de overall efectivo que hace que un cambio no valga la pena. */
    readonly qualityDropTolerance: number;
    /**
     * Minutos que tiene que llevar en cancha un jugador que acaba de entrar
     * antes de poder ser reemplazado por decision tactica. Evita cadenas de
     * cambios absurdas (a un suplente no se lo saca a los dos minutos).
     * Una lesion lo saca igual.
     */
    readonly minMinutesBeforeReplacing: number;
  };

  /** Faltas, tarjetas y lesiones (seccion 38). */
  readonly discipline: {
    readonly baseFouls: number;
    readonly aggressionEffect: number;
    readonly pressingEffect: number;
    /** Probabilidad de que una falta sea amarilla. */
    readonly yellowPerFoul: number;
    /** Probabilidad de que una amarilla sea directa roja. */
    readonly straightRedPerFoul: number;
    /** Probabilidad base de lesion por jugador y partido. */
    readonly baseInjuryRate: number;
    readonly injuryFatigueEffect: number;
    readonly injuryAgeEffect: number;
    readonly injuryHistoryEffect: number;
    readonly injuryIntensityEffect: number;
    /**
     * Puntos que pierde cada dimension por jugador de menos (expulsion).
     * Jugar con diez tiene que doler de verdad.
     */
    readonly playerDownPenalty: {
      readonly ataque: number;
      readonly mediocampo: number;
      readonly creacion: number;
      readonly presion: number;
      readonly defensa: number;
      readonly contraataque: number;
    };
  };

  /** Localia (seccion 34). */
  readonly homeAdvantage: {
    /** Puntos de rendimiento efectivo que suma el local. */
    readonly performanceBonus: number;
    /** Multiplicador de xG del local. */
    readonly xgMultiplier: number;
    /** Faltas extra que recibe el visitante (arbitraje). */
    readonly refereeBias: number;
  };

  /**
   * EVOLUCION DEL PLANTEL ENTRE PARTIDOS (secciones 35 a 39).
   *
   * Estaba escrito a mano dentro de `progression/after-match.ts`, lo que
   * ademas de violar la seccion 52 escondia un problema de balance: un
   * partido de 95 minutos costaba unos 36 puntos de fatiga y tres dias de
   * descanso recuperaban 42, asi que la fatiga no podia acumularse nunca y
   * rotar el plantel no servia para nada. La fase 7 lo destapo: un torneo con
   * fechas de mitad de semana no le costaba nada al mismo once.
   *
   * La referencia para calibrar: un titular tiene que terminar el torneo
   * fundido si juega TODO, y llegar entero si se lo cuida. Una semana completa
   * recupera del todo; tres o cuatro dias, no.
   */
  readonly progression: {
    /** Recuperacion diaria de un jugador con resistencia 0. */
    readonly recoveryBasePerDay: number;
    /** Recuperacion diaria extra de un jugador con resistencia 100. */
    readonly recoveryStaminaPerDay: number;
    /** Recuperacion extra de un dia para el que no jugo. */
    readonly idleRecoveryBonus: number;
  };

  /**
   * DESARROLLO DE ATRIBUTOS (secciones 7, 40 — fase 4).
   *
   * Estos numeros deciden a que velocidad crece un jugador, y por lo tanto
   * cuanto vale un juvenil y cuanto sirve un entrenador. La referencia para
   * calibrar: un juvenil de 17 con mucho margen, jugando seguido y con un buen
   * entrenador, tiene que poder ganar entre 8 y 14 puntos de overall en una
   * temporada. Uno de 29 en su techo, cero. Uno de 34, perder.
   */
  readonly development: {
    /** Puntos de atributo por semana que puede GANAR, antes de los factores. */
    readonly pointsPerWeek: number;
    /**
     * Puntos por semana que puede PERDER un veterano.
     *
     * Va aparte y es mucho mas chico que el crecimiento a proposito. Con la
     * misma base, un jugador de 34 perdia once puntos de fisico en una
     * temporada y en tres quedaba inservible. Se cae, pero de a poco: un
     * veterano bien cuidado tiene que poder seguir sirviendo un par de anios.
     */
    readonly declinePerWeek: number;
    /** Dispersion del azar acotado, como fraccion. */
    readonly variation: number;
    /**
     * Cuanto puede pasarse un atributo suelto por encima del potencial.
     *
     * El potencial es el techo del OVERALL, no de cada atributo: un 9 con
     * potencial 80 puede tener definicion 88 si el resto lo compensa. Sin este
     * margen, entrenar un atributo puntual seria imposible.
     */
    readonly attributeCeilingSlack: number;
    /** Piso al que puede caer un atributo por edad. */
    readonly attributeFloor: number;
  };

  /** Notas individuales del partido (seccion 50). */
  readonly ratings: {
    readonly base: number;
    readonly goal: number;
    readonly assist: number;
    readonly keyChance: number;
    readonly bigMiss: number;
    readonly save: number;
    readonly goalConceded: number;
    readonly cleanSheet: number;
    readonly yellowCard: number;
    readonly redCard: number;
    readonly performanceEffect: number;
    readonly min: number;
    readonly max: number;
  };
};

/** Penalizacion por nivel de familiaridad de posicion (seccion 26). */
const POSITION_PENALTY_BY_TIER: Record<FamiliarityTier, number> = {
  0: 0.0,   // posicion natural
  1: 0.03,  // MC jugando MCD: penalizacion pequenia
  2: 0.08,  // LD jugando LI: moderada
  3: 0.16,  // MC jugando DFC: considerable
  4: 0.3,   // DC jugando DFC: muy grande
  5: 0.6,   // jugador de campo al arco (o arquero afuera)
};

export const DEFAULT_CONFIG: EngineConfig = {
  performance: {
    leagueAverageRating: 70,
    formSwing: 4.5,
    moraleSwing: 3.0,
    fatiguePenalty: 12,
    sharpnessSwing: 5,
    matchVariationSd: 3.6,
    matchVariationConsistencyEffect: 0.45,
    matchVariationMaxSd: 2.4,
    experienceBigMatchSwing: 3.0,
    positionPenaltyByTier: POSITION_PENALTY_BY_TIER,
    secondaryPositionPenalty: 0.025,
    positionAttributeMix: 0.35,
    positionAttributeCap: 12,
    tacticalFitSwing: 4.0,
  },

  teamStrength: {
    powerMeanExponent: 1.6,
    chemistrySwing: 5.0,
    goalkeeperDimensionWeight: 0.85,
  },

  matchups: {
    globalScale: 1,
    pressVsPossessionControl: 2.4,
    directVsPressCounter: 0.14,
    lowBlockVsCentral: 0.1,
    lowBlockVsWings: 0.11,
    highLineVsPace: 0.13,
    possessionVsLowPress: 2.2,
    widthVsNarrow: 0.08,
    physicalVsSlow: 1.6,
    setPieceVsWeakAerial: 0.16,
  },

  control: {
    possessionSensitivity: 0.0085,
    possessionFloor: 0.27,
    homePossessionBonus: 0.013,
    weights: {
      mediocampo: 0.44,
      creacion: 0.2,
      presion: 0.14,
      fisico: 0.1,
      defensa: 0.12,
    },
  },

  chances: {
    baseShots: 9.1,
    qualitySensitivity: 0.0095,
    possessionElasticity: 0.55,
    homeShotBonus: 1.03,
    volumeNoiseSd: 0.2,
    minShots: 1,
    maxShots: 32,
  },

  chanceQuality: {
    baseXg: {
      ocasionClara: 0.3,
      ocasionBuena: 0.085,
      remateLejano: 0.028,
      cabezazo: 0.07,
      balonParado: 0.058,
      penal: 0.78,
      contraataque: 0.17,
    },
    baseMix: {
      ocasionClara: 0.1,
      ocasionBuena: 0.34,
      remateLejano: 0.3,
      cabezazo: 0.13,
      contraataque: 0.13,
    },
    edgeToClearChances: 0.0062,
    attackerQualityEffect: 0.5,
    minXgPerShot: 0.012,
    maxXgPerShot: 0.92,
  },

  conversion: {
    finishingEffect: 0.85,
    goalkeeperEffect: 0.5,
    defensivePressureEffect: 0.12,
    goalkeeperFormSd: 0.11,
    cornerFromShot: 0.2,
    onTargetBase: 0.19,
    onTargetXgEffect: 0.6,
    minGoalProbability: 0.005,
    maxGoalProbability: 0.95,
  },

  setPieces: {
    baseCorners: 2.1,
    cornerEdgeEffect: 0.02,
    cornerToShot: 0.22,
    setPieceAbilityEffect: 0.5,
    directFreeKicks: 0.85,
    freeKickBaseGoal: 0.07,
    penaltyRate: 0.1,
    penaltyBaseGoal: 0.76,
  },

  scoreState: {
    fromMinute: 65,
    trailingExtraChances: 0.5,
    leadingExtraCounters: 0.3,
    trailingQualityPenalty: -0.06,
    leadingCounterQuality: 0.1,
    maxDeficitConsidered: 3,
  },

  timeline: {
    regularMinutes: 90,
    stoppageMeanFirstHalf: 1.6,
    stoppageMeanSecondHalf: 4.2,
    segmentWeights: [0.85, 1.0, 1.02, 1.0, 1.05, 1.15],
    fatiguePer90: 36,
    staminaEffect: 0.45,
    goalkeeperFatigueFactor: 0.3,
    inMatchFatigueEffect: 0.85,
    lateFatigueQualityEffect: 0.35,
  },

  substitutions: {
    maxSubs: 5,
    windows: [58, 66, 74, 82],
    fatigueThreshold: 72,
    poorRatingThreshold: 5.9,
    qualityDropTolerance: 6,
    minMinutesBeforeReplacing: 15,
  },

  discipline: {
    baseFouls: 12.5,
    aggressionEffect: 0.09,
    pressingEffect: 0.08,
    yellowPerFoul: 0.135,
    straightRedPerFoul: 0.0035,
    baseInjuryRate: 0.0085,
    injuryFatigueEffect: 1.6,
    injuryAgeEffect: 0.8,
    injuryHistoryEffect: 1.1,
    injuryIntensityEffect: 0.5,
    playerDownPenalty: {
      ataque: 7,
      mediocampo: 6,
      creacion: 6,
      presion: 5,
      defensa: 3,
      contraataque: 2,
    },
  },

  homeAdvantage: {
    performanceBonus: 0.9,
    xgMultiplier: 1.055,
    refereeBias: 0.9,
  },

  progression: {
    // Con estos numeros, y un partido de 95 minutos que cuesta unos 37 puntos
    // a un jugador de resistencia media:
    //   7 dias -> recuperado del todo, tambien el de menos resistencia
    //   4 dias -> queda con unos 14 puntos encima
    //   3 dias -> queda con unos 19
    // Es lo que hace que la profundidad del plantel (seccion 48) tenga precio:
    // con fechas de mitad de semana, repetir el mismo once se paga.
    recoveryBasePerDay: 3.2,
    recoveryStaminaPerDay: 3.7,
    idleRecoveryBonus: 6,
  },

  development: {
    // Con 0.055 puntos por semana y los factores de edad, margen, minutos y
    // entrenador, una temporada de 19 fechas (unas 22 semanas) da:
    //   juvenil de 17 con margen, jugando, con entrenador de 4 estrellas -> +10
    //   titular de 24 con algo de margen -> +3
    //   jugador de 29 en su techo -> 0
    //   veterano de 34 -> -4 de fisico, +1 de cabeza
    // Con 0.38 por semana y los factores de edad, margen, minutos y
    // entrenador, una temporada de 19 fechas (unas 22 semanas) da:
    //   juvenil de 17 con margen, jugando, con entrenador de 4 estrellas -> +11
    //   el mismo sin entrenador -> +9    |    el mismo sin jugar -> +6
    //   titular de 22 con algo de margen -> +5
    //   jugador de 27 o mas en su techo -> 0
    //   veterano de 34 -> -3 de fisico, -1 de cabeza
    pointsPerWeek: 0.38,
    declinePerWeek: 0.12,
    variation: 0.3,
    attributeCeilingSlack: 12,
    attributeFloor: 8,
  },

  ratings: {
    base: 6.2,
    goal: 1.05,
    assist: 0.55,
    keyChance: 0.16,
    bigMiss: 0.22,
    save: 0.17,
    goalConceded: 0.3,
    cleanSheet: 0.35,
    yellowCard: 0.25,
    redCard: 1.3,
    performanceEffect: 0.035,
    min: 3.0,
    max: 10.0,
  },
};

/** Overrides parciales y anidados de la configuracion. */
export type ConfigOverrides = {
  readonly [K in keyof EngineConfig]?: Partial<EngineConfig[K]>;
};

/** Mezcla overrides sobre la configuracion por defecto (un nivel de profundidad). */
export function resolveConfig(overrides?: ConfigOverrides): EngineConfig {
  if (!overrides) return DEFAULT_CONFIG;
  const out: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(overrides) as (keyof EngineConfig)[]) {
    const patch = overrides[key];
    if (!patch) continue;
    out[key] = { ...DEFAULT_CONFIG[key], ...patch };
  }
  return out as EngineConfig;
}
