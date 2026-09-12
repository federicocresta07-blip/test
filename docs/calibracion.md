# Calibración del motor

Estado actual del equilibrio y cómo volver a ajustarlo.

Todos los parámetros que afectan el equilibrio están en
[`src/config/engine-config.ts`](../src/config/engine-config.ts). No hay
números críticos dispersos por el código; hay un test que lo verifica.

```bash
npm run calibrate                  # batería de escenarios de referencia
npm run calibrate -- muestra       # River Plate vs Racing Club
npm run calibrate -- 82 78 20000   # un cruce puntual
```

---

## Escenarios de referencia

8.000 simulaciones por escenario. Entre paréntesis, lo que predice el modelo
probabilístico previo (sección 44) antes de simular: que las dos mitades del
motor coincidan es el principal control de calidad.

| Cruce | Local | Empate | Visitante | Goles | Lectura esperada |
|---|---|---|---|---|---|
| 82 vs 82 | 42.8% (43.0) | 26.9% (27.2) | 30.4% (29.8) | 1.39 - 1.12 | muy abierto |
| 82 vs 78 | 51.7% (51.3) | 25.7% (25.6) | 22.6% (23.2) | 1.61 - 0.98 | favorito moderado |
| 82 vs 70 | 70.2% (69.8) | 19.6% (19.4) | 10.2% (10.8) | 2.11 - 0.68 | favorito fuerte |
| 82 vs 60 | 85.3% (85.0) | 11.0% (11.2) | 3.7% (3.8) | 2.83 - 0.47 | sorpresa posible, muy rara |
| 70 vs 70 | 40.8% (41.3) | 29.2% (28.9) | 30.0% (29.9) | 1.25 - 1.03 | muy abierto, menos goles |

El modelo previo y la simulación no se separan más de 0.6 puntos en ningún
escenario.

## Distribución de marcadores

82 vs 82, los diez marcadores más frecuentes:

```
1-1     12.3%        2-0      7.6%
1-0     10.1%        1-2      7.0%
2-1      9.7%        0-2      5.3%
0-1      8.5%        2-2      5.1%
0-0      7.8%        3-1      4.5%
```

Goles totales por partido:

```
 0   7.8%  ####
 1  18.6%  #########
 2  25.2%  #############
 3  22.6%  ###########
 4  14.5%  #######
 5   6.4%  ###
 6   3.0%  #
 7   1.3%  #
 8   0.4%
 9   0.1%
```

Los resultados altos existen pero son raros: 11% de los partidos llegan a 5
goles y menos del 0.5% a 8. Un `River 9 - 7 Boca` es posible y prácticamente
no pasa nunca, que es lo que pide la sección 42.

## Estadísticas medias

Por equipo y por partido, en un cruce parejo, contra los valores de referencia
del fútbol real:

| Métrica | Motor | Referencia |
|---|---|---|
| Goles | 1.39 - 1.12 | 1.3 - 1.2 |
| Remates | 12.6 - 11.4 | 12 - 11 |
| Remates al arco | 4.2 - 3.6 (33%) | ~34% de los remates |
| Corners | 4.2 - 3.9 | 4 - 5 |
| Faltas | 12.6 - 13.5 | 12 - 14 |
| Amarillas | 1.66 - 1.81 | 1.7 - 2.2 |
| Rojas | 0.16 - 0.18 | 0.15 - 0.3 |
| Penales | 0.103 - 0.101 | ~0.1 |
| Partidos 0-0 | 8.7% | 7 - 9% |
| Posesión | 53.2% - 46.8% | 52 - 48 |

Los goles nunca se apartan del xG más de 0.35 a lo largo de miles de partidos,
lo que confirma que la etapa de conversión no está sesgada.

## Equilibrio entre formaciones

Torneo de todas contra todas con el mismo plantel, cancha neutral, 700
partidos por cruce:

| Formación | Puntos/partido | GF | GC |
|---|---|---|---|
| 4-3-3 | 1.399 | 1.21 | 1.16 |
| 4-1-4-1 | 1.396 | 1.19 | 1.13 |
| 3-4-3 | 1.369 | 1.17 | 1.18 |
| 4-2-3-1 | 1.361 | 1.16 | 1.14 |
| 4-5-1 | 1.360 | 1.16 | 1.15 |
| 3-5-2 | 1.333 | 1.12 | 1.15 |
| 4-4-2 | 1.324 | 1.14 | 1.20 |
| 5-3-2 | 1.323 | 1.10 | 1.15 |

Un 6% entre la mejor y la peor, y cada una llega ahí por otro camino: el 4-3-3
hace y recibe más goles, el 5-3-2 hace y recibe menos. Ninguna es
universalmente superior (sección 31).

Nota: el torneo usa un mismo plantel genérico para las ocho formaciones, así
que en varias hay jugadores fuera de puesto. El equilibrio se mantiene igual.

## Profundidad del plantel

Mismo once titular, distinto banco, contra el mismo rival:

| Calendario | Banco útil (78) | Banco flojo (56) |
|---|---|---|
| 12 fechas, 2 días de descanso | 17.2 pts | 14.8 pts |
| 12 fechas, 3 días de descanso | 19.9 pts | 19.4 pts |
| 20 fechas, 2 días de descanso | 27.7 pts | 22.2 pts |

La rotación pesa cuando el calendario aprieta y casi no pesa cuando hay
descanso, que es el comportamiento correcto (secciones 47 y 48).

---

## Cómo recalibrar

El orden importa: cada paso da por buenos los anteriores.

1. **Nivel de goles** — `chanceQuality.baseXg` y `chances.baseShots`.
   Objetivo: 2.5 a 2.7 goles por partido en un cruce parejo. Subir o bajar
   todos los `baseXg` proporcionalmente mueve el nivel sin tocar el orden
   entre tipos de ocasión.

2. **Remates y precisión** — `chances.baseShots`,
   `conversion.onTargetBase` y `onTargetXgEffect`. Objetivo: 11 a 13 remates
   por equipo y un 33% al arco.

3. **Cuánto pesa ser mejor** — `chances.qualitySensitivity` (volumen) y
   `chanceQuality.edgeToClearChances` (calidad). Son los dos que definen si un
   82 aplasta o no a un 70. Subirlos agranda la brecha entre equipos.

4. **Localía** — `homeAdvantage`. Objetivo: 43 a 46% de victorias del local en
   un cruce parejo. `performanceBonus` mueve el rendimiento, `xgMultiplier` el
   xG, `homePossessionBonus` la posesión y `refereeBias` las faltas.

5. **Empates** — salen solos del nivel de goles: menos goles, más empates. Si
   hacen falta más empates sin bajar los goles, se puede subir
   `scoreState.leadingCounterQuality` (el que gana define el partido) o bajar
   `scoreState.trailingExtraChances`.

6. **Disciplina y lesiones** — `discipline`. Son independientes del resto, se
   pueden ajustar al final.

7. **Cruces tácticos** — `matchups`. Con `globalScale` se escalan todos a la
   vez; con `globalScale: 0` se apagan para aislar el efecto de la calidad.

Después de cada cambio:

```bash
npm run calibrate && npm test
```

Los tests de `tests/calibration.test.ts` son los guardianes del equilibrio:
verifican los cuatro escenarios de la sección 41, la distribución de
marcadores de la sección 42 y que el modelo previo siga coincidiendo con la
simulación.
