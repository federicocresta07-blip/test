# Interfaz web — diseño y estado

Prototipo de la interfaz del juego, construido sobre el master prompt de UI
v0.2. El plan es incremental y por fases: **entregadas las fases 0 a 5 y la
7**. La sección 22 pedía empezar por las fases 0 a 2; el resto avanza de a una
fase por entrega. La 7 se adelantó a pedido: es la que permite jugar los
partidos, y sin ella el resto del juego no se puede probar.

El estado de cada fase se declara en un solo lugar, `src/ui/router/plan.ts`, y
lo consultan la navegación, la sidebar y las fichas del staff. Antes vivía en
tres lugares y se desincronizó: ver más abajo.

---

## Estado por fases

| Fase | Alcance | Estado |
|---|---|---|
| **0** | Fundaciones: tokens, AppShell, Sidebar, TopBar, routing, componentes base, modelos y mocks | **Entregada** |
| **1** | Despacho del Manager: próximo partido, situación del plantel, bandeja, widgets | **Entregada** |
| **2** | Plantel y Alineación estilo PC Fútbol | **Entregada** (incluye drag & drop, ficha rápida, táctica y autoselección) |
| **3** | Staff, desarrollo e instalaciones | **Entregada** (incluye contratación y mejora reales, y la bandeja completa) |
| **4** | Inferiores, Scouting y Entrenamiento | **Entregada** (el motor ya hace crecer los atributos de un jugador) |
| **5** | Mercado y negociaciones | **Entregada** (buscador, transferibles, ofertas en los dos sentidos e historial; el valor y el sueldo se calculan) |
| **7** | Competición y resultado de partido | **Entregada** (el torneo se juega de verdad: fixture, tabla, goleadores, ficha de partido, rivales y noticias) |
| 6 | Estadio y finanzas | Pendiente |
| 8 | Hardening y preparación para backend real | Pendiente |

Los 2 módulos pendientes están en la navegación con su página propia, que
dice qué va a hacer y en qué fase se construye. Ninguno tiene botones que
finjan funcionar: la página pendiente no tiene un solo botón.

---

## Cómo se ejecuta

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de producción
npm run typecheck  # motor + UI, por separado
npm test           # 311 tests
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
| El margen para crecer de un jugador | `headroom` sobre su potencial |
| El rango de potencial de un juvenil | `scoutPotential` con el efecto del ojeador |

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
    season-bridge.ts   fixture, fechas y tabla del torneo
    market-bridge.ts   pool del mercado, precisión del informe y filtros
    scouting.ts        cuánto del rival muestra el analista
    news.ts            noticias derivadas de los resultados
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
    market/            PlayerReport, OfferDialog
    youth/             PotentialRange
  pages/               DashboardPage, SquadPage, LineupPage, StaffPage,
                       FacilitiesPage, MessagesPage, CalendarPage,
                       ResultsPage, TablePage, StatsPage, MatchPage,
                       RivalsPage, NewsPage, TrainingPage, YouthPage,
                       MarketSearchPage, TransferListPage, OffersPage,
                       TransferHistoryPage, PlaceholderPage
  data/                dataset de demostración, desacoplado de los componentes
```

    club/              EffectReadout, StaffCard, UpgradeCard, FacilityCard,
                       VacancyCard, InvestmentBanner

El listado de la sección 16 está completo: `StaffCard` y `UpgradeCard` se
construyeron en la fase 3, que es cuando aparecieron sus primeros usos.

---

## Los jugadores crecen

Hasta la fase 4, `progression/after-match.ts` movía forma, moral, fatiga y
cohesión — y **los atributos no cambiaban nunca**. El campo `potential` existía
en `Player` con este comentario: *"informativo para el resto del juego"*. Su
valor por defecto era el overall actual, así que nadie tenía margen y nadie
podía crecer.

Eso obligaba a seis de los trece roles del cuerpo técnico a decir "todavía no
se aplica": cuatro entrenadores por línea, el entrenador juvenil y el ojeador
juvenil. "Velocidad de desarrollo de defensores" no podía significar nada.

Ahora `progression/development.ts` hace crecer a un jugador, y cuatro cosas lo
mueven — ninguna es azar puro:

**La edad.** Un pibe de 18 crece rápido, a los 27 se estanca, después de los 31
empieza a perder. Y no pierde todo junto: primero se va lo físico. Un 5 de 33
sigue mejorando las entradas y la calidad mientras le baja la velocidad, y eso
es lo que hace que un veterano siga sirviendo.

**El techo.** Se crece hacia el potencial, no sin límite. El potencial por
defecto ahora sale de `defaultPotential(overall, edad, id)`: mucho margen a los
17, casi ninguno a los 30, con variación — dos pibes de 18 con el mismo overall
pueden tener techos de 71 y de 83, y **el club no sabe cuál es cuál**.

**Los minutos.** El que no juega crece cerca de la mitad de rápido. Es la única
forma de que darle la camiseta a un juvenil sea una decisión de verdad.

**El entrenamiento.** El plan reparte hacia dónde va el crecimiento —no suma,
reparte— y el entrenador de su línea lo acelera. `domain/training.ts` mapea cada
puesto a su entrenador, y por eso mejorar al entrenador de arqueros no le hace
nada al 9.

Medido sobre una temporada de 19 fechas (unas 22 semanas):

| Jugador | Gana |
|---|---|
| Juvenil de 17 con margen, jugando, entrenador ★4 | **+13** de overall |
| El mismo sin entrenador | +9 |
| El mismo sin jugar | +7 |
| Titular de 22 con algo de margen | +4 |
| Jugador de 27 o más en su techo | 0 |
| Veterano de 34 | −2 de físico, y el resto casi quieto |

Los números se volvieron a medir después de bajar el motor a diez atributos: el
crecimiento se reparte entre menos atributos, así que el overall se mueve algo
más por la misma cantidad de trabajo.

### Muerte por redondeo

El bug más interesante de esta fase. `clampAttribute` redondea a entero, y el
desarrollo se aplica fecha a fecha: una ganancia de 0,4 puntos por semana se
redondeaba a cero y **no se acumulaba nunca**. El sistema no fallaba, no tiraba
errores, y era completamente inerte — un juvenil con veinte puntos de margen
ganaba cero en una temporada entera.

Los atributos ahora se guardan con decimales y el redondeo pasa al mostrar, que
es donde corresponde. `developPlayer` no usa `createPlayer` a propósito: pasa
los atributos por `buildAttributes`, que redondea, y eso volvería a tirar los
decimales. El test `MUERTE POR REDONDEO` compara desarrollar semana a semana
contra hacerlo de una vez, y exige que den lo mismo en orden de magnitud.

### El potencial de un juvenil es un rango

La pantalla de inferiores nunca muestra el potencial exacto. Muestra lo que
informa el ojeador, que es un rango, y **el ancho de ese rango sale del efecto
del rol** — el mismo número que muestra su ficha en Staff.

Medido en el navegador: con el puesto de ojeador juvenil vacante los rangos
salen de **44 puntos** ("potencial entre 49 y 93", confianza *muy baja*); al
contratar a una ojeadora de cuatro estrellas pasan a **16 puntos** y la
precisión declarada va de "sin ojeador" a "±8 pts". El techo real del jugador no
cambió: cambió cuánto se ve.

Dos reglas del informe, las dos verificadas:

1. **El real siempre cae dentro del rango.** El ojeador nunca miente, solo es
   impreciso. Sin eso, el rango no querría decir nada.
2. **El real NO está en el centro.** Si estuviera, promediar el rango daría la
   verdad exacta y el ojeador no serviría para nada.

Y hay un guard raro pero deliberado: un test lee el fuente de `YouthPage.tsx` y
falla si la pantalla toca `player.potential`. El potencial real viaja en el tipo
porque el juego lo necesita para promover y desarrollar al jugador; no hay forma
de prohibirlo con tipos sin romper la promoción. Un test que lee el fuente es
feo, y es mejor que confiar en que nadie lo toque.

### La academia decide la camada

Medido sobre 40 camadas por nivel:

| Academia | Juveniles | Potencial medio | Mejor techo |
|---|---|---|---|
| ★☆☆☆☆ | 3 | 56,8 | 62,0 |
| ★★★☆☆ | 4 | 65,6 | 75,2 |
| ★★★★★ | 6 | 74,3 | 87,6 |

Mejorar al ojeador y mejorar la academia hacen cosas **distintas**: el ojeador
angosta el rango sin cambiar al jugador, la academia cambia la camada entera.

### El plan estaba en tres lugares

El estado de cada fase vivía en la tabla de este documento, en la bandera
`ready` de cada entrada de navegación, y en el `consumer` de cada rol del staff
—que promete una fase—. Se desincronizó: el analista de rivales decía
*"todavía no se aplica · Informe de rivales, fase 7"* **después** de que la fase
7 estuviera entregada. Mi test de honestidad pedía `phase > 3`, que seguía
siendo cierto, así que no lo agarró.

Tres arreglos:

- `src/ui/router/plan.ts` declara el estado de cada fase y todo lo demás lo
  consulta. No alcanza con derivarlo de la navegación: la fase 8 no tiene
  pantalla propia y aun así hay efectos que la esperan.
- El test ahora exige que la fase prometida por un rol pendiente **exista en el
  plan y no esté entregada**. Y otro test exige que la navegación y el plan
  digan lo mismo — ese fue el que me avisó, mientras escribía esta fase, que
  había marcado la 4 como entregada con sus dos pantallas sin construir.
- El analista de rivales **ahora se aplica**: `ui/lib/scouting.ts` decide cuánto
  se ve del perfil de un rival según su nivel. Sin analista solo ves lo que ya
  está en la tabla; con nivel 3, las nueve dimensiones; con nivel 5, el plantel
  completo. Antes la pantalla mostraba todo siempre.

Queda **un** rol pendiente, y su fase es verificable: el fisioterapeuta espera
que el motor acepte un riesgo de lesión por equipo (fase 8), que hoy toma de
forma global. El ojeador y el secretario técnico se aplicaron en la fase 5 —son
los que fijan el margen del informe de mercado— y el test de honestidad no los
habría dejado pasar a `implementado` sin un consumidor real.

---

## El mercado no te dice el número

La decisión central de la fase 5. Un mercado donde ves el overall exacto y el
valor exacto de cualquier jugador ajeno no necesita ojeador ni secretario
técnico: los dos roles quedarían como adornos de la pantalla de staff. Así que
el juego conoce el número real y el club ve un **informe**, cuyo margen sale de
lo que su staff es capaz de medir.

```
Buscador, sin ojeador ni secretario técnico:   nivel 72±14   valor 4,2 M ±30%
Con los dos en nivel 5:                        nivel 79±1    valor 8,7 M ±3%
```

Dos invariantes lo gobiernan, y las dos están en tests:

- **la verdad siempre cae dentro del rango informado** — el informe puede ser
  impreciso, no puede mentir;
- **la verdad nunca está en el centro del rango** — si estuviera, el margen no
  significaría nada: bastaría con leer el punto medio para saber el número
  exacto y el ojeador volvería a ser un adorno.

El desplazamiento sale de un `Rng` sembrado con el id del jugador, así que el
informe es el mismo entre recargas: el mercado no se reordena al volver a
entrar.

### El valor estaba escrito a mano y contradecía al mercado

`data/squad.ts` declaraba un `value` y un `salary` por jugador. En cuanto el
mercado empezó a tasar, los dos números se contradijeron: un lateral de 80
figuraba en 6,8 M y el mercado lo tasaba en 18. Un dato escrito a mano al lado
de uno calculado es siempre el dato escrito a mano el que está mal.

Se borraron las 26 declaraciones. Ahora `valuePlayer` deriva el valor de nivel,
edad, puesto y **meses de contrato restantes** —un jugador a seis meses del
final vale una fracción de lo mismo—, y la masa salarial de las Finanzas se
suma de los sueldos derivados en lugar de estar declarada.

Calibrar la curva llevó dos intentos: la primera versión tasaba a todos ~3×
por encima, y una estrella salía 400 M en un torneo donde la caja del club son
decenas de millones. La curva final es cúbica sobre el nivel, no lineal, porque
la diferencia entre 85 y 90 no es la misma que entre 60 y 65.

### La lista de transferibles no está cargada: se calcula

Ningún club declara a quién pone en el mercado. `squadNeed` mide **cuánto
extrañaría el club a cada jugador**, que es la caída de nivel hasta su
reemplazo en el plantel, y `autoTransferList` publica a los que menos necesita.
Un 9 con un suplente de 83 es prescindible; el mismo 9 con un suplente de 68 es
insustituible, aunque en los dos casos sea el mejor de su puesto.

Que se calcule la mantiene coherente: cuando le compras un jugador a un club,
su lista cambia sola.

Llegar ahí llevó tres iteraciones, y las dos primeras fallaron de maneras
opuestas y visibles:

1. una `squadNeed` por escalones dejó la lista **vacía** —ningún jugador caía
   justo en el escalón que publicaba—;
2. al hacerla continua, la lista pasó a ser **todos arqueros**: son los que
   siempre tienen un suplente del mismo puesto, y el desempate por orden de
   plantel los agrupaba;
3. sin tope por club, la lista llegó al **45% de la liga**.

La versión final es continua, desempata por nivel descendente —cada club
prefiere publicar al mejor de los que le sobran, que es el que alguien le va a
comprar— y publica **hasta tres**.

### Los diecinueve clubes ofertaban por el mismo jugador

La primera versión de las ofertas recibidas elegía, para cada club, a tu mejor
jugador. Los veinte elegían al mismo, al mismo precio: la bandeja mostraba
diecinueve ofertas idénticas.

El arreglo tiene dos partes. Un tope de tres ofertas por fecha, y un
`bestTargetFor(club, yaTomados)` que se evalúa **club por club en orden de
reputación**: el más grande elige primero y el siguiente elige entre los que
quedan. Cuando solo puse el tope, la bandeja pasó a mostrar **una** oferta,
porque los clubes cuyo objetivo ya estaba tomado no buscaban un segundo.

### El techo informado no podía pasarse de la edad

El último bug de la fase, y lo encontré leyendo una captura del buscador: un
jugador de 33 años figuraba con techo estimado **78–100**. El margen del
informe se aplicaba a ciegas, y a ciegas cualquiera puede llegar a 100.

Pero hay un límite que el ojeador **sí** conoce con solo mirarle el documento:
la edad. El techo informado se acota ahora con la banda de crecimiento por
edad. Y el arreglo tuvo una segunda mitad que apareció cuando cayó un test: al
recortar el borde de arriba, el rango de un jugador con el techo justo en el
máximo de su edad se angostaba, y **parecía mejor medido que los demás**. La
banda no se recorta, se **corre** hacia abajo: la incertidumbre del ojeador es
la misma, lo único que cambia es hacia dónde puede equivocarse.

```
edad 22, nivel 85  ->  techo 70–94
edad 33, nivel 85  ->  techo 61–85
```

### Lo que este mercado todavía no hace

Los otros diecinueve clubes no fichan entre ellos: sus planteles solo cambian
cuando vos les compras o les vendés. La pantalla de historial lo dice en lugar
de llenar la tabla de movimientos inventados que no afectan a nada. Los
contratos de los jugadores ajenos se asumen en 24 meses, porque el dataset de
los rivales se genera y no los declara.

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
  el prototipo. Desde la ingesta de escudos, los **veinte de Primera llevan su
  escudo oficial**; los cuatro de la Primera Nacional siguen con el badge
  dibujado con iniciales y colores institucionales. Ver más abajo.
- **Los jugadores ya NO son inventados.** Los 462 del torneo salen de
  `EQ003003.PKF`; ver la sección siguiente. Esta parte de la sección 19 dejó de
  aplicar a propósito, y el cartel de la barra superior cambió para no declarar
  inventado un dato que es real.

Los datos son coherentes entre pantallas y hay tests que lo verifican: las
ofertas apuntan a jugadores que existen en el plantel, las rutas de los
mensajes de la bandeja existen en la navegación, y la tabla cierra como un
torneo de verdad (las victorias igualan a las derrotas, los empates son un
número par y los goles a favor igualan a los goles en contra). Ese último
test también salió de un error real en los datos escritos a mano.

---

## El juego se juega con los planteles reales del Apertura 98

Hasta acá el prototipo tenía **jugadores inventados**: el plantel del manager
estaba escrito a mano y los diecinueve rivales se generaban con niveles
elegidos a dedo. Ya no. Los veinte planteles salen de `EQ003003.PKF`, el
archivo de equipos de PC Apertura 6.0 — **462 jugadores** con sus nombres,
dorsales, fechas de nacimiento y los diez atributos que guarda el juego.

River arranca con Burgos en el arco, Sorín y Berizzo en el fondo, Astrada y
Gallardo en el medio, y Aimar de 18 y Saviola de 16 en el plantel. Boca con
Córdoba, Bermúdez, Samuel, Riquelme de 20 y Palermo.

Cómo se extrajo está en [`docs/pcf_data_format.md`](pcf_data_format.md); acá
va sólo lo que hizo falta para que el motor los pueda jugar.

### Diez atributos, los del archivo y ninguno más

El motor tenía **veintinueve** atributos. Los planteles salen de un archivo que
guarda **diez**, así que diecinueve se derivaban de los que sí estaban:
`vision` de calidad, `centros` de pase, `manos` de portero, el juego aéreo de
la agresividad y la altura.

Esa capa era la parte más débil del proyecto. Diecinueve números por jugador
que parecían datos y eran nuestra estimación, sin ninguna forma de verificarlos
contra nada: no existe fuente que diga cuál era la `concentracion` de Berizzo.

**Se bajó el motor a los diez de PC Fútbol**, con sus nombres y su orden:

| | |
|---|---|
| Físicos | `velocidad` (VE), `resistencia` (RE), `agresividad` (AG) |
| Con la pelota | `calidad` (CA), `remate` (RM), `regate` (RG), `pase` (PA), `tiro` (TI) |
| Defensivos | `entradas` (EN) |
| Arquero | `portero` (PO) |

`attributesFromPcf` quedó siendo una **identidad**: acota a la escala 1..100 y
devuelve. No hay nada derivado, y un test lo fija — si algún día vuelve a
aparecer un atributo derivado, avisa.

#### Qué se perdió, y es un costo real

Los veintinueve distinguían cosas que estos diez no:

- **El juego aéreo ya no es un atributo.** Un central que salta y uno que no
  saltan igual; lo más cercano que guarda el archivo es la agresividad.
- **Los tiros libres y los penales no se separan de la potencia de disparo**:
  los tres son `tiro`.
- **El arquero tiene un solo número.** Antes tenía reflejos, manos, achique y
  saque por separado, así que podía ser seguro abajo y flojo por arriba.
- **La concentración, las decisiones, la visión y el trabajo de equipo**
  desaparecen dentro de `calidad`. Un volante lúcido y uno técnico pero
  desatento ya no se distinguen.

`ATTRIBUTE_ABSORBED`, en `src/domain/attributes.ts`, dice qué absorbió cada
uno. Cada fila de esa tabla es una decisión de modelado, no un hecho, y está
ahí para poder discutirla.

#### Las mecánicas que hubo que repensar, no renombrar

Bajar de veintinueve a diez no es buscar y reemplazar. Dos casos donde el
reemplazo mecánico daba algo sin sentido:

- **La ubicación en el área.** El viejo `posicionamiento` colapsó en
  `entradas`, que para un delantero no significa nada. Donde medía "sabe
  ubicarse en el área" ahora pesan la calidad y la velocidad.
- **Los desvíos por puesto del generador de planteles.** Los cuatro desvíos que
  colapsaban en `agresividad` se **promediaron**, no se sumaron (sumarlos
  convertía un +9 en un +36), y después se escalaron al 60%: con diez
  atributos cada uno pesa el triple en el overall, así que el mismo desvío
  salía disparado y un DC de nivel 76 quedaba con remate 91 y calidad 70.

#### El plan de entrenamiento perdió un foco y ganó otro

Los grupos de atributos eran cinco: físico, técnico, mental, defensivo y
arquero. El **foco mental ya no existe** — no hay atributo mental que entrenar,
así que el plan "Mental" no habría movido nada, y un plan de entrenamiento que
no mueve nada es peor que no tenerlo. En su lugar el foco **ofensivo**, que
antes era un bonus pegado al grupo técnico, pasó a ser un grupo de verdad:
`remate` y `tiro`.

El profesionalismo del jugador —cuánto se cuida, cuánto rinde el
entrenamiento— salía de `concentracion` y `trabajoEquipo`. Ahora sale de
`calidad`, que es el atributo de clase del archivo.

#### Tres tests cambiaron de premisa, no de umbral

Bajar de veintinueve a diez rompió tests, y en tres casos lo que estaba mal era
el test, no el código:

- **El "especialista".** El fixture le ponía dos atributos altos (`remate` 94 y
  otro). Con diez atributos, dos de los tres pesos grandes de un DC ya es un
  delantero completo, no un especialista. Ahora es uno solo.
- **`topFinisher` es un máximo del once**, y le suma a cada jugador su
  corrimiento del día. Un extremo en racha le tapaba el máximo al 9 y el test
  medía la forma en lugar del reparto de atributos. Se fija la condición del
  plantel y queda medido lo que dice medir.
- **"El resultado no depende sólo del overall"** comparaba dos planteles
  distintos con tácticas distintas, así que el número que medía era en buena
  parte la diferencia de plantel. Medido con **un solo plantel clonado** para
  los dos lados, donde la diferencia de plantel es cero por construcción, el
  efecto táctico es de 4 puntos de victorias locales y siempre para el mismo
  lado. El test viejo daba 5 puntos con dos planteles, pero sólo 1,1 con uno:
  pasaba por la razón equivocada.

### Cómo se verifica que el mapeo no deforma a nadie

Con dos fórmulas que no se conocen entre sí. El motor calcula su overall por
puesto con once tablas de pesos; PC Fútbol calcula su media con cuatro de los
diez atributos. Siguen siendo dos cuentas distintas, así que su correlación
sobre los 462 jugadores mide algo: que las tablas de pesos del motor no
deformen el plantel.

En los 409 jugadores de campo: **r = 0,87** y un sesgo global de **+0,5**
puntos. Con veintinueve atributos daba r = 0,85 y −1,6: **el recorte mejoró la
fidelidad**, que era de esperarse — lo que se fue era ruido nuestro.

### Los arqueros divergen, y la culpa es del juego original

Con los arqueros la correlación cae a 0,75 (con veintinueve atributos era
0,66), y no es el mapeo: **la media de PC Fútbol no incluye el atributo
`portero`**. Es `(velocidad + resistencia + agresividad + calidad) / 4`, así
que para un arquero mide todo menos lo único que importa de su puesto. En el
archivo hay arqueros con media 62 y `portero` 19.

Eso se prueba **sin que el motor intervenga**: entre los arqueros del archivo,
la correlación entre la media de PC Fútbol y su propio atributo `portero` es
0,45. El test lo afirma y avisa si algún día sube.

El overall del motor, que sí es por puesto, es el número correcto ahí.
Chilavert queda 91 por su `portero` 90, no a pesar de él.

### Diecinueve roles contra once puestos

El archivo guarda hasta **seis roles** por jugador, de una tabla de diecinueve.
Eso mapea bien a los once puestos del motor, y los roles secundarios se
conservan como posiciones alternativas: un lateral que el PKF marca también
como central no juega fuera de puesto ahí.

Riquelme trae `medio centro organizador, interior derecho, interior izquierdo,
centrocampista izquierda, centrocampista derecha, media punta por el centro` →
**MC con MCO secundaria**.

Con una excepción deliberada: **el arco no se mezcla con la cancha.** Tres de
los 143 arqueros del archivo traen un rol de campo en el segundo slot —Burgos y
Costanzo figuran como laterales izquierdos además de arqueros—. Tomarlo literal
habilita al motor a poner a Burgos de lateral sin penalización, que es un bug
de juego disfrazado de fidelidad al dato. Se filtra en las dos direcciones.

### Las tácticas también son las del archivo

El PKF guarda por club el porcentaje de toque, el de contragolpe, el tipo de
ataque, el tipo de entradas, el marcaje, los despejes y la presión. Los siete
mapean casi uno a uno a la táctica del motor, así que **los rivales juegan como
jugaban**.

La **formación** no: está dentro del bloque de "táctica definida" de 264 bytes,
que no se decodificó. Se elige por la forma **real** del plantel —cuántos
centrales, cuántos volantes, cuántos delanteros tiene cada club—, que sí es
dato. No es la formación histórica, pero tampoco un número elegido a dedo.

La **reputación** sale de los socios y la capacidad del estadio, que están en
el archivo: River con 63.000 socios y 76.687 de aforo pesa distinto que
Platense con 7.500 y 12.657.

### Lo que sigue siendo nuestro, y está declarado

| Dato | De dónde sale |
|---|---|
| Valor de mercado y salario | los calcula `domain/market.ts`: el formato no los guarda |
| Forma, moral y fatiga iniciales | derivadas de una semilla fija por jugador; son estado de partida, no historia |
| Contrato | uno solo para todos, porque PC Fútbol no guarda contratos |
| Cohesión | la misma para los veinte clubes |
| Colores institucionales y siglas | el formato PKF no los guarda |
| Lesiones y sanciones | no existen en el formato: el plantel arranca sano |

### El cartel de la barra superior decía una mentira nueva

Decía **"Datos demo: los clubes son reales, los jugadores y los números son
inventados"**. Era cierto mientras el plantel se generaba; desde que sale del
archivo, dejarlo así sería mentir en la dirección contraria: declarar inventado
un dato que es real.

Ahora dice **"PC Apertura 98"** y al pasar el mouse explica la frontera: qué
sale del archivo y qué calcula este juego.

---

## Los escudos son los de verdad

Los veinte clubes de Primera llevan su escudo oficial, en vectorial. Los
cuatro de la Primera Nacional no, y eso es una línea explícita, no un olvido:
no están en el repo de origen, y un `<img>` roto se ve peor que un escudo
dibujado.

### De dónde salen

De [FCLOGO](https://github.com/FCLOGO/fclogo.top) (MIT), que tiene los
escudos de la AFA en SVG y —lo más interesante— **versionados por año**: hay
un Boca `v1996`, un River `v1993` y un `v1998`, un Independiente `v1987`. Para
el dataset del Clausura 1998 eso permitiría usar el escudo de la época.

Fue la única fuente alcanzable. Wikimedia Commons, que es donde uno iría a
buscar esto, responde 403 como todo el resto; GitHub y los registries de
paquetes son lo único que la política de red permite. Los escudos se
consiguieron por ahí; los planteles de 1998 no, porque no existen en ningún
repo de código (ver `docs/clausura-1998.md`).

### Cómo entran

`node scripts/crests.mjs <clone de fclogo.top>` elige por club la versión en
color más reciente, la optimiza y escribe `public/crests/<id>.svg` más el
manifiesto `src/ui/data/crests.ts`. Se corre a mano: los escudos cambian una
vez por década.

Son **archivos estáticos, no van en el bundle**: 143 kB entre los veinte, que
el navegador cachea por separado del código y pide sólo cuando los ve.

El mapeo club → carpeta es a mano a propósito. Hay homónimos reales: el
`025_San Martín` del repo es el de San Juan y el nuestro es el de Tucumán.
Adivinar por nombre habría puesto el escudo de otro club, que es el error que
nadie nota hasta verlo en pantalla.

### El optimizador me rompió dos escudos

Los SVG son exports de Illustrator con coordenadas de cuatro decimales sobre
un lienzo de 800 unidades. Redondear a entero bajaba el total un 40% más, y el
razonamiento parecía sólido: una unidad de 800 es 0,08 px en el escudo más
grande que dibujamos.

Estaba mal. Los trazos usan comandos **relativos**: cada número es un delta,
no una coordenada, así que el error se acumula a lo largo del trazo y todo
delta menor a 0,5 colapsa a cero. El `d` de Vélez quedó con cosas como
`c00-1-1-1`.

Huracán y Vélez se dibujaban como una mancha. **No dio un solo error**: el SVG
era válido, sólo describía otra figura, y los tests pasaban —verifican que el
archivo exista y que el `<img>` cargue, y las dos cosas eran ciertas—. Lo
encontré mirando la captura de la tabla. Quedó en dos decimales.

### Una nota que corresponde

Los escudos son **marcas registradas de cada club**. Se usan acá para
identificarlo, que es para lo que existen, y el juego no se presenta como
oficial ni afiliado a ninguno. Si en algún momento conviene sacarlos, es un
solo paso: borrar `public/crests/` y correr el script sin fuente, y los
veinticuatro clubes vuelven al badge dibujado sin tocar una línea de la
interfaz.

---

## Verificación

**Tests automatizados** (`npm test`, 311 en total):

- `tests/ui-logic.test.ts` — el puente con el motor, las alertas derivadas,
  el estado de preparación, la autoselección, el cambio de formación sin
  perder la selección, y la coherencia del dataset demo.
- `tests/pitch-layout.test.ts` — la disposición de la cancha.
- `tests/market.test.ts` — la valuación, las dos invariantes del informe, la
  negociación y el cálculo de la lista de transferibles.
- `tests/crests.test.ts` — que el manifiesto de escudos no se desincronice de
  los clubes: ningún id inventado, ningún club en las dos listas ni en
  ninguna, y el archivo de cada escudo declarado existe.
- `tests/pcf-bridge.test.ts` — el puente con los datos del Apertura 98: que el
  mapeo cubra los diez atributos del motor declarando el origen de cada uno y
  que **ninguno se derive**, que los diez lleguen intactos uno por uno, que el
  overall siga a la media original en los jugadores de campo, que ninguno se
  salga de escala, que el arco no se mezcle con la cancha y que el mapeo sea
  determinista.
- `tests/season.test.ts` — el fixture, la tabla y las estadísticas del torneo.
- `tests/staff.test.ts` — entre otras cosas, el test de **honestidad**: un rol
  no puede declararse `implementado` sin un consumidor real que se mueva, y la
  fase que promete un rol pendiente tiene que existir en `plan.ts` y no estar
  entregada.

**Flujos en el navegador** (`scripts/ui-smoke.mjs`, 21 comprobaciones): la
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

Con las fases 4, 5 y 7 el prototipo se juega, se arma y los planteles
evolucionan: se prepara el equipo, se juega la fecha, el torneo avanza, los
jugadores crecen o se caen, y el plantel se puede cambiar comprando y vendiendo.
Lo próximo es la fase 6 (estadio y finanzas) y después la 8 (backend real y el
riesgo de lesión por equipo, que es lo que falta para el último rol del staff).

Deuda anotada, no escondida:

- **La temporada no rota.** Al terminar el torneo se puede empezar uno nuevo,
  pero nadie cumple años y no entra una camada nueva a inferiores. `ageUp` ya
  existe en el motor; engancharlo es parte de la fase 6, con el cierre de
  ejercicio.
- **Los rivales no tienen cuerpo técnico simulado.** Desarrollan a un ritmo base
  equivalente a un entrenador de dos estrellas (`BASELINE_COACHING`): si les
  diera cero, sus juveniles no crecerían nunca y el torneo se desbalancearía
  solo. Tener staff propio sigue siendo una ventaja concreta.

- **La Primera Nacional no se simula.** Sus cuatro clubes existen para el
  mercado y los ascensos, y la pantalla de tabla lo dice en lugar de mostrar
  una tabla inventada.
- **El torneo es de una sola vuelta** (19 fechas). Dos vueltas, copas y
  descensos son parte de la fase 6/7 ampliada.

Vale una nota sobre la fase 7: el resultado de partido ya está resuelto del
lado del motor —`simulateMatch` devuelve marcador, eventos minuto a minuto,
estadísticas completas, notas individuales, mejor jugador y el relato del
partido—, así que esa fase es sobre todo trabajo de interfaz.
