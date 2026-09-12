# pcf_extract

Extractor de datos de **PC Fútbol 5.x / 6.x** y sus versiones regionales, entre
ellas **PC Apertura 6.0** (Argentina, 1998). Lee los archivos `.PKF` y `.DBC`
del juego y escribe JSON, CSV y SQLite. Sin interfaz gráfica y sin depender del
editor original.

## Uso

```bash
# un archivo
python3 extract_pcf.py --input EQ003003.PKF --output ../../data/pc_apertura_98/ --sqlite

# un directorio con varios .PKF o .DBC
python3 extract_pcf.py --input EquiposDBC/ --output ../../data/salida/

# incluir los equipos de liga extranjera (que no traen plantel en el formato)
python3 extract_pcf.py --input EQ003003.PKF --output out/ --include-foreign

# validar lo extraído
python3 validate.py --data ../../data/pc_apertura_98/ --output ../../reports/extraction_validation.md
```

Sin dependencias: solo la librería estándar de Python 3.

## Dónde poner el archivo del juego

`--input` acepta cualquier ruta, así que no hace falta copiarlo a ningún lugar
concreto. Los archivos de equipos de cada versión son:

| Versión | Archivo |
|---|---|
| PC Apertura 6.0 (Argentina) | `EQ003003.PKF` |
| PC Apertura 5.0 | `EQ003022.PKF` |
| PC Fútbol 6.0 y extensión 1 | `EQ022022.PKF` |
| PC Fútbol 6.0 extensión 2 | `EQPCPLUS.PKF` |
| PC Premier 6.0 | `EQ030022.PKF` |
| PC Calcio 6.0 | `EQ036022.PKF` |

Para conseguir `EQ003003.PKF`, ver la sección "Cómo reproducirlo" de
`reports/pc_apertura_98_extraction.md`: está en el historial de git del repo
`jandro996/EditorPCFutbol6`, dentro de un RAR que su commit HEAD borró.

## Archivos

| Archivo | Qué hace |
|---|---|
| `charmap.py` | la tabla de 148 caracteres, extraída del IL de `EditorPcFutbol.exe` |
| `pkf.py` | el lector del formato: contenedor, equipo, entrenador y jugador |
| `extract_pcf.py` | CLI de extracción y escritura de los datasets |
| `validate.py` | las diez comprobaciones de integridad, genera el informe |

## Reglas que respeta

- Un campo que el formato no guarda sale como `null` y queda documentado; no se
  rellena con nada.
- La media global **no está almacenada** en el archivo: se publica como
  `overall_derived` con su fórmula, y `overall_original` es siempre `null`.
- El generador aleatorio de atributos del editor (`asignarMedias`) está
  documentado pero **no se usa**: los atributos salen del archivo.
- Cada valor lleva `source_file`, `source_offset` y `data_confidence`.

El formato está especificado en [`docs/pcf_data_format.md`](../../docs/pcf_data_format.md).
