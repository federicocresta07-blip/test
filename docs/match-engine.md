# Diseño del Match Engine

Este documento explica cómo funciona el motor y dónde está implementada cada
cosa. La última sección es el mapa completo de la especificación (secciones 25
a 53) contra el código y los tests.

---

## 1. Ideas de diseño

Cuatro decisiones ordenan todo el resto.

### El motor construye probabilidades, no resultados

El motor no decide quién merece ganar. Arma, con toda la información
disponible, las probabilidades de que cada equipo produzca cada resultado, y
después juega el partido con esas probabilidades.

```
calidad + táctica + jugadores + estado + contexto  ->  probabilidades
probabilidades + azar controlado                   ->  resultado
```

En ningún lugar del código hay algo parecido a `random(ganador)`. El azar
entra siempre al final, sobre una probabilidad ya construida: en la variación
de rendimiento de cada jugador, en el ruido de volumen de remates, en el día
del arquero y en la resolución de cada ocasión.

### Nada se cobra dos veces

Cuando un mismo atributo influye en dos etapas, se parte en dos conceptos
distintos. El caso más claro es el delantero:

| Etapa | Qué mide | Atributos |
|---|---|---|
| 3 — calidad de la ocasión | qué tan **buena** es la posición que se genera | `posicionamiento`, `control`, `tecnica`, `juegoAereo`, `salto`, `velocidad` |
| 4 — conversión | si **acierta** el remate | `definicion`, `remate`, `tirosLibres`, `penales`, `concentracion` |

Por eso el ejemplo de la especificación (overall 90, definición 94,
posicionamiento 92) mejora las dos cosas, pero por caminos separados y
medibles: `posicionamiento` sube el xG de sus ocasiones y `definicion` sube la
probabilidad de convertirlas.

Lo mismo con la defensa rival, que aparece en tres lugares distintos con
efectos distintos: en el volumen de ocasiones (organización defensiva), en el
reparto de tipos de ocasión (defensa del área) y en la conversión (presión
sobre el remate, un efecto chico).

### Generar mucho y generar bien son virtudes distintas

Las etapas 2 y 3 usan combinaciones diferentes de dimensiones **a propósito**:

```
volumen   =  creación·0.45 + mediocampo·0.30 + ataque·0.25
             contra  defensa·0.50 + mediocampo·0.30 + presión·0.20  del rival

calidad   =  ataque·0.55 + mejor definidor·0.25 + juego por banda·0.20
             contra  defensa·0.60 + mejor defensor·0.25 + juego aéreo·0.15  del rival
```

Un equipo puede tener la pelota y remar todo el partido sin llegar nunca al
área; otro puede remar poco y lastimar cada vez. Con una única fórmula esas dos
cosas serían lo mismo.

### El motor es puro y determinista

`simulateMatch` no muta los equipos que recibe y con la misma entrada y la
misma semilla devuelve exactamente el mismo partido. Todo el azar pasa por
`Rng`, un generador con semilla (xoshiro128\*\*). Eso permite reproducir
partidos, depurar y comparar calibraciones.

La evolución del plantel (forma, moral, fatiga, cohesión, lesiones) vive
aparte, en `progression/after-match.ts`, y devuelve equipos nuevos.

---

## 2. El rendimiento de un jugador

Ningún jugador rinde su overall. El rendimiento efectivo se compone así
(`ratings/effective-rating.ts`):

```
overall en su posición natural
  + aptitud por atributos del puesto asignado   (matiza, no reemplaza)
  × (1 − penalización por posición)
  + forma           (±4.5)
  + moral           (±3.0)
  + fatiga          (hasta −12)
  + puesta a punto  (±5)
  + adecuación táctica (±4.0)
  + experiencia     (±3.0, solo pesa en partidos importantes)
  + cohesión        (±2.5)
  + localía         (+0.9)
  + variación del partido  (normal truncada, sd 3.6, corte a 2.4 sd)
  = rendimiento efectivo (1..100)
```

La variación es **acotada**: un 82 rinde entre ~74 y ~90 según el día, nunca
95 ni 60. Y los jugadores consistentes y experimentados varían menos que los
irregulares y los jóvenes.

El desglose completo queda en `PerformanceBreakdown`, así que la interfaz puede
mostrar exactamente de dónde salió cada punto.

### Adecuación a la posición

La penalización por jugar fuera de puesto usa **niveles de familiaridad**
(`domain/positions.ts`), no una fórmula geométrica: es más legible y más fácil
de ajustar.

| Nivel | Penalización | Ejemplo |
|---|---|---|
| 0 natural | 0% | MC jugando MC |
| 1 muy similar | 3% | MC jugando MCD, DC jugando SD |
| 2 similar | 8% | LD jugando LI, DFC jugando MCD |
| 3 distinta | 16% | MC jugando DFC |
| 4 ajena | 30% | DC jugando DFC |
| 5 arquero / campo | 60% | cualquiera al arco |

Una posición secundaria del jugador nunca penaliza más del 2.5%.

Además de la familiaridad, el motor mira si los atributos le sirven para ese
puesto: un MC con buen marcaje sufre algo menos como DFC que un MC puramente
creativo. Es un ajuste al 35%, con tope de 12 puntos: matiza, no decide.

### Adecuación táctica

`ratings/tactical-fit.ts` compara lo que pide el entrenador con lo que el
jugador tiene: la presión alta exige resistencia y trabajo de equipo, la
posesión exige pase corto y técnica, el juego directo exige juego aéreo y
fuerza, la línea alta exige velocidad y concentración a los defensores, el
juego por bandas exige centros y regate a los puestos anchos. Si la táctica no
pide nada de eso, el efecto es neutro.

---

## 3. Fuerza del equipo

`ratings/team-strength.ts` calcula nueve dimensiones —ataque, mediocampo,
defensa, arquero, físico, creación, presión, contraataque, balón parado— y
cada una sale de:

1. los atributos que importan en esa capacidad,
2. el rendimiento efectivo de cada titular (que ya trae forma, moral, fatiga…),
3. el peso del puesto en esa dimensión, según la línea y las tareas
   (`attackDuty` / `defenseDuty`) que le da la formación,
4. los modificadores de la formación y de la táctica.

El promedio es una **media de potencia con exponente 1.6**: un 92 levanta la
dimensión más de lo que la hunde un 60. Así la calidad individual se nota sin
que un crack tape a diez jugadores flojos.

Además de las nueve dimensiones, el motor expone indicadores individuales que
usan las etapas siguientes: nivel del arquero (sin mezclar con la defensa),
mejor definidor, mejor generador, mejor defensor, calidad por las bandas, juego
aéreo, aguante, experiencia y los tres jugadores más decisivos con su rol.

### Formaciones

Una formación hace dos cosas: define los once puestos con el reparto de tareas
de cada uno —que es lo que redistribuye la fuerza— y aplica modificadores
chicos a las dimensiones. **La suma de los modificadores de cada formación es
cero**, así que ninguna es mejor que otra en absoluto; cambia el reparto.
Un test lo verifica.

Medido en un torneo de todas contra todas a igual calidad (8 formaciones, 700
partidos por cruce, cancha neutral), la mejor saca 1.40 puntos por partido y la
peor 1.32: un 6% de diferencia, y cada una lo consigue de otra manera (el 4-3-3
hace y recibe más goles, el 5-3-2 hace y recibe menos).

### Jugar con uno menos

Una expulsión no se resuelve sacando un jugador del promedio, porque un
promedio de diez cambia poco. Se aplica un castigo explícito por jugador de
menos, más fuerte en ataque (−7) y mediocampo (−6) que en defensa (−3).

---

## 4. Las cinco etapas

### Etapa 1 — Control del partido

`engine/control.ts`. Combina mediocampo (0.44), creación (0.20), presión
(0.14), físico (0.10) y defensa (0.12), suma los cruces tácticos y la localía,
y reparte la posesión.

Importante: **tener la pelota no es lo mismo que ser mejor**. El estilo mueve
la posesión por su cuenta —un equipo que juega directo cede la pelota a
propósito— y eso no reduce lo que genera. La posesión tiene piso y techo (27% /
73%), porque un partido de fútbol no llega a 90-10.

### Etapa 2 — Creación de ocasiones

`engine/chance-volume.ts`. Los remates de juego salen de la ventaja de
generación sobre la capacidad de impedir del rival, corregida por posesión
(con elasticidad 0.55: la pelota ayuda pero no manda), localía, cruces
tácticos, y por lo abierto que esté el partido (si los dos suben la línea,
aprietan y juegan rápido, hay más ocasiones para los dos).

Encima va un ruido acotado, porque hay partidos en los que no se genera nada y
otros que se vuelven locos.

### Etapa 3 — Calidad de las ocasiones

`engine/chances.ts`. Cada remate se convierte en una ocasión con su tipo y su
xG:

| Tipo | xG base |
|---|---|
| penal | 0.78 |
| ocasión clara | 0.30 |
| contraataque | 0.17 |
| ocasión buena | 0.085 |
| cabezazo | 0.07 |
| balón parado | 0.058 |
| tiro libre directo | 0.07 |
| remate lejano | 0.028 |

El reparto entre tipos depende de la ventaja ofensiva (más ventaja, más
ocasiones claras y menos remates de afuera) y de la táctica: atacar por las
bandas produce cabezazos, buscar la contra produce ocasiones de campo abierto,
jugar directo produce remates lejanos.

El xG de cada ocasión concreta se modula por la calidad del ejecutor para
**generarse** esa posición, por los cruces tácticos y por la localía.

### Etapa 4 — Conversión

`engine/conversion.ts`. La probabilidad de gol de una ocasión depende de los
cinco factores que pide la especificación:

```
p(gol) = xG
       × definición del atacante        (±0.85 por cada 100 puntos de diferencia)
       × arquero rival                  (∓0.50)
       × presión defensiva              (∓0.12, efecto chico)
       × día del arquero                (sd 11%, por partido)
       × contexto (marcador, piernas frescas)
```

El penal es un caso aparte: casi no depende del contexto, se resuelve entre el
ejecutor y el arquero.

El **día del arquero** se sortea una vez por partido y es lo que le permite
tener una tarde extraordinaria o una para el olvido.

### Etapa 5 — Resultado

`engine/match-engine.ts`. Se reparten las ocasiones por minuto (con más peso
en el tramo final), y el partido se juega minuto a minuto:

- se acumula fatiga en los once que están en cancha;
- se aplican las instrucciones condicionales del usuario;
- la IA evalúa cambios en cuatro ventanas (58, 66, 74, 82);
- el marcador cambia el partido: desde el minuto 65, el que pierde genera
  ocasiones extra y el que gana sale más de contra;
- se resuelven faltas, tarjetas, expulsiones y lesiones;
- se resuelve cada ocasión.

El ejecutor de cada ocasión **se decide en el momento del remate**, no antes.
Por eso los cambios y las expulsiones cambian de verdad lo que pasa después: si
el 9 salió al minuto 70, las ocasiones del 80 las remata otro.

Las piernas frescas también pesan: la diferencia de fatiga colectiva entre los
dos equipos mueve la calidad de las ocasiones del tramo final. Es el mecanismo
que hace que rotar sirva.

---

## 5. Cruces tácticos

`engine/tactical-matchups.ts` es una lista de reglas declarativas. Cada una
mira las dos tácticas y las dos fuerzas, y devuelve un efecto chico más una
explicación en castellano que después usa el relato del partido.

| Regla | Efecto |
|---|---|
| presión alta vs salida en posesión lenta | control para el que presiona |
| juego directo / contra vs presión alta | calidad de ocasión para el directo |
| bloque bajo vs ataque central | baja la calidad de las ocasiones rivales |
| bloque bajo vs buenos extremos y centros | la sube |
| línea alta vs ataque veloz | regala contras |
| posesión vs presión baja | control gratis |
| equipo ancho vs equipo estrecho | más ocasiones por afuera |
| superioridad física vs juego lento | control |
| especialista en balón parado vs aéreo débil | peligro con la pelota quieta |

Cada regla tiene dos condiciones: que la situación táctica se dé **y** que el
equipo tenga con qué. Presionar alto no sirve si tu presión es peor que el
mediocampo rival; atacar por las bandas contra un bloque bajo no sirve si tus
extremos no dan.

Los efectos son deliberadamente chicos —como máximo unos 4 puntos de control o
un 25% de calidad de ocasión— y se pueden apagar por completo con
`matchups.globalScale: 0`.

---

## 6. Después del partido

`progression/after-match.ts` cierra el ciclo:

- **Fatiga**: sube con los minutos (menos si tiene resistencia) y baja con los
  días de descanso. El que no jugó recupera más rápido.
- **Forma**: se mueve hacia la nota del partido, con inercia proporcional a los
  minutos. El que no juega pierde ritmo de a poco.
- **Moral**: resultado, minutos, nota propia, goles, expulsión, situación
  contractual y posición en la tabla.
- **Cohesión**: sube ganando y manteniendo el mismo once, baja con derrotas,
  con muchas incorporaciones y con jugadores desmoralizados.
- **Lesiones**: con gravedad sorteada (leve 3-11 días, moderada 14-38, grave
  50-170) y sesgada por la fragilidad del jugador.
- **Suspensiones**: roja directa dos fechas, doble amarilla una; se cumplen
  fecha a fecha.

`advanceDays` hace pasar el tiempo sin jugar, para parones y pretemporada.

Con esto, la profundidad del plantel importa de verdad. Medido sobre 20
partidos con 2 días de descanso entre fechas, el mismo once con un banco útil
saca 27.7 puntos y con un banco flojo 22.2. Con 3 días de descanso la
diferencia casi desaparece: la rotación pesa cuando el calendario aprieta,
que es exactamente como debe ser.

---

## 7. Mapa de la especificación

Cada sección del pedido, dónde está implementada y qué test la verifica.

| § | Tema | Implementación | Test |
|---|---|---|---|
| 25 | Atributos 1-100 y overall por posición | `domain/attributes.ts`, `ratings/overall.ts` | `overall.test.ts` |
| 26 | Once posiciones y penalización fuera de puesto | `domain/positions.ts`, `ratings/position-fit.ts` | `positions.test.ts` |
| 27 | Overall dinámico → rendimiento efectivo | `ratings/effective-rating.ts` | `effective-rating.test.ts` |
| 28 | Sin simulación visual: marcador y estadísticas | `presentation/format-match.ts` | `match-engine.test.ts` |
| 29 | El resultado no depende solo del overall | todo el motor | `calibration.test.ts` |
| 30 | Fuerza del equipo por dimensiones | `ratings/team-strength.ts`, `domain/dimensions.ts` | `team-strength.test.ts` |
| 31 | Importancia de la formación | `domain/formations.ts` | `formations.test.ts`, `team-strength.test.ts` |
| 32 | Matchups tácticos | `engine/tactical-matchups.ts` | `matchups.test.ts` |
| 33 | Calidad individual decisiva | media de potencia + `topFinisher`/`topCreator`, etapa 4 | `team-strength.test.ts`, `stages.test.ts` |
| 34 | Localía moderada | `homeAdvantage` en la configuración | `match-engine.test.ts`, `effective-rating.test.ts` |
| 35 | Moral 1-100 | `domain/player.ts`, `progression/after-match.ts` | `effective-rating.test.ts`, `season.test.ts` |
| 36 | Forma con etiquetas | `formLabel`/`formValue`, progresión | `effective-rating.test.ts`, `season.test.ts` |
| 37 | Fatiga | acumulación en partido + recuperación | `effective-rating.test.ts`, `season.test.ts` |
| 38 | Lesiones y sanciones | `engine/discipline.ts`, `progression/after-match.ts` | `season.test.ts` |
| 39 | Química / cohesión | `Team.chemistry`, progresión | `effective-rating.test.ts`, `season.test.ts` |
| 40 | Experiencia | `experience` + partidos importantes | `effective-rating.test.ts` |
| 41 | Factor aleatorio controlado | `core/rng.ts` y normales truncadas | `calibration.test.ts` |
| 42 | Consistencia de los resultados | calibración de xG y conversión | `calibration.test.ts` |
| 43 | Generación de ocasiones en etapas | `engine/control.ts`, `chance-volume.ts`, `chances.ts`, `conversion.ts`, `match-engine.ts` | `stages.test.ts` |
| 44 | Modelo probabilístico | `engine/projection.ts` | `stages.test.ts`, `calibration.test.ts` |
| 45 | Importancia del arquero | dimensión propia, efecto en conversión, día del arquero | `stages.test.ts`, `team-strength.test.ts` |
| 46 | Balón parado | `engine/set-pieces.ts`, `resolveSetPieceTakers` | `stages.test.ts`, `lineup.test.ts` |
| 47 | Suplentes y cambios automáticos | `engine/substitutions.ts` | `season.test.ts`, `lineup.test.ts` |
| 48 | Profundidad del plantel | fatiga + lesiones + sanciones + rotación | `season.test.ts` |
| 49 | IA vs IA con el mismo motor | `simulateMatch` no conoce controladores | `match-engine.test.ts` |
| 50 | Estadísticas del partido | `engine/match-types.ts`, `player-ratings.ts` | `match-engine.test.ts`, `calibration.test.ts` |
| 51 | Explicación del resultado | `engine/narrative.ts` | `narrative.test.ts` |
| 52 | Calibración y parámetros centralizados | `config/engine-config.ts`, `calibration/simulate-many.ts` | `config.test.ts` |
| 53 | Probabilidades primero, azar después | arquitectura de las cinco etapas | `calibration.test.ts` |

### Lo que quedó fuera a propósito

- **Partido 2D/3D, movimiento y animaciones**: la sección 28 los excluye de
  esta versión.
- **Mercado de pases, finanzas, tabla de posiciones, entrenamiento**: no están
  en el pedido. El motor expone los enganches que necesitarían
  (`updateAfterMatch` acepta `contractMood`, `tableMood` y `newSignings`).
- **Instrucciones condicionales avanzadas**: la sección 47 las plantea como
  funcionalidad futura. Está implementada la versión simple (minuto +
  condición de marcador + cambios de táctica), que cubre los ejemplos del
  pedido; falta la interfaz para editarlas.
