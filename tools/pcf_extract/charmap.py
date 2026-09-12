"""
TABLA DE CARACTERES DE PC FUTBOL 5.x / 6.x.

NO esta escrita a mano ni deducida: se extrajo del metodo `Letra_HexToDec`
del binario `EditorPcFutbol.exe` (repo jandro996/EditorPCFutbol6), leyendo los
literales `ldstr` de su cuerpo IL en orden. El metodo es un Select Case con dos
listas paralelas de 148 elementos: primero los codigos y despues los
caracteres.

Procedencia exacta:
  EditorPcFutbol.exe -> MethodDef "Letra_HexToDec" -> RVA 0x0000FFEC
  148 pares, sin colisiones.

Verificacion independiente: decodificar los nombres de equipo de
EQ003003.PKF con esta tabla produce "River", "Boca", "Independiente",
"Velez", "Huracan", "Dep. Espanol" y los otros 55 clubes argentinos sin un
solo byte desconocido.

Observacion sobre la codificacion: las letras y los digitos van en pares
intercambiados (a=0x00, b=0x03, c=0x02, d=0x05... 0=0x51, 1=0x50, 2=0x53,
3=0x52...). Las mayusculas son la minuscula + 0x20.
"""

# byte -> caracter
HEX_TO_CHAR = {
    0x00: 'a',
    0x01: "'",
    0x02: 'c',
    0x03: 'b',
    0x04: 'e',
    0x05: 'd',
    0x06: 'g',
    0x07: 'f',
    0x08: 'i',
    0x09: 'h',
    0x0A: 'k',
    0x0B: 'j',
    0x0C: 'm',
    0x0D: 'l',
    0x0E: 'o',
    0x0F: 'n',
    0x10: 'q',
    0x11: 'p',
    0x12: 's',
    0x13: 'r',
    0x14: 'u',
    0x15: 't',
    0x16: 'w',
    0x17: 'v',
    0x18: 'y',
    0x19: 'x',
    0x1B: 'z',
    0x20: 'A',
    0x22: 'C',
    0x23: 'B',
    0x24: 'E',
    0x25: 'D',
    0x26: 'G',
    0x27: 'F',
    0x28: 'I',
    0x29: 'H',
    0x2A: 'K',
    0x2B: 'J',
    0x2C: 'M',
    0x2D: 'L',
    0x2E: 'O',
    0x2F: 'N',
    0x30: 'Q',
    0x31: 'P',
    0x32: 'S',
    0x33: 'R',
    0x34: 'U',
    0x35: 'T',
    0x36: 'W',
    0x37: 'V',
    0x38: 'Y',
    0x39: 'X',
    0x3B: 'Z',
    0x3D: '\\',
    0x41: ' ',
    0x42: '#',
    0x43: '"',
    0x44: '%',
    0x46: "'",
    0x47: '&',
    0x48: ')',
    0x49: '(',
    0x4A: '+',
    0x4B: '*',
    0x4C: '-',
    0x4D: ',',
    0x4E: '/',
    0x4F: '.',
    0x50: '1',
    0x51: '0',
    0x52: '3',
    0x53: '2',
    0x54: '5',
    0x55: '4',
    0x56: '7',
    0x57: '6',
    0x58: '9',
    0x59: '8',
    0x5A: ';',
    0x5B: ':',
    0x6B: '=',
    0x6C: '=',
    0x80: 'á',
    0x81: 'à',
    0x82: 'ã',
    0x83: 'â',
    0x84: 'å',
    0x85: 'ä',
    0x86: 'ç',
    0x88: 'é',
    0x89: 'è',
    0x8A: 'ë',
    0x8B: 'ê',
    0x8C: 'í',
    0x8D: 'ì',
    0x8E: 'ï',
    0x8F: 'î',
    0x90: 'ñ',
    0x91: 'ð\xa0',
    0x92: 'ó',
    0x93: 'ò',
    0x94: 'õ',
    0x95: 'ô',
    0x97: 'ö',
    0x98: 'ù',
    0x99: 'ø',
    0x9A: 'û',
    0x9B: 'ú',
    0x9C: 'ý',
    0x9D: 'ü',
    0x9E: 'ÿ',
    0x9F: 'þ',
    0xA0: 'Á',
    0xA1: 'À',
    0xA2: 'Ã',
    0xA3: 'Â',
    0xA4: 'Å',
    0xA5: 'Ä',
    0xA6: 'Ç',
    0xA7: 'Æ',
    0xA8: 'É',
    0xA9: 'È',
    0xAA: 'Ë',
    0xAB: 'Ê',
    0xAC: 'Í',
    0xAD: 'Ì',
    0xAE: 'Ï',
    0xAF: 'Î',
    0xB0: 'Ñ',
    0xB1: 'Ð',
    0xB2: 'Ó',
    0xB3: 'Ò',
    0xB4: 'Õ',
    0xB5: 'Ô',
    0xB7: 'Ö',
    0xB8: 'Ù',
    0xB9: 'Ø',
    0xBA: 'Û',
    0xBB: 'Ú',
    0xBC: 'Ý',
    0xBD: 'Ü',
    0xC0: '.',
    0xC2: '.',
    0xC3: '.',
    0xC5: '.',
    0xCB: '.',
    0xD5: '.',
    0xDB: '.',
}

CHAR_TO_HEX = {}
for _b, _c in HEX_TO_CHAR.items():
    CHAR_TO_HEX.setdefault(_c, _b)

UNKNOWN = "\ufffd"


def decode(raw: bytes, strict: bool = False) -> str:
    """Decodifica una cadena de PC Futbol.

    Con strict=True levanta ValueError ante un byte que no esta en la tabla.
    Con strict=False (por defecto) lo deja como <XX> para que el problema
    quede visible en los datos en lugar de desaparecer.
    """
    out = []
    for b in raw:
        ch = HEX_TO_CHAR.get(b)
        if ch is None:
            if strict:
                raise ValueError(f"byte 0x{b:02X} no esta en la tabla de caracteres")
            out.append(f"<{b:02X}>")
        else:
            out.append(ch)
    return "".join(out)


def has_unknown(text: str) -> bool:
    return "<" in text and ">" in text
