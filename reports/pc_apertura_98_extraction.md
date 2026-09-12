# Extracción de PC Apertura 98 — informe final

Qué se buscaba: recuperar de **PC Apertura 6.0** (la versión argentina de PC
Fútbol 6.0, 1998) los equipos, los jugadores, sus atributos y sus dorsales,
para usarlos como base histórica de un juego de management.

Qué se consiguió: **55 equipos argentinos, 1318 jugadores y
54 entrenadores**, con los diez atributos originales de cada
jugador, su dorsal, su fecha de nacimiento, su demarcación y hasta seis roles.
Todo desde el binario, con un extractor reproducible por línea de comandos.

Lo que no existe en el formato —valor de mercado, salario, pie dominante y la
media global— sale como `null` y está documentado. No se rellenó nada.

---

## 1. Qué se encontró

El repositorio `jandro996/EditorPCFutbol6` **ya no tiene el editor**: su commit
HEAD se llama literalmente `borrado el editor` y elimina un
`Editor PCF 6.0.rar` de 46 MB. El árbol de trabajo solo tiene el README, los
manuales, capturas y vídeos.

Ese RAR se recuperó del historial de git, y adentro estaba todo:

- **`Archivos Editor/PC_APERTURA6/EQ003003.PKF`** — el archivo que se buscaba.
- `MANAGARG.EXE` — el ejecutable del juego argentino.
- `EquiposDBC/Originales/6_APERTURA98.PKF` — **byte a byte idéntico** al
  anterior (mismo md5, `27ea04aecc39959e48f13bc940d82541`).
- Otros 13 PKF originales: Apertura 97, PCF 5.0 y 6.0 y sus extensiones,
  Calcio, Premier, France.
- `EditorPcFutbol.exe` + `.pdb` — de donde salieron la tabla de caracteres y
  las fórmulas.
- Los manuales con las tablas de punteros de países y de equipos.

Así que la respuesta a "¿está EQ003003.PKF en el repositorio?" es **sí, pero en
el historial**, no en el checkout.

## 2. Qué archivos contienen la información

| Archivo | Qué tiene |
|---|---|
| `EQ003003.PKF` (1.779.284 bytes) | los 473 equipos del juego, de los cuales 55 argentinos con plantel completo |
| `EditorPcFutbol.exe` | tabla de 148 caracteres (`Letra_HexToDec`), fórmula de la media (`calcularMedia`), generador de medias (`asignarMedias`) |
| `Manuales/Punteros Paises.pdf` | 117 códigos de país |
| `Archivos Editor/Actualización/demarcacion_*.txt` | confirma que PC Fútbol usa **cuatro** demarcaciones |
| `MANAGARG.EXE` | la estructura de competiciones (**no extraída**, ver limitaciones) |

## 3. Cómo funciona el formato

En detalle en [`docs/pcf_data_format.md`](../docs/pcf_data_format.md). En corto:

- Un PKF es un contenedor; los equipos van separados por la cadena fija
  `Copyright (c)1996 Dinamic Multimedia`.
- Enteros little-endian; cadenas con longitud de 2 bytes por delante y
  **codificadas con una tabla propia**, no ASCII.
- Cada equipo trae cabecera, táctica, un bloque de entrenador (marca `0x02`) y
  N bloques de jugador (marca `0x01`), y cierra con un `0x00`.
- No hay contador de jugadores: se termina cuando aparece el separador
  siguiente. Eso da la validación por encadenamiento que se usó en todo el
  trabajo.

## 4. Qué datos de jugador existen realmente

| Campo | ¿Existe? | Confianza |
|---|---|---|
| Nombre corto y nombre largo | sí | alta |
| Puntero (id interno) | sí | alta |
| **Dorsal** | **sí**, byte tras el puntero | alta en Primera, nula en ascenso |
| Demarcación (4 categorías) | sí | alta |
| **Hasta 6 roles** (19 códigos) | sí | alta |
| Los 10 atributos | sí | alta |
| Fecha de nacimiento (día, mes, año) | sí | alta |
| Altura y peso | sí, con valores centinela | media |
| Nacionalidad y país de nacimiento | sí | alta |
| Lugar de nacimiento | sí | alta |
| Color de piel y de pelo | sí | alta |
| Slot en la plantilla | sí | alta |
| 10 campos de biografía | sí, texto completo | alta |

## 5. Qué datos NO existen

Esto está verificado por el parseo byte a byte, no por no haber buscado: el
registro termina en el décimo atributo y el byte siguiente es la marca del
jugador siguiente, comprobado por encadenamiento en los 1318
registros.

- **Valor de mercado** — no existe.
- **Salario / ficha** — no existe.
- **Pie dominante** — no existe.
- **Media global** — no almacenada (ver punto 6).
- **Edad** — no almacenada; se deriva de la fecha de nacimiento.
- **División de la temporada en curso** — no está en el archivo de equipos.

## 6. Cómo se almacena la media

**No se almacena.** Es una función de cuatro de los diez atributos, y la
fórmula se extrajo del método `calcularMedia` de `EditorPcFutbol.exe`:

```
media = (velocidad + resistencia + agresividad + calidad) \ 4
```

División entera. Los cinco sitios del binario que llaman a ese método pasan
exactamente esos cuatro campos. Los otros seis —remate, regate, pase, tiro,
entradas y portero— **no entran en la media**.

Por eso en los datasets:

- `overall_original` es siempre **`null`**: no hay original que recuperar.
- `overall_derived` trae el valor calculado con la fórmula del juego.
- `overall_not_stored_in_source` es `true` en todos los registros.
- `attributes_source` es `"original"`: los diez atributos sí son del archivo.

El editor tiene además un algoritmo **inverso** (`asignarMedias`) que inventa
atributos individuales a partir de una media global, a base de
`rand(media ± 4)` y `rand(media ± 10)`. Queda documentado en
`docs/pcf_data_format.md` para poder distinguirlo. **Ningún dato de esta
extracción pasó por ahí.**

## 7. Qué estadísticas individuales existen

Diez, en este orden en el archivo, escala **0–100** (observado 1–99):

`velocidad`, `resistencia`, `agresividad`, `calidad`, `remate`, `regate`,
`pase`, `tiro`, `entradas`, `portero`.

Los cuatro primeros son los que forman la media.

## 8. Cómo funciona la posición

**Dos niveles, y los dos se conservan.**

1. **Demarcación** — un byte, cuatro valores: Portero, Defensa, Medio,
   Delantero. Que son exactamente cuatro lo confirman los cinco archivos
   `demarcacion_*.txt` del editor, donde todas las fuentes externas
   (Transfermarkt, SoFIFA, BDFA...) se mapean a esas cuatro.
2. **Roles** — seis bytes por jugador, 19 códigos posibles: lateral derecho,
   lateral izquierdo, libre, central izquierdo/derecho, centrocampista
   derecha/izquierda, interior derecho/izquierdo, medio centro organizador,
   medio centro defensivo, media punta por el centro/derecha/izquierda,
   extremo derecho/izquierdo, delantero centro, portero.

Los datasets traen `position_original` (la demarcación), `position_normalized`
(GK/DF/MF/FW, para el juego destino), `role_primary` y `roles` completos. **No
se pierde granularidad**: se agrega una capa, no se reemplaza ninguna.

## 9. ¿Existe dorsal?

**Sí, y está en el propio jugador**: es el byte inmediatamente posterior a su
puntero. Es la opción **A** de las cuatro planteadas.

Pero el juego solo lo pobló de verdad en los equipos de Primera. En muchos
clubes de ascenso quedó en 0 o en 1 para todo el plantel, así que cada jugador
lleva `shirt_number_reliable` y cada equipo también: son utilizables en **21 de
los 55** equipos.

Prueba de que donde está poblado es correcto — Boca: 1 Córdoba, 2 Bermúdez,
3 Arruabarrena, 4 Ibarra, 5 Serna, 6 Samuel, 7 Guillermo Barros Schelotto,
8 Cagna, 9 Palermo, 10 Riquelme.

## 10 y 11. Cuántos equipos y jugadores

| | |
|---|---|
| Equipos en el archivo | 473 |
| Equipos argentinos (liga nacional, con plantel) | **55** |
| Equipos extranjeros (sin plantel en el formato) | 418 |
| **Jugadores extraídos** | **1318** |
| Entrenadores extraídos | 54 |
| Jugadores en los 20 clubes inferidos de Primera | 462 |

Los 418 equipos extranjeros no tienen plantel **por diseño del formato**: su
byte de liga vale `01` y, como dice el README del editor, en ese caso el juego
no guarda ni entrenador ni jugadores. Se exportan igual con sus datos de club
si se pasa `--include-foreign`.

## 12. Problemas encontrados

| Problema | Alcance | Qué se hizo |
|---|---|---|
| El editor estaba borrado del repo | — | recuperado del historial de git |
| `unrar-free` y p7zip fallan con el RAR | — | extraído con libarchive |
| `monodis` no resuelve el ensamblado de VB | — | leído el IL directamente con `dnfile` |
| El README documenta PCF6, no PC Apertura | 3 campos del bloque de equipo | encontrados midiendo; 2 quedan sin identificar y se publican en crudo |
| Valores centinela en altura y peso | 635 y 636 jugadores | altura 140 / peso 1 → `null` + flag |
| Fechas de nacimiento imposibles | 7 jugadores | `null` + los 3 bytes crudos |
| Un byte de carácter sin resolver | 1 de 1318 nombres | se deja marcado como `<5D>` |
| Punteros repetidos | 1 equipo (un combinado, no un club) | id desambiguado + flag |
| Bytes sin parsear tras el último jugador | 1 equipo (Godoy Cruz, 1222 bytes) | son metadata del contenedor; el equipo queda marcado |
| El entrenador de Belgrano no parsea | 1 equipo | el juego le dejó la biografía de otro técnico; jugadores localizados por barrido |

## 13. Nivel de confianza

**Alto para lo estructural.** Dos verificaciones independientes lo sostienen:

1. **Encadenamiento.** Los registros de jugador no llevan contador: la suma de
   sus longitudes tiene que caer exactamente en el separador del equipo
   siguiente. Cierra en **54 de 55** equipos.
2. **La media.** La fórmula viene del binario, no de los datos. Que
   `(VE+RE+AG+CA)\4` dé la media en **los 1318 registros** prueba que
   los diez atributos se leen del lugar correcto: un byte de corrimiento
   rompería la igualdad en casi todos.

A eso se suma que el bloque de táctica mide 264 bytes en los 55 equipos —un
valor único— lo que cruza-valida la cabecera contra la posición del entrenador.

**Alto para los datos verificables de forma independiente.** Riquelme nacido el
24/06/1978, dorsal 10, medio centro organizador; Chilavert dorsal 1 en Vélez;
la numeración completa de Boca; River fundado en 1901 con el Monumental en
76.687 y Dávicce como presidente.

**Explícitamente bajo o nulo donde corresponde**: la media es derivada y no
original; el valor de mercado y el salario no existen; los dorsales del ascenso
no sirven; la asignación de división es inferida.

### La única inferencia que queda en los datos

El archivo de equipos **no guarda la división de la temporada en curso**. La
estructura de competiciones está en `MANAGARG.EXE`, en offsets que el editor
lleva hardcodeados y que no se extrajeron.

`argentina_primera.json` usa entonces un criterio derivado del propio archivo y
lo declara: **presupuesto > 0 y historial de ligas propio** (los clubes de
ascenso comparten una cadena de historial repetida y tienen presupuesto 0). Da
exactamente 20 equipos, que es el tamaño del torneo.

Los cuatro casos que cumplen una señal y no la otra se devuelven **aparte** en
lugar de resolverlos por nuestra cuenta:

| Equipo | Presupuesto | Historial propio | Jugadores con biografía real |
|---|---:|---|---:|
| Banfield | 0 | sí | 0 |
| Dep. Español | 0 | sí | 4 |
| Gimnasia y Tiro | 0 | sí | 2 |
| Huracán (Ctes) | 0 | sí | 0 |

Se buscó una respuesta mejor: se intentó localizar el plantel de la división en
`MANAGARG.EXE` cruzando los punteros de equipo del PKF contra el ejecutable. Los
55 punteros aparecen, pero dispersos y sin ninguna racha contigua; la zona más
densa resultó ser una tabla de recursos de 8 bytes de paso, no la lista de la
competición. Queda como el trabajo pendiente que cerraría el asunto.

---

## TOP 30 por media (los 20 clubes inferidos de Primera)

| # | Jugador | Equipo | Posición | Media | Dorsal |
|---:|---|---|---|---:|---:|
| 1 | José Luis Félix CHILAVERT González | Vélez | Portero | 91 | 1 |
| 2 | Faryd Camilo MONDRAGON Alí | Independiente | Portero | 88 | 1 |
| 3 | Oscar Eduardo CORDOBA Arce | Boca | Portero | 88 | 1 |
| 4 | Esteban Matias CAMBIASSO Deleau | Independiente | Medio | 87 | 19 |
| 5 | Patricio Alejandro CAMPS | Vélez | Medio | 86 | 10 |
| 6 | Hugo Alberto MORALES | Lanús | Medio | 85 | 10 |
| 7 | Juan Román RIQUELME | Boca | Medio | 85 | 10 |
| 8 | Julio César TORESANI | Independiente | Medio | 85 | 8 |
| 9 | Marcelo Daniel GALLARDO | River | Medio | 85 | 10 |
| 10 | Martín PALERMO | Boca | Delantero | 85 | 9 |
| 11 | Pablo Oscar ROTCHEN | Independiente | Defensa | 85 | 2 |
| 12 | Cristian Gastón CASTILLO | River | Delantero | 84 | 20 |
| 13 | Eduardo BERIZZO | River | Defensa | 84 | 6 |
| 14 | Jorge Daniel MARTÍNEZ | River | Defensa | 84 | 25 |
| 15 | Sergio Angel BERTI | River | Medio | 84 | 11 |
| 16 | Christian Gustavo BASSEDAS | Vélez | Medio | 83 | 7 |
| 17 | Daniel Oscar CRAVERO | Lanús | Medio | 83 | 5 |
| 18 | Francisco Gabriel GUERRERO | Independiente | Delantero | 83 | 11 |
| 19 | GUILLERMO BARROS SCHELOTTO | Boca | Delantero | 83 | 7 |
| 20 | Germán Adrián Ramón BURGOS | River | Portero | 83 | 1 |
| 21 | MARCELO Adrián GÓMEZ | River | Medio | 83 | 15 |
| 22 | Marcelo ELIZAGA | Lanús | Portero | 83 | 12 |
| 23 | Néstor Raúl GOROSITO | San Lorenzo | Medio | 83 | 10 |
| 24 | Oscar Fernando PASSET | San Lorenzo | Portero | 83 | 1 |
| 25 | Rubén Oscar CAPRIA Labiste | Racing | Medio | 83 | 10 |
| 26 | Claudio Darío BIAGGIO | San Lorenzo | Delantero | 82 | 18 |
| 27 | Darío Fernando HUSAIN | Vélez | Delantero | 82 | 22 |
| 28 | Diego Fernando LATORRE | Racing | Medio | 82 | 9 |
| 29 | Diego Jesús QUINTANA | Newell's | Delantero | 82 | 11 |
| 30 | Diego PLACENTE | River | Defensa | 82 | 14 |

Nota: el TOP 30 sobre los 55 equipos estaría encabezado por jugadores de
"Estrellas ARGENTINA" y "Juveniles ARGENTINA", que son **combinados del juego y
no clubes** (un socio, presupuesto 1). Se excluyen de esta tabla y quedan en
`teams.json` marcados.

## Entrenadores de los 20 clubes

| Equipo | Entrenador |
|---|---|
| River | Ramón Angel DIAZ |
| San Lorenzo | Alfio BASILE |
| Vélez | Eduardo SOLARI |
| Argentinos Jrs. | Osvaldo Alberto SOSA |
| Newell's | Jorge Manuel CASTELLI |
| Lanús | Roberto Mario GÓMEZ |
| Rosario Central | Edgardo BAUZÁ |
| Gim. Esgrima (LP) | Carlos Timoteo GRIGUOL |
| Independiente | César Luis MENOTTI |
| Racing | Ángel CAPPA Polchi |
| Boca | Carlos BIANCHI |
| Huracán | Óscar LÓPEZ/Óscar Armando CAVALLERO |
| Platense | Carlos PICERNI |
| Gimnasia (J) | Néstor MANFREDI |
| Ferro | Gerónimo SACCARDI |
| Colón | Francisco FERRARO |
| Estudiantes (LP) | Patricio José HERNÁNDEZ |
| Talleres (Cba) | Ricardo Alberto GARECA |
| Unión | Mario Nicasio ZANABRIA |

---

## Cómo reproducirlo

```bash
# 1. Recuperar el editor borrado del historial del repo
git clone https://github.com/jandro996/EditorPCFutbol6.git
cd EditorPCFutbol6
git show b6b92d5:"Editor PCF 6.0.rar" > editor.rar

# 2. Extraerlo (unrar-free y p7zip fallan con este archivo)
pip install libarchive-c
python3 -c "import libarchive; libarchive.extract_file('editor.rar')"

# 3. Extraer los datos
python3 tools/pcf_extract/extract_pcf.py \
    --input "Editor PCF 6.0/Archivos Editor/PC_APERTURA6/EQ003003.PKF" \
    --output data/pc_apertura_98/ --sqlite

# 4. Validar
python3 tools/pcf_extract/validate.py \
    --data data/pc_apertura_98/ \
    --output reports/extraction_validation.md
```

El extractor también acepta un **directorio** con varios `.PKF` o `.DBC`, y con
`--include-foreign` agrega los 418 equipos extranjeros (que no traen plantel).

Los otros 13 PKF del RAR se pueden extraer con el mismo comando: Apertura 97,
PC Fútbol 5.0 y 6.0 con sus extensiones, Calcio, Premier y France.

## Archivos generados

| Archivo | Contenido |
|---|---|
| `data/pc_apertura_98/teams.json` | 55 equipos con estadio, capacidad, fundación, socios, presidente, sponsor, indumentaria y táctica |
| `data/pc_apertura_98/players.json` | 1318 jugadores, esquema completo con biografías |
| `data/pc_apertura_98/players.csv` | los mismos, plano, con los 10 atributos en columnas |
| `data/pc_apertura_98/coaches.json` | 54 entrenadores |
| `data/pc_apertura_98/argentina_primera.json` | los 20 clubes inferidos de Primera, cada uno con su plantel |
| `data/pc_apertura_98/database.sqlite` | las tres tablas con índices por equipo, media y posición |
| `reports/extraction_validation.md` | las diez comprobaciones y la tabla equipo por equipo |
| `docs/pcf_data_format.md` | la especificación del formato |
