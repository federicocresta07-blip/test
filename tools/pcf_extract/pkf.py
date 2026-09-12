"""
LECTOR DEL FORMATO PKF / DBC DE PC FUTBOL 5.x y 6.x.

Un PKF es el contenedor de todos los equipos del juego. Un DBC es un equipo
suelto con la misma estructura interna. Los registros de equipo estan
separados por una cadena fija de Dinamic Multimedia, y eso es lo que permite
delimitarlos sin conocer de antemano la longitud de ninguno.

PROCEDENCIA DE LA ESTRUCTURA
============================

El desglose byte a byte sale de dos fuentes, y ninguna de las dos es una
suposicion nuestra:

1. La documentacion de edicion hexadecimal del README de
   jandro996/EditorPCFutbol6, secciones "Edicion de datos del equipo" y
   "Edicion de datos de jugadores".
2. El binario `EditorPcFutbol.exe` del mismo repo, del que se extrajo la tabla
   de caracteres (ver charmap.py) y el calculo de la media (ver MEDIA_FORMULA).

VALIDACION POR ENCADENAMIENTO
=============================

El formato no lleva contador de jugadores: los registros van uno detras de
otro hasta el proximo separador de equipo. Eso da una verificacion fuerte y
gratis: si se parsea el primer jugador y se encadena hasta el final, la suma
de las longitudes tiene que caer EXACTAMENTE en el separador siguiente. Si cae
un byte antes o despues, el parseo esta mal en alguna parte.

`parse_team` usa esa propiedad al reves para encontrar donde empiezan los
jugadores: prueba cada posicion candidata y se queda con la unica que produce
una cadena que cierra justo. No hace falta parsear correctamente los campos
variables del bloque de equipo para localizar a los jugadores.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from charmap import decode

SEPARATOR = b"Copyright (c)1996 Dinamic Multimedia"

# --- Tablas de codigos, del README del editor ---

DEMARCACIONES = {0: "Portero", 1: "Defensa", 2: "Medio", 3: "Delantero"}

# Los 19 roles. Es la granularidad fina que el juego SI almacena, mas alla de
# las cuatro demarcaciones.
ROLES = {
    0x00: None,  # vacio
    0x01: "Portero",
    0x02: "Lateral derecho",
    0x03: "Lateral izquierdo",
    0x04: "Libre",
    0x05: "Central izquierdo",
    0x06: "Central derecho",
    0x07: "Centrocampista derecha",
    0x08: "Interior derecho",
    0x09: "Delantero centro",
    0x0A: "Medio centro organizador",
    0x0B: "Centrocampista izquierda",
    0x0C: "Extremo derecho",
    0x0D: "Media punta por el centro",
    0x0E: "Extremo izquierdo",
    0x0F: "Medio centro defensivo",
    0x10: "Media punta derecha",
    0x11: "Media punta izquierda",
    0x12: "Interior izquierdo",
}

SKIN = {1: "blanco", 2: "negro", 3: "mulato"}
HAIR = {1: "rubio", 2: "sin pelo", 3: "moreno", 4: "blanco o canoso", 5: "pelirrojo", 6: "castano"}

# Los diez atributos, en el orden exacto en que estan en el archivo.
ATTRIBUTE_ORDER = (
    "velocidad",
    "resistencia",
    "agresividad",
    "calidad",
    "remate",
    "regate",
    "pase",
    "tiro",
    "entradas",
    "portero",
)

# Los cuatro que forman la media, extraido de `calcularMedia` del editor:
#   Media = (Velocidad + Resistencia + Agresividad + Calidad) \ 4
# Division entera. Los cinco sitios de llamada del binario pasan exactamente
# estos cuatro campos y ninguno mas.
MEDIA_FORMULA = ("velocidad", "resistencia", "agresividad", "calidad")

# Campos de texto libre del jugador, en orden. En los archivos originales del
# juego traen las biografias completas; el editor los reescribe como "x".
PLAYER_TEXT_FIELDS = (
    "lugar_nacimiento",
    "club_debut",
    "internacional",
    "perfil",
    "caracteristicas",
    "palmares",
    "internacionalidad",
    "anecdotas",
    "ultima_temporada",
    "trayectoria",
)

COACH_TEXT_FIELDS = (
    "perfil",
    "sistemas_habituales",
    "palmares",
    "anecdotas",
    "ultima_temporada",
    "trayectoria",
)

ATTACK_TYPE = {0: "ofensivo", 1: "especulativo", 2: "mixto"}
TACKLE_TYPE = {0: "suave", 1: "media", 2: "agresiva"}
MARKING = {0: "zona", 1: "hombre"}
CLEARANCE = {0: "jugado", 1: "largo"}
PRESSING = {0: "propio", 1: "medio", 2: "rival"}


class Cursor:
    """Lector secuencial. Guarda el offset de cada campo que lee, porque el
    informe pide poder decir de que byte salio cada valor."""

    def __init__(self, data: bytes, pos: int = 0):
        self.data = data
        self.pos = pos

    def u8(self) -> int:
        v = self.data[self.pos]
        self.pos += 1
        return v

    def u16(self) -> int:
        v = int.from_bytes(self.data[self.pos : self.pos + 2], "little")
        self.pos += 2
        return v

    def u24(self) -> int:
        v = int.from_bytes(self.data[self.pos : self.pos + 3], "little")
        self.pos += 3
        return v

    def raw(self, n: int) -> bytes:
        v = self.data[self.pos : self.pos + n]
        self.pos += n
        return v

    def text(self) -> str:
        """Cadena con longitud por delante: 2 bytes little-endian + N bytes."""
        n = self.u16()
        return decode(self.raw(n))

    def peek(self, n: int = 1) -> bytes:
        return self.data[self.pos : self.pos + n]


@dataclass
class Player:
    source_offset: int
    pointer: int
    shirt_number: int
    short_name: str
    long_name: str
    slot: int
    procedencia: int
    roles: list[str | None]
    role_codes: list[int]
    nationality_code: int
    skin_code: int
    hair_code: int
    demarcacion_code: int
    birth_day: int
    birth_month: int
    birth_year: int
    height: int
    weight: int
    birth_country_code: int
    texts: dict[str, str] = field(default_factory=dict)
    attributes: dict[str, int] = field(default_factory=dict)

    @property
    def demarcacion(self) -> str | None:
        return DEMARCACIONES.get(self.demarcacion_code)

    @property
    def media(self) -> int:
        """La media derivada con la formula del juego. NO esta en el archivo."""
        return sum(self.attributes[k] for k in MEDIA_FORMULA) // 4

    @property
    def birth_date(self) -> str | None:
        """La fecha solo se publica si es una fecha real del calendario.

        El archivo tiene fechas imposibles (un 31 en un mes de 30, por
        ejemplo): son campos que el juego dejo sin poblar bien. Se devuelven
        como None y los tres bytes crudos quedan igual en `birth_date_raw`,
        para que el hueco se vea y nadie lo confunda con un dato."""
        import datetime

        if not (1900 <= self.birth_year <= 2100):
            return None
        try:
            datetime.date(self.birth_year, self.birth_month, self.birth_day)
        except ValueError:
            return None
        return f"{self.birth_year:04d}-{self.birth_month:02d}-{self.birth_day:02d}"


@dataclass
class Coach:
    source_offset: int
    pointer: int
    short_name: str
    long_name: str
    texts: dict[str, str] = field(default_factory=dict)
    had_player_career: bool = False


@dataclass
class Team:
    source_offset: int
    separator_offset: int
    pointer: int
    file_version: str
    language_code: int
    is_foreign: bool
    short_name: str
    long_name: str | None = None
    stadium_name: str | None = None
    country_code: int | None = None
    stadium_capacity: int | None = None
    standing_capacity: int | None = None
    pitch_length: int | None = None
    pitch_width: int | None = None
    founded: int | None = None
    members: int | None = None
    president: str | None = None
    budget_game: int | None = None
    budget_real: int | None = None
    sponsor: str | None = None
    kit: str | None = None
    unknown_after_country: int | None = None
    unknown_after_founded: str | None = None
    filial_pointer: int | None = None
    filial2_pointer: int | None = None
    last_ten_leagues: str | None = None
    seasons_first_division: int | None = None
    played: int | None = None
    won: int | None = None
    drawn: int | None = None
    goals_for: int | None = None
    goals_against: int | None = None
    points: int | None = None
    times_champion: int | None = None
    times_runner_up: int | None = None
    tactic_blob_length: int | None = None
    unparsed_trailing_bytes: int | None = None
    tactics: dict[str, Any] | None = None
    header_confidence: str = "no_parseado"
    coach: Coach | None = None
    players: list[Player] = field(default_factory=list)
    players_offset: int | None = None
    chain_validated: bool = False
    notes: list[str] = field(default_factory=list)


def find_separators(data: bytes) -> list[int]:
    offs: list[int] = []
    pos = 0
    while True:
        i = data.find(SEPARATOR, pos)
        if i < 0:
            break
        offs.append(i)
        pos = i + 1
    return offs


def parse_player(data: bytes, pos: int) -> tuple[Player, int]:
    """Parsea un jugador. Devuelve el jugador y el offset del byte siguiente.

    Levanta ValueError si algo no cuadra: lo usa el buscador de cadena para
    descartar posiciones candidatas.
    """
    start = pos
    c = Cursor(data, pos)
    marker = c.u8()
    if marker != 0x01:
        raise ValueError(f"marca de jugador esperada 0x01, hay 0x{marker:02X} en {start}")
    pointer = c.u16()
    shirt = c.u8()

    n = c.u16()
    if not (1 <= n <= 40):
        raise ValueError(f"longitud de nombre corto fuera de rango: {n}")
    short_name = decode(c.raw(n))
    n = c.u16()
    if not (1 <= n <= 120):
        raise ValueError(f"longitud de nombre largo fuera de rango: {n}")
    long_name = decode(c.raw(n))

    slot = c.u8()
    procedencia = c.u8()
    role_codes = [c.u8() for _ in range(6)]
    for code in role_codes:
        if code not in ROLES:
            raise ValueError(f"codigo de rol desconocido 0x{code:02X}")
    nationality = c.u8()
    skin = c.u8()
    hair = c.u8()
    demarcacion = c.u8()
    if demarcacion not in DEMARCACIONES:
        raise ValueError(f"demarcacion desconocida {demarcacion}")
    day = c.u8()
    month = c.u8()
    year = c.u16()
    height = c.u8()
    weight = c.u8()
    birth_country = c.u8()

    texts: dict[str, str] = {}
    for name in PLAYER_TEXT_FIELDS:
        n = c.u16()
        if n > 4000:
            raise ValueError(f"campo de texto {name} absurdamente largo: {n}")
        texts[name] = decode(c.raw(n))

    attributes = {k: c.u8() for k in ATTRIBUTE_ORDER}
    for k, v in attributes.items():
        if v > 100:
            raise ValueError(f"atributo {k} fuera de escala: {v}")

    player = Player(
        source_offset=start,
        pointer=pointer,
        shirt_number=shirt,
        short_name=short_name,
        long_name=long_name,
        slot=slot,
        procedencia=procedencia,
        roles=[ROLES[c2] for c2 in role_codes],
        role_codes=role_codes,
        nationality_code=nationality,
        skin_code=skin,
        hair_code=hair,
        demarcacion_code=demarcacion,
        birth_day=day,
        birth_month=month,
        birth_year=year,
        height=height,
        weight=weight,
        birth_country_code=birth_country,
        texts=texts,
        attributes=attributes,
    )
    return player, c.pos


def parse_coach(data: bytes, pos: int) -> tuple[Coach, int]:
    start = pos
    c = Cursor(data, pos)
    marker = c.u8()
    if marker != 0x02:
        raise ValueError(f"marca de entrenador esperada 0x02, hay 0x{marker:02X}")
    pointer = c.u16()
    n = c.u16()
    if not (1 <= n <= 40):
        raise ValueError(f"nombre corto de entrenador fuera de rango: {n}")
    short_name = decode(c.raw(n))
    n = c.u16()
    if not (1 <= n <= 120):
        raise ValueError(f"nombre largo de entrenador fuera de rango: {n}")
    long_name = decode(c.raw(n))

    texts: dict[str, str] = {}
    for name in COACH_TEXT_FIELDS:
        n = c.u16()
        if n > 4000:
            raise ValueError(f"campo de entrenador {name} absurdamente largo: {n}")
        texts[name] = decode(c.raw(n))

    had_career = c.peek() == b"\x03"
    if had_career:
        c.u8()
        n = c.u16()
        if n > 4000:
            raise ValueError("trayectoria como jugador absurdamente larga")
        texts["trayectoria_jugador"] = decode(c.raw(n))
    n = c.u16()
    if n > 4000:
        raise ValueError("declaraciones absurdamente largas")
    texts["declaraciones"] = decode(c.raw(n))

    return Coach(
        source_offset=start,
        pointer=pointer,
        short_name=short_name,
        long_name=long_name,
        texts=texts,
        had_player_career=had_career,
    ), c.pos


def chain_players(data: bytes, start: int, end: int) -> list[Player] | None:
    """Encadena jugadores desde `start`. Devuelve la lista solo si la cadena
    cierra justo al final de la region; si no, devuelve None.

    Despues del ultimo jugador hay un byte 0x00 de cierre de equipo. Se
    descubrio midiendo: la cadena de Boca termina un byte antes del separador
    siguiente y ese byte es 0x00. Se aceptan las dos variantes porque el
    ultimo equipo del archivo no tiene separador detras.
    """
    players, trailing = chain_players_loose(data, start, end)
    if players and trailing <= 1:
        return players
    return None


def chain_players_loose(data: bytes, start: int, end: int) -> tuple[list[Player], int]:
    """Como chain_players pero devuelve tambien cuantos bytes quedaron sin
    consumir. Un cierre limpio deja 0 o 1 (el 0x00 de fin de equipo)."""
    players: list[Player] = []
    pos = start
    while pos < end:
        if pos == end - 1 and data[pos] == 0x00:
            pos = end
            break
        try:
            player, pos = parse_player(data, pos)
        except (ValueError, IndexError):
            break
        players.append(player)
        if len(players) > 80:
            break
    return players, end - pos


def parse_team_header(team: Team, data: bytes, pos: int, limit: int) -> int | None:
    """Parsea el bloque de datos del equipo. Devuelve el offset siguiente.

    La estructura se verifico contra EQ003003.PKF y difiere en dos puntos de
    lo que dice el README del editor, que documenta la variante de PC Futbol
    6.0 y no la de PC Apertura:

    - Entre el codigo de pais y el nombre largo hay UN byte, no el par de
      latitud que menciona el README. Su significado no se pudo determinar y
      se publica en crudo como `unknown_after_country`.
    - Entre el anio de fundacion y el numero de socios hay DOS bytes que el
      README no menciona. Tampoco se pudo determinar su significado y van en
      crudo como `unknown_after_founded`.

    Los campos que si se pudieron verificar, contra datos comprobables de
    River: capacidad 76.687 (Monumental), cancha 70x105, fundacion 1901,
    socios 62.999, presidente "Alfredo Angel Davicce", sponsor QUILMES,
    indumentaria ADIDAS.
    """
    c = Cursor(data, pos)

    def checked_text(label: str, max_len: int) -> str:
        """Texto validado: la longitud tiene que caber antes del techo y el
        contenido tiene que decodificar sin bytes desconocidos. Si no, se
        aborta la cabecera en vez de publicar un campo corrido."""
        n = int.from_bytes(data[c.pos : c.pos + 2], "little")
        if n > max_len or c.pos + 2 + n > limit:
            raise ValueError(f"{label}: longitud {n} implausible o pasa el techo")
        value = c.text()
        if "<" in value and ">" in value:
            raise ValueError(f"{label}: bytes no decodificables")
        return value

    try:
        team.stadium_name = checked_text("estadio", 60)
        team.country_code = c.u8()
        team.unknown_after_country = c.u8()
        team.long_name = checked_text("nombre largo", 80)
        team.stadium_capacity = c.u24()
        c.u8()  # separador fijo
        team.standing_capacity = c.u24()
        c.u8()  # separador fijo
        team.pitch_length = c.u16()
        team.pitch_width = c.u16()
        team.founded = c.u16()
        team.unknown_after_founded = c.raw(2).hex()
        team.members = c.u24()
        c.u8()  # separador fijo
        team.president = checked_text("presidente", 60)
        team.budget_game = c.u24()
        c.u8()  # separador fijo
        team.budget_real = c.u24()
        c.u8()  # separador fijo; el README no lo menciona y esta
        team.sponsor = checked_text("sponsor", 40)
        team.kit = checked_text("indumentaria", 40)
        team.filial_pointer = c.u16()
        team.filial2_pointer = c.u16()
        c.u8()  # grupo de 2aB
        team.last_ten_leagues = c.raw(20).hex()
        team.seasons_first_division = c.u8()
        team.played = c.u16()
        team.won = c.u16()
        team.drawn = c.u16()
        team.goals_for = c.u16()
        team.goals_against = c.u16()
        team.points = c.u16()
        team.times_champion = c.u8()
        team.times_runner_up = c.u8()
    except (IndexError, ValueError) as exc:
        # Se limpia todo lo que quedo a medias: un campo corrido es peor que
        # un campo ausente, porque parece un dato.
        for attr in (
            "stadium_name", "country_code", "unknown_after_country", "long_name",
            "stadium_capacity", "standing_capacity", "pitch_length", "pitch_width",
            "founded", "unknown_after_founded", "members", "president",
            "budget_game", "budget_real", "sponsor", "kit", "filial_pointer",
            "filial2_pointer", "last_ten_leagues", "seasons_first_division",
            "played", "won", "drawn", "goals_for", "goals_against", "points",
            "times_champion", "times_runner_up",
        ):
            setattr(team, attr, None)
        team.header_confidence = "no_parseado"
        team.notes.append(f"cabecera no parseada: {exc}")
        return None

    if c.pos > limit:
        team.header_confidence = "no_parseado"
        team.notes.append("cabecera descartada: paso el techo del entrenador")
        return None

    team.header_confidence = "original"
    return c.pos


def parse_tactics(data: bytes, coach_offset: int) -> dict[str, Any]:
    """Los siete bytes de tactica de equipo, que van pegados antes de la marca
    de entrenador. El bloque de "tactica definida" que los precede tiene
    longitud variable por version, asi que se leen hacia atras desde el
    entrenador en lugar de hacia adelante desde la cabecera."""
    q = coach_offset - 7
    toque, counter, attack, tackle, marking, clearance, pressing = data[q : q + 7]
    return {
        "toque_pct": toque,
        "contragolpe_pct": counter,
        "tipo_ataque": ATTACK_TYPE.get(attack),
        "tipo_entradas": TACKLE_TYPE.get(tackle),
        "marcaje": MARKING.get(marking),
        "despejes": CLEARANCE.get(clearance),
        "presion": PRESSING.get(pressing),
        "raw": data[q : q + 7].hex(),
    }


def parse_team(data: bytes, sep_offset: int, region_end: int) -> Team:
    pos = sep_offset + len(SEPARATOR)
    c = Cursor(data, pos)
    pointer = c.u16()
    version = c.raw(2).hex()
    language = c.u8()
    foreign = c.u8()
    short_name = c.text()

    team = Team(
        source_offset=pos,
        separator_offset=sep_offset,
        pointer=pointer,
        file_version=version,
        language_code=language,
        is_foreign=bool(foreign),
        short_name=short_name,
    )

    # El entrenador y los jugadores solo existen en equipos de liga nacional.
    # Lo dice el README y lo confirman los datos: los 418 equipos extranjeros
    # de este archivo no traen ni uno.
    if team.is_foreign:
        team.notes.append("equipo de liga extranjera: el formato no guarda entrenador ni jugadores")
        parse_team_header(team, data, c.pos, limit=region_end)
        return team

    # PRIMERO EL ENTRENADOR Y LOS JUGADORES, DESPUES LA CABECERA.
    #
    # Se hace en este orden a proposito. Entre la cabecera y el entrenador hay
    # un bloque de "tactica definida" de longitud variable, asi que la
    # cabecera no puede decir donde empieza el entrenador. Al reves si: el
    # entrenador se localiza por doble validacion y eso da un techo duro para
    # acotar la cabecera.
    #
    # DOBLE VALIDACION: se prueba cada marca 0x02 y se exige que las dos cosas
    # cierren, que el entrenador parsee Y que la cadena de jugadores que le
    # sigue termine exactamente en el separador del equipo siguiente. Se toma
    # la primera (la mas temprana): una marca posterior puede cerrar por
    # casualidad si cae sobre un limite real de jugador, y de hecho pasa.
    coach_offset = None
    for p in range(c.pos, min(region_end, c.pos + 60000)):
        if data[p] != 0x02:
            continue
        try:
            coach, players_pos = parse_coach(data, p)
        except (ValueError, IndexError):
            continue
        chained = chain_players(data, players_pos, region_end)
        if chained is None:
            continue
        team.coach = coach
        team.players = chained
        team.players_offset = players_pos
        team.chain_validated = True
        coach_offset = p
        if p >= 7:
            team.tactics = parse_tactics(data, p)
        break

    if coach_offset is None:
        # Segunda pasada, mas laxa. La cadena estricta exige consumir la region
        # entera y hay equipos donde detras del ultimo jugador queda un bloque
        # de metadata del contenedor (el mismo patron de 38 bytes que la
        # cabecera del archivo). Perder 22 jugadores reales por eso seria peor
        # que aceptarlos marcados: cada registro se valido igual por dentro.
        best: tuple[int, list[Player], int] | None = None
        for p in range(c.pos, min(region_end, c.pos + 60000)):
            if data[p] != 0x02:
                continue
            try:
                coach, players_pos = parse_coach(data, p)
            except (ValueError, IndexError):
                continue
            players, trailing = chain_players_loose(data, players_pos, region_end)
            if len(players) >= 11 and (best is None or len(players) > len(best[1])):
                best = (p, players, trailing)
                team.coach = coach
                team.players_offset = players_pos
        if best is not None:
            coach_offset, team.players, trailing = best
            team.chain_validated = False
            team.unparsed_trailing_bytes = trailing
            team.notes.append(
                f"la cadena no consumio la region entera: {trailing} bytes sin parsear "
                "detras del ultimo jugador. Los jugadores si parsearon uno por uno."
            )
            if coach_offset >= 7:
                team.tactics = parse_tactics(data, coach_offset)
        else:
            # Tercera pasada: sin entrenador utilizable. Belgrano es el caso
            # real: su registro de entrenador no parsea porque el propio juego
            # le dejo la biografia de otro tecnico (un texto del Sporting de
            # Gijon), asi que se buscan los jugadores directamente.
            for start in range(c.pos, region_end - 40):
                if data[start] != 0x01:
                    continue
                players, trailing = chain_players_loose(data, start, region_end)
                if len(players) >= 11:
                    team.players = players
                    team.players_offset = start
                    team.chain_validated = trailing <= 1
                    if trailing > 1:
                        team.unparsed_trailing_bytes = trailing
                    team.notes.append(
                        "entrenador no parseable; jugadores localizados por barrido"
                    )
                    break
            else:
                team.notes.append("no se pudo encadenar ningun jugador en la region")

    limit = coach_offset - 7 if coach_offset is not None else (team.players_offset or region_end)
    after_header = parse_team_header(team, data, c.pos, limit=limit)
    if after_header is not None and coach_offset is not None:
        team.tactic_blob_length = coach_offset - 7 - after_header
    return team


def parse_file(data: bytes) -> list[Team]:
    seps = find_separators(data)
    teams: list[Team] = []
    for i, off in enumerate(seps):
        end = seps[i + 1] if i + 1 < len(seps) else len(data)
        teams.append(parse_team(data, off, end))
    return teams
