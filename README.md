# Match Engine

Motor de simulación de partidos de fútbol para un juego de management.

No hay partido 2D ni 3D ni movimiento de jugadores: el partido se resuelve
con el motor de simulación, el usuario ve el marcador y después consulta las
estadísticas. Todo el esfuerzo está puesto donde importa, que es la calidad
de la simulación.

```
RIVER PLATE 2 - 1 RACING CLUB
```

## Cómo se usa

Requiere **Node 22.18 o superior** (ejecuta TypeScript de forma nativa).
El motor no tiene dependencias de runtime.

```bash
npm install        # solo TypeScript y los tipos de Node, para el typecheck
npm run demo       # simula un partido y muestra todo lo que el motor sabe contar
npm run season     # 10 fechas seguidas con evolución del plantel
npm test           # 134 tests
npm run typecheck
npm run calibrate  # miles de partidos y distribución de resultados
```

### Simular un partido

```ts
import { simulateMatch, riverPlate, racingClub, formatMatchSummary } from './src/index.ts';

const result = simulateMatch({
  home: riverPlate(),
  away: racingClub(),
  seed: 'fecha-1',      // con la misma semilla el partido se resuelve igual
  importance: 0.6,      // 0 amistoso .. 1 final: modula el peso de la experiencia
});

console.log(result.scoreline);   // "RIVER PLATE 2 - 1 RACING CLUB"
console.log(result.narrative);   // explicación del partido basada en lo que pasó
console.log(formatMatchSummary(result));
```

`simulateMatch` es **puro**: no muta los equipos que recibe y con la misma
entrada y la misma semilla devuelve exactamente el mismo partido.

El mismo punto de entrada resuelve **HUMANO vs HUMANO, HUMANO vs IA e IA vs IA**.
El motor no tiene noción de quién controla cada equipo, así que la coherencia
estadística está garantizada por construcción.

### Armar un equipo

```ts
import { createPlayer, createTeam, createTactics, attributesFor } from './src/index.ts';

const nueve = createPlayer({
  id: 'dc-1',
  name: 'Gonzalo Arriaga',
  position: 'DC',
  age: 27,
  // attributesFor arma el perfil del puesto para un overall objetivo;
  // los rasgos propios se pasan aparte.
  attributes: attributesFor('DC', 87, { definicion: 92, posicionamiento: 90 }),
  secondaryPositions: ['SD'],
  condition: { form: 78, morale: 70, fatigue: 8, sharpness: 92 },
});

const equipo = createTeam({
  id: 'river',
  name: 'River Plate',
  players: [nueve /* ... */],
  chemistry: 74,
  tactics: createTactics({
    formationId: '4-3-3',
    mentality: 'ofensiva',
    pressing: 'alta',
    passingStyle: 'posesion',
    attackFocus: 'bandas',
  }),
  setPieceTakers: { penales: 'dc-1' },
  instructions: [
    { minute: 60, when: 'perdiendo', changes: { mentality: 'ofensiva', pressing: 'alta' } },
  ],
});
```

Si no se pasa alineación, el motor arma el mejor once posible para la
formación elegida, evaluando cada jugador en cada puesto (posición, forma,
moral, fatiga, adecuación táctica) **sin usar azar**: la IA no puede ver la
suerte del partido al armar el equipo.

### Cerrar la fecha

El motor de partido no muta nada. El ciclo de la temporada se cierra con el
módulo de evolución:

```ts
import { updateAfterMatch, advanceDays } from './src/index.ts';

const { team, injuries, suspensions, notes } = updateAfterMatch({
  team: equipo,
  result,
  side: 'local',
  restDays: 4,        // cuánto se recupera hasta el próximo partido
  newSignings: 0,     // afecta la cohesión
});
// `team` ya trae forma, moral, fatiga, cohesión, lesionados y sancionados al día.

const trasElParon = advanceDays(team, 14);  // recupera fatiga y descuenta lesiones
```

`npm run season 20 3` corre veinte fechas con tres días de descanso y muestra
cómo se mueven la cohesión, la forma, la moral, la fatiga y las bajas.

### Calibrar

```bash
npm run calibrate                  # batería de escenarios de referencia
npm run calibrate -- muestra       # River Plate vs Racing Club
npm run calibrate -- 82 78 20000   # un cruce puntual, 20.000 partidos
```

```
Local (82) vs Visitante (82) — 8.000 simulaciones

  Gana Local (82)        43.5%   (modelo: 43.4%)
  Empate                  26.3%   (modelo: 27.0%)
  Gana Visitante (82)    30.2%   (modelo: 29.6%)

  Goles promedio     1.43 - 1.15   (total 2.58)

  Marcadores mas frecuentes:
    1-1     12.32%
    1-0     10.12%
    2-1      9.68%
```

**Todos los parámetros que afectan el equilibrio viven en un solo archivo**:
[`src/config/engine-config.ts`](src/config/engine-config.ts). No hay números
críticos dispersos por el código. Se pueden probar variantes sin editarlo:

```ts
simulateMatch({ home, away, seed: 1, config: { chances: { baseShots: 12 } } });
simulateMany({ home, away, matches: 10_000, config: { matchups: { globalScale: 0 } } });
```

## El principio del motor

> El objetivo no es determinar quién *merece* ganar, sino qué probabilidades
> tiene cada equipo de producir cada resultado.

```
calidad + táctica + jugadores + estado + contexto  ->  probabilidades
probabilidades + azar controlado                   ->  resultado
```

El azar nunca decide el ganador. Actúa siempre sobre probabilidades que el
motor construyó antes: por eso el mejor equipo gana más seguido, pero nunca
tiene el partido garantizado.

Concretamente, **el resultado no depende solo del overall**. Un mismo par de
equipos de 78 cambia de favorito según la táctica, la formación, el estado de
sus jugadores, la cohesión y el cruce entre estilos. Hay tests que lo verifican.

## Las cinco etapas del partido

```
   ETAPA 1   Control del partido      ->  reparto de posesión
   ETAPA 2   Creación de ocasiones    ->  cuántos remates genera cada uno
   ETAPA 3   Calidad de las ocasiones ->  el xG de cada remate
   ETAPA 4   Conversión               ->  gol o no gol
   ETAPA 5   Resultado                ->  minuto a minuto, con cambios y fatiga
```

Las etapas 2 y 3 usan **combinaciones distintas de dimensiones a propósito**:
generar muchas ocasiones y generar ocasiones claras no son la misma virtud.
Un equipo puede remar todo el partido y llegar poco al área.

Antes de simular, el motor calcula los goles esperados de cada equipo y las
probabilidades de cada resultado:

```
Goles esperados: 1.87 - 0.88
Probabilidades: RIV 60.6% | empate 22.2% | RAC 17.3%
```

Después juega el partido. Sobre miles de simulaciones el modelo previo y la
simulación coinciden dentro de un par de puntos, lo que sirve como control de
que las dos mitades del motor dicen lo mismo.

## Fuerza del equipo por dimensiones

El motor nunca usa "la media del equipo". Calcula nueve capacidades a partir
de los atributos que importan en cada una, del rendimiento efectivo de cada
titular, del puesto y las tareas que le asigna la formación, y de la táctica:

```
River Plate                      Racing Club
  ATAQUE         83                ATAQUE         80
  MEDIOCAMPO     83                MEDIOCAMPO     73
  DEFENSA        79                DEFENSA        73
  ARQUERO        90                ARQUERO        80
  FISICO         81                FISICO         76
  CREACION       83                CREACION       71
  PRESION        86                PRESION        76
  CONTRAATAQUE   78                CONTRAATAQUE   80
  BALONPARADO    74                BALONPARADO    72
```

El promedio es una **media de potencia con exponente mayor a 1**: un 92
levanta la dimensión más de lo que la hunde un 60. Así la calidad individual
se nota sin que un crack tape a diez jugadores flojos.

## Documentación

- [`docs/match-engine.md`](docs/match-engine.md) — diseño del motor en detalle:
  qué hace cada módulo, cómo se compone el rendimiento de un jugador, cómo se
  resuelven los cruces tácticos, y el mapa completo de la especificación
  (secciones 25 a 53) contra el código y los tests que la verifican.
- [`docs/calibracion.md`](docs/calibracion.md) — estado actual de la
  calibración, los valores objetivo y cómo recalibrar.

## Estructura

```
src/
  config/engine-config.ts      TODOS los parámetros del motor
  core/                        azar con semilla, utilidades numéricas
  domain/                      atributos, posiciones, jugador, equipo,
                               formaciones, tácticas, alineación
  ratings/                     overall por posición, adecuación a la posición,
                               rendimiento efectivo, fuerza por dimensiones
  engine/                      las cinco etapas, balón parado, disciplina,
                               cambios, cruces tácticos, notas, relato
  progression/                 forma, moral, fatiga, cohesión, lesiones
  calibration/                 miles de simulaciones y su informe
  presentation/                marcador, tabla de estadísticas, notas
  data/                        generador de planteles y equipos de ejemplo
tests/                         134 tests
scripts/                       demo y calibración
```
