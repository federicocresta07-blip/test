# Interfaz web — diseño y estado

Prototipo de la interfaz del juego, construido sobre el master prompt de UI
v0.2. El plan es incremental y por fases: **entregadas las fases 0, 1, 2, 3 y
7**. La sección 22 pedía empezar por las fases 0 a 2; el resto avanza de a una
fase por entrega. La 7 se adelantó a pedido: es la que permite jugar los
partidos, y sin ella el resto del juego no se puede probar.

---

## Estado por fases

| Fase | Alcance | Estado |
|---|---|---|
| **0** | Fundaciones: tokens, AppShell, Sidebar, TopBar, routing, componentes base, modelos y mocks | **Entregada** |
| **1** | Despacho del Manager: próximo partido, situación del plantel, bandeja, widgets | **Entregada** |
| **2** | Plantel y Alineación estilo PC Fútbol | **Entregada** (incluye drag & drop, ficha rápida, táctica y autoselección) |
| **3** | Staff, desarrollo e instalaciones | **Entregada** (incluye contratación y mejora reales, y la bandeja completa) |
| **7** | Competición y resultado de partido | **Entregada** (el torneo se juega de verdad: fixture, tabla, goleadores, ficha de partido, rivales y noticias) |
| 4 | Inferiores, scouting y entrenamiento | Pendiente |
| 5 | Mercado y negociaciones | Pendiente |
| 6 | Estadio y finanzas | Pendiente |
| 8 | Hardening y preparación para backend real | Pendiente |

La pantalla de **Entrenamiento** se movió de la fase 3 a la fase 4. No es un
recorte de alcance disimulado: los planes de entrenamiento necesitan que el
motor sepa hacer crecer los atributos de un jugador con el tiempo, y eso hoy
no existe —`progression/after-match.ts` mueve forma, moral, fatiga y cohesión,
pero no toca los atributos—. Es la misma pieza que necesita inferiores, así
que las dos van juntas. Las fichas de los cuatro entrenadores por línea dicen
"Entrenamiento, fase 4", y un test verifica que esa fase sea exactamente la
que declara la navegación: si alguien mueve una, la otra falla.

Los 9 módulos pendientes están en la navegación con su página propia, que
dice qué va a hacer y en qué fase se construye. Ninguno tiene botones que
finjan funcionar: la página pendiente no tiene un solo botón.

---

## Cómo se ejecuta

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de producción
npm run typecheck  # motor + UI, por separado
npm test           # 237 tests
```

Requiere Node 22.18 o superior.

---

## Decisiones de arquitectura

### La UI consume el motor real

No hay números inventados en la interfaz. Todo lo futbolístico sale de
`src/ui/lib/engine-bridge.ts`, y ahí todo sale del motor de simulación:

| Qué muestra la UI | De dónde sale |
|---|---|
| Overall por puesto | `overallForPosition` |
| Overall efectivo fuera de posición (§6.5) | `positionalOverall` |
| Ataque / Mediocampo / Defensa / Arquero (§6.8) | `computeTeamStrength` |
| AUTOSELECCIONAR XI (§6.12) | `buildAutomaticLineup` |
| Formaciones disponibles (§6.6) | `FORMATIONS` del motor |
| Opciones de táctica (§6.10) | el tipo `Tactics` del motor |
| Fortalezas de un rival (§13) | `teamStrengthOf` → `computeTeamStrength` |
| El resultado del partido (§14) | `simulateMatch` |
| La tabla del torneo (§13) | `buildTable` sobre los partidos jugados |

La sección 6.5 pide explícitamente que la penalización por jugar fuera de
posición venga del motor y no esté hardcodeada en el componente. Se cumple
literalmente: `positionalOverall` es una función del motor, y para que no
existieran dos fórmulas se extrajo el cálculo que ya usaba
`evaluatePerformance` y ahora las dos parten de la misma.

Un defensor central puesto al arco pasa de 70 a 26. La interfaz **no lo
bloquea** — muestra el efecto, como pide la sección 6.5.

### Una sola fuente de verdad

```
GameProvider          estado del cliente (GameState)
  └─ useLineupEditor  TODA la lógica de mutación de la alineación
       └─ componentes  visuales, sin estado propio del juego
```

Los componentes no guardan copias del plantel ni de la alineación. La
invariante que mantiene el editor: **un jugador está en la cancha, en el
banco o sin convocar; nunca en dos lugares a la vez.**

### La capa de servicios es reemplazable

```
src/ui/services/types.ts            contrato que va a implementar el backend
src/ui/services/mockGameService.ts  única pieza que sabe que los datos son mocks
src/ui/services/index.ts            el singleton: cambiar el mock por HTTP es una línea
```

Todo devuelve promesas aunque el mock resuelva al instante, así los estados
de carga y error de la interfaz son los definitivos.

### Dependencias

El motor sigue con **cero dependencias de runtime**. La interfaz agrega
**solo React** (y Vite como herramienta de build). Nada más:

- **Drag & drop**: HTML5 nativo. No hace falta una librería.
- **Router**: 60 líneas propias en `src/ui/router/router.tsx`. Las rutas son
  planas y no justifican una dependencia.
- **Iconos**: un set mínimo de SVG inline.
- **Gráficos**: barras con CSS.

---

## Estructura

```
index.html
vite.config.ts
tsconfig.json          el motor (Node, sin DOM)
tsconfig.ui.json       la interfaz (DOM + JSX)

src/ui/
  main.tsx             punto de entrada
  App.tsx              resolución de rutas
  styles/
    tokens.css         TODOS los tokens visuales
    base.css           reset y globales
  router/
    router.tsx         router propio basado en hash
    navigation.ts      mapa de navegación: qué existe y qué está pendiente
  models/              Club, ClubPlayer, Staff, Facility, Fixture, TransferOffer…
  services/            contrato + mock reemplazable
  state/
    GameProvider.tsx   estado del cliente
    useLineupEditor.ts lógica de la alineación
  lib/
    engine-bridge.ts   único puente con el motor
    positions.ts       reglas visuales de posiciones
    ratings.ts         escala de color de ratings, forma y energía
    tactics-labels.ts  traducción de las claves del motor a castellano
    alerts.ts          alertas derivadas del plantel
    preparation.ts     estado de preparación del equipo
    fixtures.ts        consultas del calendario
    format.ts          plata, fechas y números
  components/
    AppShell · Sidebar · TopBar · ClubHeader · ClubBadge · Icon
    ui/                Button, Badge, RatingBadge, StatusBadge, Panel,
                       ProgressBar, Stars, Tabs, Tooltip, Modal, Drawer,
                       DataTable, EmptyState, Skeleton
    player/            PlayerCells, PlayerQuickPanel
    squad/             SquadTable
    formation/         FormationPitch, PlayerChip, BenchStrip, TeamMetrics,
                       TacticsPanel, pitch-layout
    dashboard/         NextMatchCard, SquadSituation, ManagerInbox,
                       MarketWidget, FinanceWidget, DevelopmentWidget,
                       CompetitionWidget
    match/             Scoreboard, ProjectionStrip, MatchTimeline,
                       MatchStats, MatchRatings
  pages/               DashboardPage, SquadPage, LineupPage, StaffPage,
                       FacilitiesPage, MessagesPage, CalendarPage,
                       ResultsPage, TablePage, StatsPage, MatchPage,
                       RivalsPage, NewsPage, PlaceholderPage
  data/                dataset de demostración, desacoplado de los componentes
```

    club/              EffectReadout, StaffCard, UpgradeCard, FacilityCard,
                       VacancyCard, InvestmentBanner

El listado de la sección 16 está completo: `StaffCard` y `UpgradeCard` se
construyeron en la fase 3, que es cuando aparecieron sus primeros usos.

---

## El torneo se juega de verdad

Antes de la fase 7 la tabla era esto:

```ts
const SEEDS = [
  ['velez', 9, 3, 2, 26, 13, 'VVEVD'],
  ['river', 8, 4, 2, 27, 14, 'VEVVD'],
  // ...dieciocho filas más, con los puntos cuadrados a mano
];
```

Veinte filas inventadas, con un test que verificaba que los números cerraran
entre sí. Cerraban, pero no venían de ningún partido: jugar no las movía.

Ahora **el torneo se juega**. `src/competition/` es un módulo de dominio sin
dependencias, con tres piezas:

| Pieza | Qué hace |
|---|---|
| `fixtures.ts` | Fixture de una vuelta por el método del círculo, determinista |
| `table.ts` | La tabla, **calculada** desde los partidos jugados |
| `stats.ts` | Goleadores, asistencias y notas, acumulados fecha a fecha |
| `season.ts` | Juega la fecha completa y guarda lo que pasó |

Y los veinte planteles existen: el del manager está escrito a mano en
`data/squad.ts`, los otros diecinueve los genera `data/league.ts` con el mismo
generador que usa la calibración del motor. **Los diez partidos de cada fecha
pasan por `simulateMatch`** —el propio con la alineación elegida, los otros
nueve IA contra IA, como pide la sección 49 del motor—, y de ahí sale todo lo
demás: la tabla, los goleadores, la forma, la moral, la fatiga, las lesiones,
las suspensiones, la cohesión y las noticias.

Una temporada completa medida: 190 partidos, 2,27 goles por partido, reparto
local-empate-visitante de 39,5% / 24,2% / 36,3%, y el goleador del torneo con
10 goles en 19 fechas. `npm run torneo` lo corre e imprime la tabla final con
sus controles de coherencia.

### Tres bugs que encontró esta fase

**Uno de la fase 7 y dos del motor.** Vale anotarlos porque los tres estaban
escondidos detrás de algo que parecía funcionar.

**1. Un club no jugó el torneo entero.** Puse `'5-4-1'` y la formación se llama
`'4-5-1'`. El `catch` de `playRound` convertía cualquier error en "no se pudo
simular el partido", así que Platense terminó con 0 partidos jugados y el
síntoma no decía la causa. Dos arreglos: `createTactics` ahora **valida el id
de formación** —falla al construir la táctica, con el listado de las
disponibles, y no a mitad del primer partido—, y `playRound` solo atrapa
`InsufficientPlayersError`, que es un estado legítimo del juego. Cualquier otro
error se propaga: un bug no se degrada a "no se pudo jugar".

**2. La fatiga no podía acumularse nunca.** Un partido de 95 minutos costaba
unos 36 puntos y tres días de descanso recuperaban 42. Es decir: repetir el
mismo once toda la temporada era gratis, y todo el sistema de fatiga y de
profundidad del plantel (secciones 37 y 48) quedaba inerte. Peor: los números
de la recuperación estaban **escritos a mano** dentro de
`progression/after-match.ts`, fuera del config centralizado que pide la
sección 52. Ahora están en `config.progression` y recalibrados:

| Descanso | Fatiga que queda encima |
|---|---|
| 7 días | 0 (recuperado) |
| 4 días | ~14 |
| 3 días | ~19 |

Y el calendario tiene fechas de mitad de semana a propósito —el patrón es
`7, 7, 4, 3, …`—, de donde salen **a la vez** el día que muestra el calendario
y los días de descanso que usa la progresión. Que los dos números vengan del
mismo lugar es lo que hace que "el jueves y el domingo" se sienta distinto de
"domingo a domingo". La calibración del motor no se tocó: `recovery()` vive
solo en la progresión y no se referencia en ningún punto de `simulateMatch`,
así que un partido suelto no puede haber cambiado.

**3. Un club jugaba 16 partidos de local sobre 19.** Alternar la localía por
paridad de la fecha —lo primero que uno escribe— no funciona: el equipo que
queda fijo en el círculo siempre cae en la misma posición. Ahora la localía se
asigna al que viene más necesitado, con una pasada de corrección que da vuelta
los partidos que arreglan las dos puntas a la vez. Verificado contra 1.400
sorteos: nadie se desvía más de un partido del reparto parejo.

### Lo que se guarda y lo que se recalcula

Guardar 440 jugadores completos serían varios megabytes y además quedaría
congelado. Se guarda **solo lo que no se puede volver a calcular**:

- los partidos jugados (marcador, estadísticas, goleadores, y el detalle
  completo de los del manager);
- el estado de cada jugador, como una tupla de seis números;
- la cohesión de cada club.

El fixture, la tabla, los planteles base, los atributos y las fechas del
calendario se reconstruyen: son deterministas. Medido, una temporada de 19
fechas ocupa unos **730 kB**; si el navegador se queda sin lugar,
`writeSeason` adelgaza los partidos ajenos, reintenta una vez, y si sigue sin
entrar **lo dice en pantalla** en lugar de perder la temporada en silencio.

Hay una limitación que las pantallas declaran: las **notas y los minutos** solo
se guardan de los partidos que dirige el manager. De un partido entre dos
clubes de IA sabemos quién convirtió, pero no cuántos minutos jugó el resto, y
sumar cero minutos a alguien que jugó los noventa sería peor que no sumar nada.
Por eso la tabla de estadísticas muestra entre paréntesis sobre cuántos
partidos se calcula cada promedio, y la de mejores notas pide un mínimo de
tres.

### La cohesión tenía dos fuentes de verdad

`engine-bridge.ts` estimaba la cohesión del plantel a partir de la moral media
y la estabilidad del once. Pero la progresión del motor **ya la calcula** después
de cada partido (sección 39), y era ese número el que se usaba para simular. Eran
dos valores distintos para la misma cosa, y el de la interfaz no era el que
mandaba. Ahora `teamChemistry()` lee el de la temporada.

Lo mismo con las amarillas: `ClubPlayer.yellowCards` estaba declarado en los
datos de demostración. Ahora se cuenta del torneo, así que en la fecha 1 todos
tienen cero —que es la verdad— y el aviso de riesgo de suspensión aparece
cuando de verdad hay riesgo.

---

## Staff e instalaciones: el problema de los boosts mágicos

El criterio de aceptación de la fase 3 dice *"no hay boosts mágicos o
ambiguos"*. Lo que había antes era exactamente eso: el staff de demostración
guardaba `currentEffect: '+12% velocidad de entrenamiento'`, un **string
escrito a mano**. Nada lo calculaba y nada lo consumía.

Ahora el efecto es un número que sale de `src/domain/staff.ts`, y la pantalla
solo lo muestra. Tres reglas ordenan el módulo:

**1. El efecto no se guarda, se calcula.** `StaffMember` guarda quién es y en
qué nivel está, nada más. El salario, el efecto, el coste de mejora y el
mantenimiento se derivan del modelo de dominio, así que no puede pasar que la
pantalla diga una cosa y el juego aplique otra. Cambiar un número de balance
se refleja en una partida ya empezada en lugar de quedar congelado.

**2. Las instalaciones limitan al staff, y se ve de los dos lados.**

```
utilisation = 0,55 + 0,45 × (nivel de instalación / nivel del profesional)
```

Acotado a 1: **una instalación mejor de lo necesario nunca potencia**, solo
deja de limitar. Al revés sí recorta. Un preparador físico ★5 en un centro de
entrenamiento ★2 tiene un nominal de 26% y entrega 19%, y la ficha dice las
dos cosas más el 73% que las explica. La ficha del profesional muestra el
acople desde su lado ("esta instalación me limita al 73%") y la ficha de la
instalación desde el otro ("está frenando a 1 de los 2 que respalda"). Sin
esa segunda mitad, la decisión entre invertir en personas o en ladrillo se
toma a ciegas.

Para los roles que se leen como una reducción hay un detalle que ya nos
confundió una vez: el aprovechamiento se aplica sobre **lo que el nivel agrega
respecto de un nivel 1**, no sobre el número crudo. Y `direction` dice cómo se
*lee* el efecto (+21% o −32%), no para dónde se mueve la tabla al subir de
nivel: el médico "reduce" y su número **crece** con el nivel (reduce más),
mientras que el margen de error del ojeador **baja**. Eso no se declara dos
veces: `higherIsBetter(role)` se deriva de la tabla del rol, así que no puede
contradecirla.

**3. Cada efecto dice quién lo consume.** Tres roles tienen contraparte real
hoy —preparador físico, médico y psicólogo, vía
`progressionEffects()` → `updateAfterMatch`/`advanceDays`— y su ficha dice "se
aplica hoy". Los otros diez declaran el módulo que los va a usar y en qué fase
se construye, y su ficha lo dice tal cual: *"Todavía no se aplica · Scouting y
mercado, fase 4"*. Un test (`HONESTIDAD` en `tests/staff.test.ts`) verifica que
ningún rol se declare implementado si la progresión no lo consume de verdad, y
que cada pendiente apunte a una fase futura. Es lo que hace que el criterio
siga siendo cierto dentro de seis meses y no solo el día que se escribió.

Medido de punta a punta, la fatiga de un titular después de un partido y tres
días de descanso: **14** sin staff, **9** con staff ★5 en instalaciones ★1,
**5** con staff ★5 en instalaciones ★5.

### Los mensajes de la bandeja se derivan del estado

Parte de la Bandeja del Manager ya no son datos fijos: `lib/staff-messages.ts`
los calcula desde el cuerpo técnico y las instalaciones que hay ahora. El
profesional más limitado se queja con su propio porcentaje, la dirigencia
enumera los puestos vacantes con el coste real del candidato más accesible, y
el informe del ojeador juvenil trae el rango de potencial con el ancho que le
da su efecto (±8 puntos con la academia en ★2). Si mejorás la instalación que
frena a alguien, su mensaje **desaparece solo**; si el puesto de ojeador
juvenil está vacante, su informe no existe. Nadie tiene que acordarse de
borrarlo.

---

## Disposición de la cancha

El motor define los puestos y sus tareas; **cómo se leen en pantalla es una
decisión de diseño** y vive en `pitch-layout.ts`, con la cantidad de
jugadores por línea de cada formación:

```
4-3-3   → [1, 4, 3, 3]
4-2-3-1 → [1, 4, 2, 3, 1]
4-3-1-2 → [1, 4, 3, 1, 2]
5-3-2   → [1, 5, 3, 2]
```

Dentro de cada línea, los jugadores se ordenan por amplitud (el zurdo a la
izquierda) y la línea se abre o se comprime según tenga o no jugadores de
banda: una defensa de cuatro usa casi todo el ancho, un mediocampo de tres
central se comprime al medio.

`tests/pitch-layout.test.ts` verifica que cada formación del motor tenga sus
líneas declaradas, que sumen once, que nadie quede fuera del campo, que el
arquero vaya al fondo y centrado, y que los puestos de banda queden de su
lado. Ese test nació de un bug real: los laterales y extremos se dibujaban
fuera de la cancha.

El 4-3-1-2 que pide la sección 6.6 no existía en el motor y se agregó, con
modificadores de suma cero como el resto de las formaciones.

---

## Datos de demostración

Siguiendo la sección 19:

- **Los clubes son reales** porque son instituciones públicas y hacen creíble
  el prototipo. No se usan escudos: el badge se dibuja con las iniciales y
  los colores institucionales.
- **Los jugadores son inventados.** No representan a futbolistas reales.
- **Todo está marcado como demo** con una insignia visible en la barra
  superior.

Los datos son coherentes entre pantallas y hay tests que lo verifican: las
ofertas apuntan a jugadores que existen en el plantel, las rutas de los
mensajes de la bandeja existen en la navegación, y la tabla cierra como un
torneo de verdad (las victorias igualan a las derrotas, los empates son un
número par y los goles a favor igualan a los goles en contra). Ese último
test también salió de un error real en los datos escritos a mano.

---

## Verificación

**Tests automatizados** (`npm test`, 162 en total):

- `tests/ui-logic.test.ts` — el puente con el motor, las alertas derivadas,
  el estado de preparación, la autoselección, el cambio de formación sin
  perder la selección, y la coherencia del dataset demo.
- `tests/pitch-layout.test.ts` — la disposición de la cancha.

**Flujos en el navegador** (`scripts/ui-smoke.mjs`, 20 comprobaciones): la
navegación, el once completo, el cambio de formación conservando jugadores, el
drag & drop del plantel a la cancha, las métricas actualizándose en vivo, el
aviso de cambios sin guardar y la confirmación de guardado, la ficha rápida
sin salir de la pantalla, el marcado de jugador fuera de posición con su
overall efectivo, el panel de táctica, la autoselección, el banco, los
filtros por posición y el ordenamiento por overall.

Necesita Playwright, que no es dependencia del proyecto; se instala aparte
para correrlo. Convertirlo en tests automatizados es la fase 8.

**Medido a mano**: sin errores de consola, y sin scroll horizontal a 1440,
1280, 1100 ni 900 px de ancho. El objetivo es 1440×900.

---

## Lo que sigue

Con la fase 7 el prototipo se juega: se prepara el equipo, se juega la fecha, y
el torneo avanza con sus consecuencias. Lo próximo es la fase 4 (inferiores,
scouting y entrenamiento), que empieza por el motor: hacer crecer los atributos
de un jugador con el tiempo, que es lo que hoy falta y lo que desbloquea de una
vez los cuatro entrenadores por línea, el entrenador juvenil y los dos
ojeadores. Después la 5 (mercado), la 6 (estadio y finanzas) y la 8
(preparación para el backend real).

Dos cosas que la fase 7 deja anotadas como deuda explícita:

- **La Primera Nacional no se simula.** Sus cuatro clubes existen para el
  mercado y los ascensos, y la pantalla de tabla lo dice en lugar de mostrar
  una tabla inventada.
- **El torneo es de una sola vuelta** (19 fechas). Dos vueltas, copas y
  descensos son parte de la fase 6/7 ampliada.

Vale una nota sobre la fase 7: el resultado de partido ya está resuelto del
lado del motor —`simulateMatch` devuelve marcador, eventos minuto a minuto,
estadísticas completas, notas individuales, mejor jugador y el relato del
partido—, así que esa fase es sobre todo trabajo de interfaz.
