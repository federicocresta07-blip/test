#!/usr/bin/env python3
"""
EXTRACTOR DE DATOS DE PC FUTBOL / PC APERTURA.

    python extract_pcf.py --input EQ003003.PKF --output data/pc_apertura_98/
    python extract_pcf.py --input EquiposDBC/ --output data/salida/
    python extract_pcf.py --input EQ003003.PKF --output out/ --sqlite

Sin interfaz grafica y sin depender del editor original: lee el binario,
parsea y escribe JSON, CSV y, si se pide, SQLite.

REGLA DE ORO DE ESTE EXTRACTOR
==============================

Un campo que el formato no guarda sale como null y queda documentado. No se
rellena con nada. En particular, y esto esta verificado byte a byte:

- El VALOR DE MERCADO no existe en el registro de jugador.
- El SALARIO / FICHA no existe en el registro de jugador.
- El PIE DOMINANTE no existe.
- La MEDIA GLOBAL no esta almacenada: es una funcion de cuatro atributos que
  si estan. Se publica como `overall_derived`, nunca como `overall_original`.
- La EDAD no esta almacenada: esta la fecha de nacimiento. La edad se calcula
  contra una fecha de referencia que se declara en el propio dato.

Cada valor lleva su procedencia: `source_file`, `source_offset` y
`data_confidence`, que vale "original" cuando salio del archivo tal cual.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from charmap import HEX_TO_CHAR  # noqa: E402
from pkf import (  # noqa: E402
    ATTRIBUTE_ORDER,
    HAIR,
    MEDIA_FORMULA,
    SKIN,
    Player,
    Team,
    parse_file,
)

# ---------------------------------------------------------------------------
# Tablas auxiliares
# ---------------------------------------------------------------------------

# Codigos de pais: los 117 de "Manuales/Punteros Paises.pdf" del repo del
# editor, completos. Verificacion cruzada: el codigo 3 (Argentina) es el que
# llevan los jugadores argentinos del archivo, y el 22 (Espana) coincide con
# el ejemplo de Real Madrid del README.
#
# La primera version de este archivo solo tenia las 44 primeras entradas y por
# eso Chilavert salia sin nacionalidad. Se vio en pantalla, no en los tests:
# un codigo que no esta en la tabla devuelve None y no rompe nada.
COUNTRIES = {
   1: 'Albania', 2: 'Alemania', 3: 'Argentina', 4: 'Australia', 5: 'Austria',
   6: 'Azerbaiyán', 7: 'Bielorusia', 8: 'Bolivia', 9: 'Bosnia', 10: 'Brasil',
   11: 'Bulgaria', 12: 'Bélgica', 13: 'Camerún', 14: 'Chile', 15: 'Chipre', 16: 'Colombia',
   17: 'Croacia', 18: 'Dinamarca', 19: 'Escocia', 20: 'Eslovaquia', 21: 'Eslovenia',
   22: 'España', 23: 'Finlandia', 24: 'Francia', 25: 'Ghana', 26: 'Grecia', 27: 'Holanda',
   28: 'Honduras', 29: 'Hungría', 30: 'Inglaterra', 31: 'Irlanda', 32: 'Irlanda del Norte',
   33: 'Islandia', 34: 'Islas Feroe', 35: 'Israel', 36: 'Italia', 37: 'Lituania',
   38: 'Luxemburgo', 39: 'Macedonia', 40: 'Malta', 41: 'Marruecos', 42: 'Moldavia',
   43: 'Nigeria', 44: 'Noruega', 45: 'País de Gales', 46: 'Polonia', 47: 'Portugal',
   48: 'Rep. Checa', 49: 'Rumania', 50: 'Rusia', 51: 'Serbia', 52: 'Sudáfrica',
   53: 'Suecia', 54: 'Suiza', 55: 'Turquía', 56: 'Ucrania', 57: 'Uruguay',
   58: 'Yugoslavia', 59: 'Perú', 60: 'Canadá', 61: 'Usa', 62: 'Georgia', 63: 'Costa Rica',
   64: 'Paraguay', 65: 'Japón', 66: 'Argelia', 67: 'Trinidad Y Tobago', 68: 'Senegal',
   69: 'Surinam', 70: 'Zambia', 71: 'Cabo Verde', 72: 'Venezuela', 73: 'Rodesia',
   74: 'Singapur', 75: 'Andorra', 76: 'Mozambique', 77: 'Liechtenstein', 78: 'Liberia',
   79: 'Panamá', 80: 'Zaire (actual República Democrática del Congo)', 81: 'Tadzhikistán',
   82: 'Uzbekistán', 83: 'México', 84: 'Guinea', 85: 'Angola', 86: 'Zimbabwe',
   87: 'Sierra Leona', 88: 'Guadalupe', 89: 'Ecuador', 90: 'Estonia', 91: 'Guinea Bissau',
   92: 'Libia', 93: 'Egipto', 94: 'Jamaica', 95: 'Nueva Caledonia', 96: 'Bermudas',
   97: 'Nueva Zelanda', 98: 'Guayana France', 99: 'San Vicente', 100: 'Chad', 101: 'Togo',
   102: 'Guinea Conakry', 103: 'Tanzania', 104: 'Burkina Faso', 105: 'Gambia',
   106: 'Ruanda', 107: 'Kenia', 108: 'Mauritania', 109: 'Mali', 110: 'Uganda',
   111: 'Congo (República del Congo)', 112: 'Letonia',
   113: 'Costa de Marfil o Costa de Ivori', 114: 'Armenia', 115: 'Nicaragua',
   116: 'Cataluña', 117: 'Níger',
}

# La normalizacion que pide el juego destino. La granularidad fina NO se
# pierde: se conserva en `position_original`, `role_primary` y `roles`.
POSITION_NORMALIZED = {"Portero": "GK", "Defensa": "DF", "Medio": "MF", "Delantero": "FW"}

# Fecha de referencia para calcular la edad. El Clausura 1998 se jugo entre
# febrero y junio de 1998 y el Apertura 1998 arranco en agosto, asi que el 1
# de julio de 1998 cae entre los dos. Se declara en cada registro para que
# nadie tenga que adivinar contra que se calculo.
AGE_REFERENCE = date(1998, 7, 1)

OVERALL_FORMULA_TEXT = "(velocidad + resistencia + agresividad + calidad) // 4"


def age_at(birth: date, reference: date) -> int:
    return (
        reference.year
        - birth.year
        - ((reference.month, reference.day) < (birth.month, birth.day))
    )


# Valores centinela de altura y peso. Se determinaron contando: la altura 140
# aparece 558 veces y va con peso 1 en 557 de ellas; ninguna otra altura se
# repite asi. 0 y 1 son el caso de campo vacio.
HEIGHT_PLACEHOLDERS = frozenset({0, 1, 140})
WEIGHT_PLACEHOLDERS = frozenset({0, 1})


def height_or_none(value: int) -> int | None:
    return None if value in HEIGHT_PLACEHOLDERS else value


def weight_or_none(value: int) -> int | None:
    return None if value in WEIGHT_PLACEHOLDERS else value


def slug(text: str) -> str:
    out = []
    for ch in text.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " .-_()'":
            out.append("-")
    return "-".join(filter(None, "".join(out).split("-")))


# ---------------------------------------------------------------------------
# Conversion a los registros de salida
# ---------------------------------------------------------------------------


def team_id(team: Team) -> str:
    return f"{slug(team.short_name)}-{team.pointer}"


def team_record(team: Team, source_file: str, shirt_reliable: bool) -> dict[str, Any]:
    return {
        "id": team_id(team),
        "pcf_pointer": team.pointer,
        "short_name": team.short_name,
        "long_name": team.long_name,
        "country_code": team.country_code,
        "country": COUNTRIES.get(team.country_code or -1),
        "is_national_league": not team.is_foreign,
        "stadium_name": team.stadium_name,
        "stadium_capacity": team.stadium_capacity,
        "standing_capacity": team.standing_capacity,
        "pitch_length_m": team.pitch_length,
        "pitch_width_m": team.pitch_width,
        "founded": team.founded,
        "members": team.members,
        "president": team.president,
        # El presupuesto esta en el archivo pero su UNIDAD no se pudo
        # determinar para la version argentina, asi que va el entero crudo.
        "budget_game_raw": team.budget_game,
        "budget_real_raw": team.budget_real,
        "budget_unit": None,
        "sponsor": team.sponsor,
        "kit": team.kit,
        "tactics": team.tactics,
        "seasons_first_division": team.seasons_first_division,
        "last_ten_leagues_raw": team.last_ten_leagues,
        "historic_played": team.played,
        "historic_won": team.won,
        "historic_drawn": team.drawn,
        "historic_goals_for": team.goals_for,
        "historic_goals_against": team.goals_against,
        "historic_points": team.points,
        "times_champion": team.times_champion,
        "times_runner_up": team.times_runner_up,
        "squad_size": len(team.players),
        "coach_pointer": team.coach.pointer if team.coach else None,
        "coach_name": team.coach.long_name if team.coach else None,
        # Bytes cuyo significado NO se pudo determinar. Se publican en crudo
        # en lugar de inventarles un nombre.
        "unidentified_byte_after_country": team.unknown_after_country,
        "unidentified_bytes_after_founded": team.unknown_after_founded,
        "shirt_numbers_reliable": shirt_reliable,
        "source": "PC Apertura 98",
        "source_file": source_file,
        "source_offset": team.source_offset,
        "data_confidence": team.header_confidence,
        "chain_validated": team.chain_validated,
        "unparsed_trailing_bytes": team.unparsed_trailing_bytes,
        "notes": team.notes,
    }


def player_record(
    player: Player, team: Team, source_file: str, shirt_reliable: bool
) -> dict[str, Any]:
    roles = [r for r in player.roles if r]
    birth = None
    age = None
    if player.birth_date:
        y, m, d = (int(x) for x in player.birth_date.split("-"))
        birth = player.birth_date
        age = age_at(date(y, m, d), AGE_REFERENCE)

    texts = {k: (v if v not in ("x", "") else None) for k, v in player.texts.items()}

    return {
        "id": f"{team_id(team)}-{player.pointer}",
        "pcf_pointer": player.pointer,
        "team_id": team_id(team),
        "team_name": team.short_name,
        "short_name": player.short_name,
        "full_name": player.long_name,
        # --- DORSAL ---
        # Si esta en el archivo, en el byte inmediatamente posterior al
        # puntero. Pero en muchos equipos de divisiones menores el juego dejo
        # el campo sin poblar (todos 0 o todos 1), asi que se marca la
        # fiabilidad por equipo en lugar de presentar basura como dato.
        "shirt_number": player.shirt_number,
        "shirt_number_reliable": shirt_reliable,
        "dorsal_not_available_in_source": False,
        # --- POSICION ---
        "position_original": player.demarcacion,
        "position_normalized": POSITION_NORMALIZED.get(player.demarcacion or ""),
        "role_primary": roles[0] if roles else None,
        "roles": roles,
        "role_codes": player.role_codes,
        # --- MEDIA ---
        # No hay media almacenada. Se publica la derivada con la formula del
        # propio juego y se deja explicito que el original no existe.
        "overall": player.media,
        "overall_original": None,
        "overall_derived": player.media,
        "overall_formula": OVERALL_FORMULA_TEXT,
        "overall_not_stored_in_source": True,
        # --- ATRIBUTOS ---
        "attributes": dict(player.attributes),
        "raw_attributes": dict(player.attributes),
        "attributes_source": "original",
        "attributes_scale": "0-100 (observado 1-99 en este archivo)",
        "attributes_in_overall": list(MEDIA_FORMULA),
        # --- DATOS PERSONALES ---
        "birth_date": birth,
        "birth_date_raw": [player.birth_day, player.birth_month, player.birth_year],
        "age": age,
        "age_reference_date": AGE_REFERENCE.isoformat(),
        "age_not_stored_in_source": True,
        "nationality": COUNTRIES.get(player.nationality_code),
        "nationality_code": player.nationality_code,
        "birth_country": COUNTRIES.get(player.birth_country_code),
        "birth_country_code": player.birth_country_code,
        "birth_place": texts.get("lugar_nacimiento"),
        # --- ALTURA Y PESO ---
        # Los dos campos estan en el archivo, en centimetros y kilos, y para
        # los jugadores de Primera son medidas reales (Riquelme 185/76). Pero
        # el juego dejo VALORES CENTINELA donde no tenia el dato: altura 140
        # con peso 1, emparejados en 557 de 558 casos, mas unos pocos en 0.
        # Publicar 140 cm como si fuera una medicion seria inventar, asi que
        # el centinela sale como null y queda declarado.
        "height": height_or_none(player.height),
        "weight": weight_or_none(player.weight),
        "height_raw": player.height,
        "weight_raw": player.weight,
        "height_is_placeholder": height_or_none(player.height) is None,
        "weight_is_placeholder": weight_or_none(player.weight) is None,
        # --- LO QUE EL FORMATO NO GUARDA ---
        "preferred_foot": None,
        "preferred_foot_not_available_in_source": True,
        "market_value": None,
        "market_value_not_available_in_source": True,
        "salary": None,
        "salary_not_available_in_source": True,
        # --- CAMPOS PROPIOS DE PC FUTBOL QUE NO ESTABAN EN EL ESQUEMA ---
        "slot": player.slot,
        "procedencia_code": player.procedencia,
        "skin": SKIN.get(player.skin_code),
        "hair": HAIR.get(player.hair_code),
        "biography": texts,
        # --- PROCEDENCIA ---
        "source": "PC Apertura 98",
        "source_file": source_file,
        "source_offset": player.source_offset,
        "data_confidence": "original",
    }


def coach_record(team: Team, source_file: str) -> dict[str, Any] | None:
    if not team.coach:
        return None
    texts = {k: (v if v not in ("x", "") else None) for k, v in team.coach.texts.items()}
    return {
        "id": f"{team_id(team)}-dt-{team.coach.pointer}",
        "pcf_pointer": team.coach.pointer,
        "team_id": team_id(team),
        "team_name": team.short_name,
        "short_name": team.coach.short_name,
        "full_name": team.coach.long_name,
        "had_player_career": team.coach.had_player_career,
        "biography": texts,
        # El registro de entrenador no guarda ni fecha de nacimiento ni
        # nacionalidad ni contrato.
        "birth_date": None,
        "nationality": None,
        "birth_date_not_available_in_source": True,
        "nationality_not_available_in_source": True,
        "source": "PC Apertura 98",
        "source_file": source_file,
        "source_offset": team.coach.source_offset,
        "data_confidence": "original",
    }


def shirt_numbers_reliable(team: Team) -> bool:
    """Un equipo tiene dorsales utiles si no estan casi todos repetidos.

    En los equipos de divisiones menores el juego dejo el campo sin poblar y
    quedaron todos en 0 o en 1. Presentarlos como dorsales seria inventar.
    """
    numbers = [p.shirt_number for p in team.players]
    if not numbers:
        return False
    distinct = len(set(numbers))
    return distinct >= max(6, len(numbers) // 2)


# ---------------------------------------------------------------------------
# Seleccion de la Primera Division argentina
# ---------------------------------------------------------------------------


def primera_selection(teams: list[Team]) -> tuple[list[Team], list[Team], dict[str, Any]]:
    """Separa los equipos que el archivo trata como de Primera Division.

    ATENCION: el archivo NO guarda la division de la temporada en curso. La
    estructura de competiciones vive en MANAGARG.EXE, en offsets que el editor
    lleva hardcodeados y que no se extrajeron. Asi que esto es INFERENCIA, no
    dato, y se marca como tal.

    El criterio usa dos senales del propio archivo que coinciden:

    1. `budget_game_raw > 0`. Los clubes de division menor tienen presupuesto
       0 en el archivo.
    2. El historial de las ultimas diez ligas es propio y no la cadena
       repetida que comparten los clubes de division menor.

    Las dos juntas dan exactamente veinte equipos, que es el tamano del
    torneo. Los casos que cumplen una senal y no la otra se devuelven aparte
    en lugar de resolverlos por nuestra cuenta.
    """
    national = [t for t in teams if not t.is_foreign]
    histories = Counter(t.last_ten_leagues for t in national if t.last_ten_leagues)
    placeholder = histories.most_common(1)[0][0] if histories else None

    selected, borderline = [], []
    for t in national:
        own_history = t.last_ten_leagues != placeholder
        has_budget = bool(t.budget_game)
        # Los combinados (Estrellas, Juveniles) tienen presupuesto 1 y un
        # socio: no son clubes.
        is_squad_pick = (t.members or 0) <= 1
        if is_squad_pick:
            continue
        if own_history and has_budget:
            selected.append(t)
        elif own_history or has_budget:
            borderline.append(t)

    evidence = {
        "selection_method": "budget_game_raw > 0 AND historial de ligas propio",
        "confidence": "inferred",
        "why_not_original": (
            "El archivo de equipos no guarda la division de la temporada en curso. "
            "La estructura de competiciones esta en MANAGARG.EXE, en offsets que el "
            "editor lleva hardcodeados y que no se extrajeron en este trabajo."
        ),
        "placeholder_history": placeholder,
        "selected_count": len(selected),
        "borderline": [
            {
                "short_name": t.short_name,
                "budget_game_raw": t.budget_game,
                "own_history": t.last_ten_leagues != placeholder,
                "players_with_real_biography": sum(
                    1 for p in t.players if len(p.texts.get("caracteristicas", "")) > 100
                ),
            }
            for t in borderline
        ],
    }
    return selected, borderline, evidence


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------

CSV_COLUMNS = [
    "id", "pcf_pointer", "team_id", "team_name", "short_name", "full_name",
    "shirt_number", "shirt_number_reliable", "position_original",
    "position_normalized", "role_primary", "overall", "overall_derived",
    *[f"attr_{k}" for k in ATTRIBUTE_ORDER],
    "birth_date", "age", "nationality", "birth_country", "birth_place",
    "height", "weight", "preferred_foot", "market_value", "salary",
    "slot", "skin", "hair", "source_file", "source_offset", "data_confidence",
]


def write_csv(path: Path, players: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for p in players:
            row = dict(p)
            for k, v in p["attributes"].items():
                row[f"attr_{k}"] = v
            writer.writerow(row)


def write_sqlite(path: Path, teams, players, coaches) -> None:
    if path.exists():
        path.unlink()
    db = sqlite3.connect(path)
    db.executescript(
        """
        CREATE TABLE teams (
          id TEXT PRIMARY KEY, pcf_pointer INTEGER, short_name TEXT,
          long_name TEXT, country TEXT, stadium_name TEXT,
          stadium_capacity INTEGER, founded INTEGER, members INTEGER,
          president TEXT, sponsor TEXT, kit TEXT, squad_size INTEGER,
          coach_name TEXT, is_national_league INTEGER,
          shirt_numbers_reliable INTEGER, source_offset INTEGER,
          data_confidence TEXT
        );
        CREATE TABLE players (
          id TEXT PRIMARY KEY, pcf_pointer INTEGER, team_id TEXT, team_name TEXT,
          short_name TEXT, full_name TEXT, shirt_number INTEGER,
          shirt_number_reliable INTEGER, position_original TEXT,
          position_normalized TEXT, role_primary TEXT, overall INTEGER,
          velocidad INTEGER, resistencia INTEGER, agresividad INTEGER,
          calidad INTEGER, remate INTEGER, regate INTEGER, pase INTEGER,
          tiro INTEGER, entradas INTEGER, portero INTEGER,
          birth_date TEXT, age INTEGER, nationality TEXT, birth_place TEXT,
          height INTEGER, weight INTEGER, market_value INTEGER, salary INTEGER,
          preferred_foot TEXT, source_offset INTEGER, data_confidence TEXT,
          FOREIGN KEY (team_id) REFERENCES teams(id)
        );
        CREATE TABLE coaches (
          id TEXT PRIMARY KEY, pcf_pointer INTEGER, team_id TEXT,
          team_name TEXT, short_name TEXT, full_name TEXT,
          source_offset INTEGER, data_confidence TEXT
        );
        CREATE INDEX idx_players_team ON players(team_id);
        CREATE INDEX idx_players_overall ON players(overall DESC);
        CREATE INDEX idx_players_pos ON players(position_normalized);
        """
    )
    db.executemany(
        "INSERT INTO teams VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                t["id"], t["pcf_pointer"], t["short_name"], t["long_name"], t["country"],
                t["stadium_name"], t["stadium_capacity"], t["founded"], t["members"],
                t["president"], t["sponsor"], t["kit"], t["squad_size"], t["coach_name"],
                int(t["is_national_league"]), int(t["shirt_numbers_reliable"]),
                t["source_offset"], t["data_confidence"],
            )
            for t in teams
        ],
    )
    db.executemany(
        "INSERT INTO players VALUES (" + ",".join("?" * 33) + ")",
        [
            (
                p["id"], p["pcf_pointer"], p["team_id"], p["team_name"], p["short_name"],
                p["full_name"], p["shirt_number"], int(p["shirt_number_reliable"]),
                p["position_original"], p["position_normalized"], p["role_primary"],
                p["overall"],
                *[p["attributes"][k] for k in ATTRIBUTE_ORDER],
                p["birth_date"], p["age"], p["nationality"], p["birth_place"],
                p["height"], p["weight"], p["market_value"], p["salary"],
                p["preferred_foot"], p["source_offset"], p["data_confidence"],
            )
            for p in players
        ],
    )
    db.executemany(
        "INSERT INTO coaches VALUES (?,?,?,?,?,?,?,?)",
        [
            (
                c["id"], c["pcf_pointer"], c["team_id"], c["team_name"],
                c["short_name"], c["full_name"], c["source_offset"], c["data_confidence"],
            )
            for c in coaches
        ],
    )
    db.commit()
    db.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="archivo .PKF/.DBC o directorio con varios")
    ap.add_argument("--output", required=True, help="directorio de salida")
    ap.add_argument("--sqlite", action="store_true", help="generar tambien database.sqlite")
    ap.add_argument("--include-foreign", action="store_true",
                    help="incluir los equipos de liga extranjera (sin plantel en el formato)")
    args = ap.parse_args()

    src = Path(args.input)
    files = []
    if src.is_dir():
        for pattern in ("*.PKF", "*.pkf", "*.DBC", "*.dbc"):
            files.extend(sorted(src.glob(pattern)))
    else:
        files = [src]
    if not files:
        print(f"No hay archivos .PKF ni .DBC en {src}", file=sys.stderr)
        return 1

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    all_teams: list[dict[str, Any]] = []
    all_players: list[dict[str, Any]] = []
    all_coaches: list[dict[str, Any]] = []
    parsed: list[Team] = []

    for path in files:
        data = path.read_bytes()
        teams = parse_file(data)
        print(f"{path.name}: {len(teams)} equipos "
              f"({sum(1 for t in teams if not t.is_foreign)} de liga nacional)")
        for team in teams:
            if team.is_foreign and not args.include_foreign:
                continue
            parsed.append(team)
            reliable = shirt_numbers_reliable(team)
            all_teams.append(team_record(team, path.name, reliable))
            for p in team.players:
                all_players.append(player_record(p, team, path.name, reliable))
            rec = coach_record(team, path.name)
            if rec:
                all_coaches.append(rec)

    # El README del editor dice que el puntero de jugador no se repite dentro
    # de un equipo. Se cumple en 1317 de 1318 casos: el combinado "Juveniles
    # ARGENTINA", que no es un club, tiene dos jugadores con puntero 0. Se
    # desambigua con el offset y se deja anotado en el registro, porque es una
    # anomalia del archivo y no del parseo.
    seen: dict[str, int] = {}
    for p in all_players:
        if p["id"] in seen:
            p["id"] = f"{p['id']}-off{p['source_offset']}"
            p["duplicate_pointer_in_team"] = True
        else:
            seen[p["id"]] = p["source_offset"]
            p["duplicate_pointer_in_team"] = False

    selected, _borderline, evidence = primera_selection(parsed)
    sel_ids = {team_id(t) for t in selected}
    primera = {
        "competition": "Primera Division de Argentina",
        "season": "1998",
        "source": "PC Apertura 98 / PC Apertura 6.0",
        "source_file": files[0].name,
        "division_assignment": evidence,
        "teams": [
            {
                **t,
                "squad": [p for p in all_players if p["team_id"] == t["id"]],
            }
            for t in all_teams
            if t["id"] in sel_ids
        ],
    }

    def dump(name: str, payload: Any) -> None:
        p = out / name
        p.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {p}  ({p.stat().st_size // 1024} kB)")

    dump("teams.json", all_teams)
    dump("players.json", all_players)
    dump("coaches.json", all_coaches)
    dump("argentina_primera.json", primera)
    write_csv(out / "players.csv", all_players)
    print(f"  {out / 'players.csv'}")
    if args.sqlite:
        write_sqlite(out / "database.sqlite", all_teams, all_players, all_coaches)
        print(f"  {out / 'database.sqlite'}")

    print(f"\n{len(all_teams)} equipos, {len(all_players)} jugadores, "
          f"{len(all_coaches)} entrenadores.")
    print(f"Primera Division inferida: {len(selected)} equipos "
          f"({len(evidence['borderline'])} casos limitrofes declarados).")
    print(f"Tabla de caracteres: {len(HEX_TO_CHAR)} entradas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
