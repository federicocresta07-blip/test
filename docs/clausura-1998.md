# Torneo Clausura 1998 — dataset histórico

Base de datos de los equipos y jugadores reales del **Torneo Clausura 1998**
de la Primera División argentina: segundo torneo de la temporada 1997-98, del
**16 de febrero al 8 de junio de 1998**, 19 fechas a una sola ronda.

Vive en `src/data/clausura-1998/` y se carga al motor con
`buildHistoricalTeam(clubId)`.

---

## Estado de la carga

| | |
|---|---|
| Clubes | **20 de 20** cargados |
| Tabla final | **completa** (puntaje de los 20) |
| Planteles verificados | **2 de 20** (Vélez, Lanús) |
| Jugadores cargados | **22** |
| Planteles pendientes | **18** |

```bash
node -e "const m=await import('./src/data/clausura-1998/index.ts'); \
         console.log(m.squadProgress()); console.log(m.missingSquads())" --input-type=module
```

Los 18 planteles pendientes figuran en los datos con la lista de jugadores
vacía y `confidence: 'pendiente'`. Es deliberado: el hueco tiene que verse en
el dataset, no quedar escondido detrás de datos inventados.

### Por qué faltan 18

La política de egreso de red de esta sesión bloquea las páginas de referencia
—Wikipedia, bdfa.com.ar, footballdatabase.eu, rsssf.org, ceroacero y los
sitios de los clubes—. Solo funciona el buscador, que devuelve resúmenes, no
las tablas de plantel.

Y esos resúmenes **mezclan los dos torneos de 1998**, que es el riesgo real.
Ejemplo concreto: al buscar el plantel de Boca del Clausura 1998, la búsqueda
devolvió el once de Bianchi con Riquelme, Palermo y Barros Schelotto, más los
20 goles de Palermo en 19 partidos. Nada de eso corresponde a este torneo:
Bianchi firmó el **27 de mayo de 1998, después del Clausura**, y ese equipo es
el del **Apertura 1998**. El Clausura lo dirigió Héctor Veira, que se fue
antes del final, y las últimas seis fechas las dirigió Carlos García Cambón.

Con esa materia prima, completar 20 planteles produciría un archivo que parece
investigado y está contaminado. Preferimos 22 jugadores correctos a 440
verosímiles.

---

## Las dos clases de dato

El tipo `HistoricalPlayerEntry` separa a propósito lo que es un hecho de lo
que es criterio nuestro:

| Campo | Qué es |
|---|---|
| `name`, `position`, `number`, `age`, `appearances`, `goals` | **Dato histórico.** Sale de una fuente. Si no se pudo verificar, no está. |
| `estimatedRating`, `estimatedTraits` | **Valoración nuestra.** El overall y los atributos de un futbolista en escala 1-100 no existen como hecho. |

Se llaman `estimated` para que nadie los lea como datos. Cada plantel declara
además su `confidence` y sus `sources`.

Cuando una fuente da el once pero no aclara de qué lado jugaba cada defensor
—pasa con Vélez y con Lanús—, el reparto por banda queda anotado como
inferencia en el campo `note` de cada jugador.

---

## Cómo completar los planteles

Lo que hace falta por club es poco. **El mínimo útil es nombre y puesto:**

```
1  José Luis Chilavert   POR
2  Flavio Zandoná        DFC
...
```

Todo lo demás mejora el resultado pero es opcional: dorsal, edad durante el
torneo, partidos jugados y goles. Si tenés los partidos y los goles, mejor
todavía, porque ahí las valoraciones dejan de depender solo del recuerdo.

### Códigos de puesto

Son los once del motor:

| Código | Puesto | | Código | Puesto |
|---|---|---|---|---|
| `POR` | Arquero | | `MCO` | Mediocampista ofensivo |
| `LD` | Lateral derecho | | `ED` | Extremo derecho |
| `DFC` | Defensor central | | `EI` | Extremo izquierdo |
| `LI` | Lateral izquierdo | | `SD` | Segundo delantero |
| `MCD` | Mediocampista defensivo | | `DC` | Delantero centro |
| `MC` | Mediocampista central | | | |

### En qué formato pasarlo

Cualquiera de estos sirve; no hace falta que sea prolijo:

- **Texto pegado**, un jugador por línea, como el ejemplo de arriba.
- **Planilla o CSV** con las columnas que tengas.
- **Un PDF o una captura** de un anuario o una revista de época.
- **Un volcado en bruto** de cualquier sitio: yo lo normalizo.

Con el nombre del **director técnico** de cada club y la **fuente** de donde
salió, el dataset queda completo y auditable.

Si preferís que lo busque yo, alcanza con que un administrador habilite en la
política de egreso uno de estos dominios para la sesión: `es.wikipedia.org`,
`bdfa.com.ar` o `footballdatabase.eu`.

---

## Lo que ya está verificado

### El torneo

- 20 equipos, 19 fechas, del 16/02/1998 al 08/06/1998.
- Campeón: **Vélez Sarsfield**, su quinta estrella. 46 puntos: 14 ganados,
  4 empatados, 1 perdido, 39 goles a favor y 14 en contra. Se consagró el
  31 de mayo ganándole 1-0 a Huracán en el Amalfitani.
- Goleador del torneo: **Gustavo Bartelt** (Lanús), 13 goles.
- Tabla completa de los 20, de Vélez con 46 puntos a Unión y Deportivo
  Español con 13.

De la tabla solo está verificado el **puntaje** de cada club. Ganados,
empatados, perdidos y goles están únicamente para Vélez; para el resto quedan
en `null`, porque con el puntaje solo no se puede deducir el reparto entre
victorias y empates y no vamos a inventarlo.

### Vélez Sarsfield — campeón

DT **Marcelo Bielsa**. Once titular: Chilavert; Zandoná, Méndez, Pellegrino,
Cardozo; Castromán, Marcelo Gómez, Pandolfi; Posse, Camps, Cordone.
Posse y Camps, máximos goleadores del equipo con 10 cada uno.

### Lanús — subcampeón

DT **Roberto Mario Gómez**. Once titular: Burela; Serrizuela, Alessandria,
Siviero, Gabriel Ramón; Juan Fernández, Cravero, Kmet, Mas; Bartelt, Belloso.
Bartelt goleador del torneo con 13; Burela y Alessandria jugaron los 19
partidos. Después del torneo el plantel se desarmó: Bartelt a la Roma por
6,5 millones de dólares, Kmet al Sporting de Lisboa, Siviero al Mallorca y
el Mallorca compró el 50% de Ibagaza.

### Errores frecuentes que el dataset deja anotados

- **Francescoli no jugó este torneo.** Se había retirado al final de 1997,
  después de ganar los dos torneos de ese año.
- **El Boca de Bianchi es del Apertura 1998, no de este Clausura.**
- **Newell's** no jugaba en el Coloso Marcelo Bielsa: ese nombre es de 2009.
  En 1998 era el Coloso del Parque.
- **Argentinos Juniors** no jugaba en el Diego Armando Maradona: ese nombre
  es de 2003.
- **Independiente** jugaba en La Doble Visera; el estadio actual es posterior
  a 2009.

---

## Cómo usarlo

```ts
import {
  buildHistoricalTeam,
  playableTeams,
  missingSquads,
  velezVsLanus,
} from './src/data/clausura-1998/index.ts';
import { simulateMatch } from './src/index.ts';

// El cruce disponible hoy: campeón contra subcampeón.
const { home, away } = velezVsLanus();
const result = simulateMatch({ home, away, seed: 'fecha-19', importance: 0.9 });
console.log(result.scoreline);

// Un club puntual, con la táctica que quieras.
const velez = buildHistoricalTeam('velez');
console.log(velez.playable, velez.squad.confidence, velez.squad.manager);
```

Las **formaciones son inferencia nuestra**: las fuentes dan el once titular,
no el sistema. Para el cruce de ejemplo se eligieron las que acomodan a esos
once en su puesto natural — 4-3-3 para Vélez, que tenía tres delanteros con
Cordone abierto, y 4-4-2 para Lanús.

Un plantel con menos de once jugadores no se puede poner en cancha:
`playableTeams()` devuelve los que alcanzan y `missingSquads()` dice cuáles
faltan y cuántos jugadores les falta a cada uno.

---

## Fuentes

- [Anexo: Torneo Clausura 1998 (Argentina) — Wikipedia](https://es.wikipedia.org/wiki/Anexo:Torneo_Clausura_1998_(Argentina))
- [Campeonato de Primera División 1997-98 — Wikipedia](https://es.wikipedia.org/wiki/Campeonato_de_Primera_Divisi%C3%B3n_1997-98_(Argentina))
- [Vélez Campeón Clausura 1998 — Junta Histórica de Vélez Sarsfield](https://velez.com.ar/junta-historica/notas/2023/05/31/104603_velez-campeon-clausura-1998)
- [Torneo Clausura 1998 — Pasión Granate (Lanús)](https://pasiongranate.com.ar/torneo-clausura-1998/)
- [Torneo Clausura 1998, campaña completa — Historia de Boca Juniors](https://historiadeboca.com.ar/torneo-clausura-1998/1998/42.html)
- [El día de invierno en que nació el Boca de Bianchi — ESPN](https://www.espn.com.ar/futbol/argentina/nota/_/id/12259909/boca-juniors-efermeride-llegada-carlos-bianchi-virrey)
- [Temporada 1997-98 de River Plate — Wikipedia](https://es.wikipedia.org/wiki/Anexo:Temporada_1997-98_del_Club_Atl%C3%A9tico_River_Plate)
- [Historia del Club de Gimnasia y Esgrima La Plata — Wikipedia](https://es.wikipedia.org/wiki/Historia_del_Club_de_Gimnasia_y_Esgrima_La_Plata)

Las consultas se hicieron a través del buscador; las páginas no se pudieron
abrir directamente por la política de egreso de la sesión.
