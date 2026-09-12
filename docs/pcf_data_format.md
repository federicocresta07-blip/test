# Formato de datos de PC Fútbol / PC Apertura (archivos PKF y DBC)

Ingeniería inversa del formato en el que **PC Fútbol 5.x / 6.x** y sus versiones
regionales —entre ellas **PC Apertura 6.0**, la argentina— guardan equipos,
jugadores y entrenadores.

Este documento describe el formato. El extractor que lo implementa está en
`tools/pcf_extract/` y los datos que salieron de aplicarlo, en
`data/pc_apertura_98/`.

---

## De dónde salió cada cosa

Tres fuentes, ninguna de ellas conjetura:

| Fuente | Qué aportó |
|---|---|
| `README.md` de [jandro996/EditorPCFutbol6](https://github.com/jandro996/EditorPCFutbol6), secciones de edición hexadecimal | El desglose byte a byte del registro de equipo y del de jugador, y las tablas de códigos de rol, demarcación, piel, pelo y táctica |
| `EditorPcFutbol.exe` del mismo repo, analizado sobre su IL | La **tabla de 148 caracteres** (método `Letra_HexToDec`, RVA `0x0000FFEC`), la **fórmula de la media** (`calcularMedia`, RVA `0x0006CB44`) y el **generador de medias** (`asignarMedias`, RVA `0x000744FC`) |
| `Manuales/Punteros Paises.pdf` y `Punteros Equipos.pdf` | Los 117 códigos de país y la lista de punteros de equipo |

Y una cuarta que sirvió de verificación: **el propio `EQ003003.PKF`**, contra el
que se comprobó que todo lo anterior produce nombres, fechas y dorsales
correctos.

### Cómo se recuperó el editor

El repositorio **ya no tiene** el editor: su commit HEAD se llama
`borrado el editor` y elimina un `Editor PCF 6.0.rar` de 46 MB. Se recuperó del
historial:

```bash
git clone https://github.com/jandro996/EditorPCFutbol6.git
cd EditorPCFutbol6
git show b6b92d5:"Editor PCF 6.0.rar" > editor.rar
```

Ese RAR contiene los binarios, los manuales **y los archivos originales del
juego**, incluido `Archivos Editor/PC_APERTURA6/EQ003003.PKF`.

> Nota de herramientas: `unrar-free` aborta con
> `Pathname cannot be converted from UTF-16BE` al llegar a `ESPAÑA.txt`, y el
> codec RAR de p7zip segfaultea. Lo que sí funciona es libarchive:
> `pip install libarchive-c` y `libarchive.extract_file('editor.rar')`, que
> saca los 324 archivos completos.

---

## El contenedor

Un **PKF** es el paquete con todos los equipos del juego. Un **DBC** es un
equipo suelto con la misma estructura interna: el editor genera DBCs a partir
de un PKF y los vuelve a meter. Por eso el mismo parser sirve para los dos.

Los registros de equipo están separados por una cadena fija de 36 bytes en
ASCII plano:

```
Copyright (c)1996 Dinamic Multimedia
```

(con **"Dinamic"**, que es el nombre real de la empresa, no "Dynamic").

Eso es lo que permite delimitar equipos sin conocer de antemano la longitud de
ninguno: se buscan todas las apariciones y cada equipo ocupa de una hasta la
siguiente. En `EQ003003.PKF` hay **473**.

El archivo empieza con una cabecera propia del contenedor y hay bloques de
metadata intercalados con el mismo patrón de 38 bytes; no se analizaron porque
no contienen datos de jugador.

---

## Registro de equipo

Todos los enteros son **little-endian**. Las cadenas llevan la longitud
delante, en 2 bytes, y van codificadas con la tabla de caracteres (ver más
abajo) — **no** son ASCII.

| Campo | Tipo | Notas |
|---|---|---|
| separador | 36 bytes | la cadena de Dinamic |
| puntero del equipo | u16 | identificador del equipo en el juego |
| versión del fichero | 2 bytes | `0d02` en PC Apertura 6.0 |
| idioma | u8 | `00` español |
| liga nacional / extranjera | u8 | **`00` nacional, `01` extranjera** |
| nombre corto | u16 + N | |
| nombre del estadio | u16 + N | |
| código de país | u8 | ver tabla de países |
| *no identificado* | u8 | 1 byte cuyo significado no se pudo determinar |
| nombre largo | u16 + N | |
| capacidad del estadio | u24 | |
| separador | u8 | fijo |
| capacidad de pie | u24 | |
| separador | u8 | fijo |
| largo del campo | u16 | metros |
| ancho del campo | u16 | metros |
| año de fundación | u16 | |
| *no identificado* | 2 bytes | significado no determinado |
| socios | u24 | |
| separador | u8 | fijo |
| presidente | u16 + N | |
| presupuesto del juego | u24 | **unidad desconocida** en la versión argentina |
| separador | u8 | fijo |
| presupuesto real | u24 | |
| separador | u8 | **no está en el README; se encontró midiendo** |
| patrocinador | u16 + N | |
| indumentaria | u16 + N | |
| puntero del filial | u16 | `FFFF` si no hay |
| puntero del filial 2 | u16 | `FFFF` si no hay |
| grupo de 2ªB | u8 | solo aplica a España |
| puesto en las últimas 10 ligas | 20 bytes | pares (puesto, división); división `00` es primera |
| temporadas en primera | u8 | |
| partidos jugados / ganados / empatados | 3 × u16 | históricos |
| goles a favor / en contra | 2 × u16 | |
| puntos | u16 | |
| veces campeón / subcampeón | 2 × u8 | |
| posiciones por jornada | 46 bytes | |
| palmarés | 17 bytes | |
| táctica definida | **264 bytes** en PC Apertura | longitud variable según versión |
| táctica de equipo | 7 bytes | ver abajo |
| bloque de entrenador | | empieza con `0x02` |
| bloques de jugador | | cada uno empieza con `0x01` |
| cierre de equipo | u8 | un `0x00` detrás del último jugador |

### Dos diferencias con el README del editor

El README documenta la variante de PC Fútbol 6.0. En **PC Apertura** hay tres
cosas distintas, encontradas midiendo contra el archivo:

1. Entre el código de país y el nombre largo hay **un** byte, no el par de
   latitud del estadio que menciona el README.
2. Entre el año de fundación y los socios hay **dos** bytes que el README no
   menciona.
3. Después del presupuesto real hay **un separador** que el README no lista.

Los dos primeros se publican en crudo (`unidentified_byte_after_country`,
`unidentified_bytes_after_founded`) en lugar de inventarles un nombre.

### Los 7 bytes de táctica de equipo

| Byte | Significado |
|---|---|
| 0 | porcentaje de toque |
| 1 | porcentaje de contragolpe |
| 2 | tipo de ataque: `00` ofensivo, `01` especulativo, `02` mixto |
| 3 | tipo de entradas: `00` suave, `01` media, `02` agresiva |
| 4 | marcaje: `00` zona, `01` hombre |
| 5 | despejes: `00` jugado, `01` largo |
| 6 | presión: `00` propio, `01` medio, `02` rival |

Como el bloque de "táctica definida" que los precede cambia de longitud según
la versión, el extractor los lee **hacia atrás** desde la marca de entrenador
en lugar de hacia adelante desde la cabecera.

---

## Registro de jugador

Éste es el que importa. Todos los campos verificados byte a byte contra
`EQ003003.PKF`.

| Campo | Tipo | Offset relativo | Rango observado | Notas |
|---|---|---|---|---|
| marca de inicio | u8 | +0 | `0x01` | fija |
| **puntero del jugador** | u16 | +1 | 0–65535 | único dentro del equipo (una excepción, ver validación) |
| **dorsal** | u8 | +3 | 0–99 | **está en el archivo**; ver la sección de dorsales |
| nombre corto | u16 + N | +4 | 1–40 chars | |
| nombre largo | u16 + N | | 1–120 chars | |
| slot en el equipo | u8 | | | posición en la plantilla |
| procedencia | u8 | | | `00` continúa |
| **roles** | 6 × u8 | | 0x00–0x12 | hasta seis roles, `00` vacío |
| nacionalidad | u8 | | 1–117 | tabla de países |
| color de piel | u8 | | 1–3 | `01` blanco, `02` negro, `03` mulato |
| color de pelo | u8 | | 1–6 | `01` rubio, `02` sin pelo, `03` moreno, `04` blanco o canoso, `05` pelirrojo, `06` castaño |
| **demarcación** | u8 | | 0–3 | `00` Portero, `01` Defensa, `02` Medio, `03` Delantero |
| día de nacimiento | u8 | | 1–31 | |
| mes de nacimiento | u8 | | 1–12 | |
| año de nacimiento | u16 | | | |
| **altura** | u8 | | cm | `140` y `0/1` son centinelas de "sin dato" |
| **peso** | u8 | | kg | `1` y `0` son centinelas |
| país de nacimiento | u8 | | | |
| lugar de nacimiento | u16 + N | | | texto |
| club de debut | u16 + N | | | texto |
| internacional | u16 + N | | | texto |
| perfil | u16 + N | | | texto |
| características | u16 + N | | | texto, biografía real en los archivos originales |
| palmarés | u16 + N | | | texto |
| internacionalidad | u16 + N | | | texto |
| anécdotas | u16 + N | | | texto |
| última temporada | u16 + N | | | texto |
| trayectoria | u16 + N | | | texto con formato `torneo,club,div,PJ,G==` |
| **medias** | 10 × u8 | | 1–99 | ver abajo |

Los diez campos de texto traen en los archivos originales del juego las
**biografías completas** de cada jugador, de hasta ~1000 caracteres. El editor,
cuando reescribe un jugador, las reemplaza por `"x"`.

### Los 19 roles

Ésta es la granularidad fina que el juego **sí** almacena, más allá de las
cuatro demarcaciones. Cada jugador tiene hasta seis.

| Código | Rol | Código | Rol |
|---|---|---|---|
| `00` | (vacío) | `0A` | Medio centro organizador |
| `01` | Portero | `0B` | Centrocampista izquierda |
| `02` | Lateral derecho | `0C` | Extremo derecho |
| `03` | Lateral izquierdo | `0D` | Media punta por el centro |
| `04` | Libre | `0E` | Extremo izquierdo |
| `05` | Central izquierdo | `0F` | Medio centro defensivo |
| `06` | Central derecho | `10` | Media punta derecha |
| `07` | Centrocampista derecha | `11` | Media punta izquierda |
| `08` | Interior derecho | `12` | Interior izquierdo |
| `09` | Delantero centro | | |

Ejemplo real — Riquelme en `EQ003003.PKF`: `0A 08 12 0B 07 0D`, es decir medio
centro organizador, interior derecho, interior izquierdo, centrocampista
izquierda, centrocampista derecha y media punta por el centro.

### Los diez atributos

En este orden exacto en el archivo:

```
VE velocidad   RE resistencia   AG agresividad   CA calidad   RM remate
RG regate      PA pase          TI tiro          EN entradas  PO portero
```

**Escala 0–100**; en `EQ003003.PKF` los valores observados van de 1 a 99.

### La media global

**No está almacenada.** El registro de jugador termina en el décimo atributo y
el byte siguiente es la marca `0x01` del jugador siguiente. Está verificado por
encadenamiento en los 1318 registros.

La media es una función de cuatro de los diez atributos. Sale del método
`calcularMedia` de `EditorPcFutbol.exe`, que es literalmente un promedio con
división entera:

```
media = (velocidad + resistencia + agresividad + calidad) \ 4
```

Los cinco sitios del binario que la llaman pasan exactamente esos cuatro
campos. Los otros seis —remate, regate, pase, tiro, entradas y portero— **no
entran en la media**, que es por qué Chilavert puede quedar en 91 con un
`portero` de 90 que no participa del cálculo.

Ejemplo: Riquelme tiene velocidad 81, resistencia 84, agresividad 85 y calidad
90 → (81+84+85+90) \ 4 = **85**.

### El algoritmo inverso: `asignarMedias`

El editor también hace el camino contrario, cuando el usuario le da una media
global y le pide que invente las individuales. Está en `asignarMedias` y es
**aleatorio**:

```
velocidad, agresividad, resistencia = rand(media-4, media+4)   cada uno
calidad = 4*media - velocidad - agresividad - resistencia      (cierra la media exacta)
   ... con un bucle que recorta a 99 lo que se pase y redistribuye

si demarcación == Portero:
   portero = rand(media-1, media+1)
   tiro, remate, regate, pase, entradas = rand(10, 30)
si no:
   tiro, remate, regate, pase, entradas = rand(media-10, media+10)
   portero = rand(10, 40)
```

Queda documentado para poder **distinguirlo**, no para usarlo. Los datos de
`data/pc_apertura_98/` no pasaron nunca por acá: salen del archivo. Por eso
cada atributo lleva `attributes_source: "original"`.

---

## Registro de entrenador

| Campo | Tipo | Notas |
|---|---|---|
| marca de inicio | u8 | `0x02` |
| puntero del entrenador | u16 | |
| nombre corto | u16 + N | |
| nombre largo | u16 + N | |
| perfil | u16 + N | texto |
| sistemas habituales | u16 + N | texto |
| palmarés | u16 + N | texto |
| anécdotas | u16 + N | texto |
| última temporada | u16 + N | texto |
| trayectoria | u16 + N | texto |
| ¿fue jugador? | u8 | `0x03` si sí; entonces sigue un campo más |
| trayectoria como jugador | u16 + N | solo si el byte anterior es `0x03` |
| declaraciones | u16 + N | texto |

El registro **no** guarda fecha de nacimiento, nacionalidad ni contrato del
entrenador.

---

## La tabla de caracteres

Los textos **no** son ASCII. Se extrajo la tabla completa del método
`Letra_HexToDec` de `EditorPcFutbol.exe`, leyendo en orden los literales
`ldstr` de su cuerpo IL: son dos listas paralelas de 148 elementos, primero los
códigos y después los caracteres. **148 pares, cero colisiones.**

La codificación va en **pares intercambiados**:

```
a=0x00  b=0x03  c=0x02  d=0x05  e=0x04  f=0x07  g=0x06 ...
0=0x51  1=0x50  2=0x53  3=0x52  4=0x55  5=0x54  6=0x57  7=0x56  8=0x59  9=0x58
```

Las mayúsculas son la minúscula **+ 0x20**. Y hay entradas para todo el juego
de acentos latinos (`0x80` á, `0x88` é, `0x8C` í, `0x92` ó, `0x9B` ú, `0x90` ñ)
y para puntuación (`0x41` espacio, `0x4F` punto, `0x4C` guion, `0x49` y `0x48`
paréntesis, `0x46` apóstrofo).

La tabla está en `tools/pcf_extract/charmap.py` con su procedencia anotada.

Verificación independiente: decodificar los nombres de equipo del archivo da
"River", "Boca", "Vélez", "Huracán", "Dep. Español" y los otros 52 sin un solo
byte desconocido. Sobre los 1318 nombres de jugador queda **un** byte sin
resolver (`0x5D`, en "Matías Ezequiel ELORZ`<5D>`A" de Tigre).

> El editor trae además un `Archivos Editor/map.txt` con 21 entradas, que es su
> tabla de reparación para bytes que la tabla principal no conoce
> (`Error al convertir a decimal: Valor de letra no conocido`). Según ese mapa
> `0x5D` sería `<`, lo que daría "ELORZ<A": no es evidentemente mejor que
> dejarlo marcado, así que se deja marcado.

---

## Tabla de países

117 entradas, de `Manuales/Punteros Paises.pdf`. Las relevantes acá:
`03` Argentina, `10` Brasil, `14` Chile, `16` Colombia, `22` España,
`36` Italia. Cruzada dos veces: los jugadores argentinos del archivo llevan
`03`, y el ejemplo de Real Madrid del README lleva `0x16`, que en la tabla es
España.

---

## Cómo se valida que el parseo es correcto

Dos propiedades del formato dan verificación gratis, y las dos se usan:

**1. Encadenamiento.** No hay contador de jugadores: los registros van uno
detrás de otro hasta el separador del equipo siguiente. Si la suma de las
longitudes no cae exactamente ahí (más el `0x00` de cierre), el parseo está mal
en alguna parte. Cierra en 54 de los 55 equipos argentinos.

El extractor usa esa propiedad **al revés** para localizar dónde empiezan los
jugadores, en lugar de depender de haber parseado bien los campos variables del
bloque de equipo: prueba cada marca `0x02` candidata y exige que el entrenador
parsee **y** que la cadena cierre. Dos condiciones independientes que tienen
que coincidir en el mismo offset.

**2. La media.** Como la fórmula sale del binario y no de los datos, comprobar
que `(VE+RE+AG+CA)\4` da la media en los 1318 registros verifica que los diez
atributos se están leyendo del lugar correcto. Un byte de corrimiento rompería
la igualdad en casi todos.

Un detalle que costó encontrar: el bloque de táctica definida mide **264 bytes
en los 55 equipos**, un valor único, lo que a su vez cruza-valida la cabecera
contra la posición del entrenador.

---

## Lo que el formato NO guarda

Verificado por el parseo byte a byte, no por ausencia de búsqueda:

| Campo | Estado |
|---|---|
| **Valor de mercado** | no existe en el registro de jugador |
| **Salario / ficha** | no existe en el registro de jugador |
| **Pie dominante** | no existe |
| **Media global** | no almacenada; es derivable de 4 de los 10 atributos |
| **Edad** | no almacenada; está la fecha de nacimiento |
| **División de la temporada en curso** | no está en el archivo de equipos; vive en `MANAGARG.EXE` |
| Fecha de nacimiento y nacionalidad del entrenador | no existen en su registro |

El equipo **sí** tiene presupuesto (dos campos u24), pero la unidad en la
versión argentina no se pudo determinar, así que se publica el entero crudo.

---

## Diferencias entre versiones

| Versión | Archivo de equipos | Manager |
|---|---|---|
| PC Fútbol 6.0 | `EQ022022.PKF` | `MANAGER.EXE` |
| PC Fútbol 6.0 Ext. 1 | `EQ022022.PKF` | `MANAGER.EXE` |
| PC Fútbol 6.0 Ext. 2 | `EQPCPLUS.PKF` | `MANAGER.EXE` |
| PC Premier 6.0 | `EQ030022.PKF` | `MANAGPRE.EXE` |
| PC Calcio 6.0 | `EQ036022.PKF` | `MANAGER.EXE` |
| **PC Apertura 6.0** | **`EQ003003.PKF`** | **`MANAGARG.EXE`** |
| PC Apertura 5.0 | `EQ003022.PKF` | `MANAGER.EXE` |
| PC France 5.0 | `EQ024022.PKF` | `MANAGER.EXE` |

La estructura de jugador es la misma en 5.x y 6.x; lo que cambia es la versión
del fichero, que determina qué campos opcionales del bloque de equipo están
presentes.

**Lo específico de la versión argentina** no es el formato sino el contenido:
`EQ003003.PKF` trae 55 equipos argentinos con plantel completo (contra 418
extranjeros sin plantel), y en esos 55 están tanto los clubes de Primera como
los de las divisiones de ascenso, además de dos combinados ("Estrellas
ARGENTINA" y "Juveniles ARGENTINA") que no son clubes.

`EQ003003.PKF` y `6_APERTURA98.PKF` del directorio `EquiposDBC/Originales` son
**byte a byte idénticos** (md5 `27ea04aecc39959e48f13bc940d82541`, 1.779.284
bytes).

---

## Los dorsales

El dorsal está en el archivo, en el byte inmediatamente posterior al puntero
del jugador. Es la respuesta **A** de las cuatro que planteaba la pregunta: no
depende de la alineación ni está en otro bloque.

Pero solo está **poblado de verdad en los equipos de Primera**. En muchos
clubes de divisiones menores el juego dejó el campo en 0 o en 1 para todo el
plantel. Presentar eso como dorsales sería inventar, así que cada jugador lleva
`shirt_number_reliable` y cada equipo también: son utilizables en **21 de los
55** equipos.

Evidencia de que donde está poblado es correcto — Boca en `EQ003003.PKF`:
1 Córdoba, 2 Bermúdez, 3 Arruabarrena, 4 Ibarra, 5 Serna, 6 Samuel,
7 Guillermo Barros Schelotto, 8 Cagna, 9 Palermo, 10 Riquelme.
