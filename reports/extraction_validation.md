# Validación de la extracción — PC Apertura 98

Generado por `tools/pcf_extract/validate.py` el 2026-09-12 22:38 UTC. Todos los números de este informe salen del script; ninguno está escrito a mano.

## Las diez comprobaciones de la fase 10

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Equipos extraídos | **55** (55 con plantel) |
| 2 | Jugadores extraídos | **1318** |
| 3 | Jugadores duplicados dentro de un equipo | OK |
| 4 | Punteros duplicados dentro de un equipo | **1** |
| 5 | Jugadores sin equipo | OK |
| 6 | Medias fuera de rango | OK |
| 6b | Atributos fuera de rango (0-100) | OK |
| 6c | Medias que no cierran con la fórmula del juego | OK |
| 7 | Posiciones desconocidas | OK |
| 8 | Nombres de jugador corruptos | **1** |
| 9 | Nombres de equipo corruptos / encoding | OK |
| 10 | Equipos argentinos revisados a mano | **5** (ver más abajo) |

### Comprobaciones adicionales

| Comprobación | Resultado |
|---|---|
| Nombres con acentos o eñes decodificados | 649 jugadores |
| Fechas de nacimiento imposibles en el archivo | 7 |
| Jugadores sin altura en el archivo (valor centinela) | 635 de 1318 |
| Jugadores sin peso en el archivo (valor centinela) | 636 de 1318 |
| Alturas presentes fuera de 150-215 cm | 0 |
| Pesos presentes fuera de 50-120 kg | 0 |
| Equipos con dorsales utilizables | 21 de 55 |
| Equipos con cadena de jugadores cerrada exactamente | 54 de 55 |
| Equipos con cabecera parseada | 55 de 55 |

## La comprobación que más vale

**Las medias cierran con la fórmula del juego en los 1318 jugadores.** No es una comprobación de estilo: la media es

```
media = (velocidad + resistencia + agresividad + calidad) \ 4
```

y la fórmula sale del método `calcularMedia` del editor, no de los datos. Si el
parseo de los diez atributos estuviera corrido un solo byte, la igualdad se rompería
en casi todos los registros. Que cierre en todos es evidencia de que los atributos
se están leyendo del lugar correcto.

La segunda comprobación estructural fuerte es el **encadenamiento**: los registros de
jugador van uno detrás de otro sin contador, así que la suma de sus longitudes tiene
que caer exactamente en el separador del equipo siguiente. Cierra en 54 de 55 equipos.

### El equipo que no cierra

- **Godoy Cruz**: quedan 1222 bytes sin parsear detrás del último
  jugador. Inspeccionados a mano: son metadata del contenedor (el mismo patrón
  de 38 bytes que la cabecera del archivo), no datos de jugador. Sus jugadores
  sí parsearon uno por uno con todas las validaciones internas, así que se
  conservan y el equipo queda marcado con `chain_validated: false`.

### Punteros duplicados

El README del editor dice que el puntero de jugador no se puede repetir dentro de
un mismo equipo. Se cumple salvo en:

- `juveniles-argentina-2064`: puntero 0 usado 2 veces.

Es un combinado del juego, no un club. Los ids de salida se desambiguan con el
offset de origen y los registros quedan marcados con `duplicate_pointer_in_team`.

### Fechas de nacimiento imposibles

7 registros tienen una fecha que no existe en el
calendario (un 31 en un mes de 30, por ejemplo). El campo está en el archivo pero el
juego lo dejó mal poblado. Se publican como `birth_date: null` conservando los tres
bytes en `birth_date_raw`, para que el hueco se vea. Primeros casos:

- Ariel Alfredo MONTENEGRO: día=31 mes=11 año=1975
- Gerardo SOLANA: día=0 mes=0 año=1900
- Matías Nicolás GIGLI: día=7 mes=67 año=1976
- Alejandro Esteban MIGLIARDI: día=6 mes=3 año=664
- Osvaldo CANOBBIO: día=0 mes=0 año=1900
- BIAGGIONI: día=0 mes=0 año=1900
- Matías DONNET: día=0 mes=0 año=1900

## Dorsales: dónde sirven y dónde no

El dorsal **está** en el archivo, un byte justo después del puntero del jugador. Pero
el juego solo lo pobló de verdad en los equipos de Primera: en muchos clubes de
divisiones menores quedaron todos en 0 o en 1. Presentarlos como dorsales sería
inventar, así que cada jugador lleva `shirt_number_reliable` y cada equipo también.

Equipos con dorsales utilizables: **21 de 55**.

Equipos donde el dorsal no es utilizable: Banfield, Dep. Español, Dep. Morón, Arsenal, Tigre, San Martín (Tuc), Ctral. Córdoba, Los Andes, All Boys, Gimnasia y Tiro, Godoy Cruz, San Martín (SJ), Atl. Rafaela, Huracán (Ctes), Nueva Chicago, Instituto (Cba), Quilmes, Douglas Haig, Atl. Tucumán, Chacarita Jrs., Atlanta, San Miguel, Defensa y Just., Aldosivi (M.P), Almagro, Alte. Brown (Ar.), Cipoletti (RN), Estudiantes (B.A.), Olimpo, San Martín (Mza), Juv. Antoniana, Gim. Entre Ríos, El Porvenir, Estrellas ARGENTINA.

## Plantel por equipo

| Equipo | Jugadores | GK | DF | MF | FW | Media | Mín | Máx |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Aldosivi (M.P) | 25 | 3 | 6 | 11 | 5 | 60.0 | 54 | 73 |
| All Boys | 26 | 2 | 9 | 7 | 8 | 63.5 | 58 | 72 |
| Almagro | 25 | 2 | 8 | 11 | 4 | 59.3 | 49 | 70 |
| Alte. Brown (Ar.) | 24 | 3 | 8 | 8 | 5 | 59.6 | 51 | 77 |
| Argentinos Jrs. | 21 | 3 | 8 | 5 | 5 | 75.6 | 69 | 80 |
| Arsenal | 30 | 3 | 8 | 10 | 9 | 55.3 | 52 | 74 |
| Atl. Rafaela | 21 | 2 | 4 | 10 | 5 | 60.0 | 50 | 91 |
| Atl. Tucumán | 22 | 2 | 7 | 9 | 4 | 59.5 | 52 | 68 |
| Atlanta | 25 | 3 | 6 | 10 | 6 | 59.1 | 51 | 68 |
| Banfield | 25 | 2 | 6 | 13 | 4 | 67.5 | 63 | 78 |
| Belgrano | 22 | 2 | 4 | 9 | 7 | 73.1 | 66 | 82 |
| Boca | 23 | 3 | 7 | 9 | 4 | 79.7 | 68 | 88 |
| Chacarita Jrs. | 25 | 2 | 5 | 11 | 7 | 66.8 | 63 | 72 |
| Cipoletti (RN) | 20 | 2 | 7 | 7 | 4 | 59.9 | 53 | 68 |
| Colón | 21 | 2 | 6 | 7 | 6 | 75.7 | 62 | 82 |
| Ctral. Córdoba | 23 | 3 | 8 | 9 | 3 | 63.3 | 59 | 66 |
| Defensa y Just. | 23 | 3 | 8 | 7 | 5 | 63.2 | 57 | 68 |
| Dep. Español | 23 | 3 | 7 | 9 | 4 | 68.0 | 64 | 79 |
| Dep. Morón | 25 | 2 | 6 | 12 | 5 | 59.4 | 54 | 68 |
| Douglas Haig | 21 | 4 | 5 | 7 | 5 | 53.5 | 49 | 58 |
| El Porvenir | 25 | 3 | 10 | 8 | 4 | 59.5 | 47 | 68 |
| Estrellas ARGENTINA | 11 | 0 | 0 | 6 | 5 | 82.8 | 78 | 88 |
| Estudiantes (B.A.) | 25 | 3 | 8 | 9 | 5 | 59.7 | 51 | 68 |
| Estudiantes (LP) | 23 | 2 | 8 | 8 | 5 | 70.9 | 52 | 80 |
| Ferro | 22 | 3 | 7 | 8 | 4 | 75.6 | 66 | 80 |
| Gim. Entre Ríos | 24 | 2 | 6 | 13 | 3 | 59.2 | 52 | 65 |
| Gim. Esgrima (LP) | 24 | 3 | 6 | 12 | 3 | 78.2 | 75 | 81 |
| Gimnasia (J) | 24 | 3 | 6 | 8 | 7 | 75.5 | 66 | 80 |
| Gimnasia y Tiro | 25 | 2 | 6 | 12 | 5 | 56.5 | 52 | 79 |
| Godoy Cruz | 22 | 2 | 8 | 9 | 3 | 62.7 | 52 | 73 |
| Huracán | 22 | 3 | 7 | 7 | 5 | 62.6 | 41 | 81 |
| Huracán (Ctes) | 25 | 3 | 9 | 10 | 3 | 52.4 | 49 | 66 |
| Independiente | 23 | 3 | 7 | 9 | 4 | 79.7 | 71 | 88 |
| Instituto (Cba) | 25 | 3 | 7 | 9 | 6 | 54.3 | 51 | 77 |
| Juv. Antoniana | 25 | 3 | 9 | 7 | 6 | 59.6 | 49 | 70 |
| Juveniles ARGENTINA | 52 | 5 | 15 | 15 | 17 | 80.5 | 64 | 86 |
| Lanús | 20 | 2 | 8 | 6 | 4 | 79.7 | 76 | 85 |
| Los Andes | 25 | 2 | 7 | 10 | 6 | 63.6 | 50 | 67 |
| Newell's | 26 | 3 | 6 | 9 | 8 | 75.8 | 60 | 82 |
| Nueva Chicago | 25 | 4 | 10 | 7 | 4 | 63.4 | 60 | 66 |
| Olimpo | 25 | 2 | 7 | 10 | 6 | 58.7 | 54 | 79 |
| Platense | 21 | 2 | 7 | 6 | 6 | 77.0 | 69 | 81 |
| Quilmes | 25 | 3 | 8 | 8 | 6 | 66.2 | 62 | 72 |
| Racing | 24 | 3 | 8 | 10 | 3 | 78.3 | 73 | 83 |
| River | 27 | 4 | 10 | 8 | 5 | 79.6 | 66 | 85 |
| Rosario Central | 28 | 3 | 9 | 11 | 5 | 75.7 | 61 | 81 |
| San Lorenzo | 23 | 3 | 6 | 10 | 4 | 79.3 | 71 | 83 |
| San Martín (Mza) | 23 | 2 | 8 | 6 | 7 | 58.2 | 53 | 64 |
| San Martín (SJ) | 24 | 3 | 7 | 10 | 4 | 53.6 | 51 | 57 |
| San Martín (Tuc) | 23 | 2 | 8 | 9 | 4 | 54.3 | 51 | 58 |
| San Miguel | 25 | 2 | 6 | 11 | 6 | 63.2 | 57 | 72 |
| Talleres (Cba) | 25 | 2 | 8 | 10 | 5 | 65.1 | 50 | 80 |
| Tigre | 19 | 3 | 3 | 9 | 4 | 59.5 | 50 | 72 |
| Unión | 23 | 2 | 10 | 7 | 4 | 74.6 | 61 | 81 |
| Vélez | 20 | 2 | 5 | 9 | 4 | 79.7 | 69 | 91 |

## Revisión manual de cinco equipos argentinos

Contrastada contra hechos verificables de forma independiente (dorsales y puestos
conocidos del plantel de 1998):

### Boca

| Dorsal | Jugador | Puesto | Rol | Media |
|---:|---|---|---|---:|
| 1 | Oscar Eduardo CORDOBA Arce | Portero | Portero | 88 |
| 2 | Jorge Hernán BERMÚDEZ Morales | Defensa | Libre | 82 |
| 3 | Rodolfo Martín ARRUABARRENA | Defensa | Lateral izquierdo | 80 |
| 4 | Hugo Benjamín IBARRA | Defensa | Lateral derecho | 82 |
| 5 | Mauricio Alberto SERNA Valencia | Medio | Medio centro defensivo | 73 |
| 6 | Walter Adrián SAMUEL | Defensa | Central izquierdo | 82 |
| 7 | GUILLERMO BARROS SCHELOTTO | Delantero | Extremo izquierdo | 83 |
| 8 | Diego CAGNA | Medio | Interior derecho | 80 |
| 9 | Martín PALERMO | Delantero | Delantero centro | 85 |
| 10 | Juan Román RIQUELME | Medio | Medio centro organizador | 85 |
| 11 | Fernando NAVAS | Medio | Media punta por el centro | 79 |

### River

| Dorsal | Jugador | Puesto | Rol | Media |
|---:|---|---|---|---:|
| 1 | Germán Adrián Ramón BURGOS | Portero | Portero | 83 |
| 2 | Pedro Alcides SARABIA Achucarro | Defensa | Central derecho | 79 |
| 3 | Juan Pablo SORIN | Defensa | Lateral izquierdo | 82 |
| 4 | HERNAN Edgardo DIAZ | Defensa | Lateral derecho | 78 |
| 5 | Leonardo Rubén ASTRADA | Medio | Medio centro defensivo | 81 |
| 6 | Eduardo BERIZZO | Defensa | Central izquierdo | 84 |
| 7 | Juan Antonio PIZZI Torroja | Delantero | Delantero centro | 80 |
| 8 | Marcelo Alejandro ESCUDERO | Medio | Interior derecho | 80 |
| 9 | Sebastián Pascual RAMBERT | Delantero | Extremo derecho | 82 |
| 10 | Marcelo Daniel GALLARDO | Medio | Media punta por el centro | 85 |
| 11 | Sergio Angel BERTI | Medio | Centrocampista izquierda | 84 |

### Vélez

| Dorsal | Jugador | Puesto | Rol | Media |
|---:|---|---|---|---:|
| 1 | José Luis Félix CHILAVERT González | Portero | Portero | 91 |
| 2 | Víctor Hugo SOTOMAYOR | Defensa | Central izquierdo | 80 |
| 3 | Raúl Ernesto CARDOZO | Defensa | Lateral izquierdo | 81 |
| 4 | Flavio Gabriel ZANDONÁ | Defensa | Lateral derecho | 80 |
| 7 | Christian Gustavo BASSEDAS | Medio | Interior izquierdo | 83 |
| 8 | Claudio Daniel HUSAIN | Medio | Interior derecho | 80 |
| 10 | Patricio Alejandro CAMPS | Medio | Media punta por el centro | 86 |
| 13 | Fabián CUBERO | Medio | Medio centro defensivo | 79 |
| 14 | Fernando Daniel PANDOLFI | Delantero | Media punta por el centro | 80 |
| 15 | Sebastián Ariel MÉNDEZ | Defensa | Central izquierdo | 79 |
| 16 | Carlos Horacio COMPAGNUCCI | Medio | Medio centro defensivo | 80 |

### Independiente

| Dorsal | Jugador | Puesto | Rol | Media |
|---:|---|---|---|---:|
| 1 | Faryd Camilo MONDRAGON Alí | Portero | Portero | 88 |
| 2 | Pablo Oscar ROTCHEN | Defensa | Libre | 85 |
| 3 | Juan Carlos RAMIREZ | Defensa | Lateral derecho | 81 |
| 4 | Óscar Carmelo SÁNCHEZ | Defensa | Libre | 79 |
| 5 | Alfredo Raúl CASCINI | Medio | Medio centro defensivo | 79 |
| 7 | José Luis CALDERÓN | Delantero | Delantero centro | 71 |
| 8 | Julio César TORESANI | Medio | Interior derecho | 85 |
| 9 | VÍCTOR Manuel LÓPEZ Narge | Medio | Media punta izquierda | 81 |
| 10 | Daniel Oscar GARNERO | Medio | Media punta por el centro | 80 |
| 11 | Francisco Gabriel GUERRERO | Delantero | Extremo derecho | 83 |
| 12 | Norberto Hugo SCOPONI | Portero | Portero | 77 |

### Racing

| Dorsal | Jugador | Puesto | Rol | Media |
|---:|---|---|---|---:|
| 2 | Diego Raúl CAPRIA Labiste | Defensa | Libre | 79 |
| 3 | Sergio Ariel ZANETTI | Defensa | Lateral izquierdo | 80 |
| 4 | Jorge Federico REINOSO | Defensa | Lateral derecho | 79 |
| 5 | Fernando Héctor QUIROZ | Medio | Medio centro organizador | 79 |
| 6 | Claudio Fernando ÚBEDA | Defensa | Central izquierdo | 80 |
| 7 | Pablo Andrés MICHELINI | Medio | Medio centro defensivo | 80 |
| 8 | Marcelo Alejandro DELGADO | Delantero | Extremo derecho | 81 |
| 9 | Diego Fernando LATORRE | Medio | Media punta por el centro | 82 |
| 10 | Rubén Oscar CAPRIA Labiste | Medio | Media punta por el centro | 83 |
| 11 | Pablo Marcelo BEZOMBE Boaglio | Medio | Centrocampista derecha | 75 |
| 12 | Angel Alejandro MORALES | Medio | Media punta izquierda | 77 |

## Nivel de confianza

| Dato | Confianza | Por qué |
|---|---|---|
| Nombre corto y largo | **alta** | tabla de caracteres extraída del binario; 0 bytes desconocidos en los nombres |
| Dorsal | **alta en Primera**, nula en divisiones menores | marcado por jugador y por equipo |
| Los diez atributos | **alta** | la media cierra con la fórmula del juego en los 1318 registros |
| Demarcación y roles | **alta** | los 19 códigos del README; ningún valor fuera de tabla |
| Fecha de nacimiento | **alta** salvo los registros marcados | validada contra el calendario |
| Altura y peso | **media** | están en el archivo y son verosímiles, pero no hay fuente externa para contrastarlos |
| Nacionalidad | **alta** | tabla de países del PDF del editor; cruzada con el código 3 = Argentina |
| Media global | **derivada, no original** | el archivo no la guarda |
| Valor de mercado y salario | **no existen** | el registro de jugador no los tiene |
| División de la temporada | **inferida** | el archivo no la guarda; ver `argentina_primera.json` |

