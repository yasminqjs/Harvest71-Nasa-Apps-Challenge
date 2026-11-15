"""Converte os dados essenciais coletados em arquivos de entrada do DSSAT.

- NASA POWER (JSON diário, comunidade AG)  -> arquivos .WTH (um por ano)
- PronaSolos 90 m (Embrapa/SGB; CSV propriedade/profundidade/valor) -> perfil .SOL
- Cenários de milho (janelas de plantio, sequeiro x irrigação automática) -> FileX .MZX

Cada valor escrito é rastreável: `provenance` registra a origem e o método de cada
parâmetro, separando o que é DADO (NASA POWER / PronaSolos), DERIVADO (fórmula documentada) e
SUPOSIÇÃO (escolha de cenário, a validar).
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

# ----------------------------------------------------------------------------- clima

POWER_TO_DSSAT = {  # variável DSSAT: (parâmetro POWER, conversão)
    "SRAD": ("ALLSKY_SFC_SW_DWN", lambda v: v),   # MJ/m²/dia (comunidade AG)
    "TMAX": ("T2M_MAX", lambda v: v),             # °C
    "TMIN": ("T2M_MIN", lambda v: v),             # °C
    "RAIN": ("PRECTOTCORR", lambda v: v),         # mm/dia
    "DEWP": ("T2MDEW", lambda v: v),              # °C
    "WIND": ("WS2M", lambda v: v * 86.4),         # m/s -> km/dia
    "RHUM": ("RH2M", lambda v: v),                # %
}
REQUIRED_WEATHER = ("SRAD", "TMAX", "TMIN", "RAIN")


@dataclass
class Weather:
    lat: float
    lon: float
    elev: float
    days: dict[date, dict[str, float | None]]
    filled: dict[str, int] = field(default_factory=dict)


def read_power_json(path: Path) -> Weather:
    doc = json.loads(Path(path).read_text())
    lon, lat, elev = doc["geometry"]["coordinates"][:3]
    fill = float(doc.get("header", {}).get("fill_value", -999))
    params = doc["properties"]["parameter"]
    days: dict[date, dict[str, float | None]] = defaultdict(dict)
    for var, (pname, conv) in POWER_TO_DSSAT.items():
        for k, v in params.get(pname, {}).items():
            d = datetime.strptime(k, "%Y%m%d").date()
            days[d][var] = None if v is None or float(v) <= fill + 1e-6 else conv(float(v))
    w = Weather(lat=float(lat), lon=float(lon), elev=float(elev), days=dict(sorted(days.items())))
    _fill_gaps(w)
    return w


def _fill_gaps(w: Weather) -> None:
    """Interpolação linear de falhas curtas (≤ 5 dias) em SRAD/TMAX/TMIN; chuva ausente = falha.

    Falhas longas ou chuva ausente removem o dia; o recorte final para no último dia completo.
    """
    dates = list(w.days)
    for var in ("SRAD", "TMAX", "TMIN", "DEWP", "RHUM", "WIND"):
        n = 0
        i = 0
        while i < len(dates):
            if w.days[dates[i]].get(var) is None:
                j = i
                while j < len(dates) and w.days[dates[j]].get(var) is None:
                    j += 1
                if 0 < i and j < len(dates) and (j - i) <= 5:
                    a, b = w.days[dates[i - 1]][var], w.days[dates[j]][var]
                    for k in range(i, j):
                        w.days[dates[k]][var] = a + (b - a) * (k - i + 1) / (j - i + 1)
                        n += 1
                i = j
            else:
                i += 1
        w.filled[var] = n
    complete = [d for d in dates if all(w.days[d].get(v) is not None for v in REQUIRED_WEATHER)]
    if not complete:
        raise ValueError("nenhum dia completo de clima")
    last = complete[-1]
    w.days = {d: v for d, v in w.days.items() if d <= last}
    missing = [d for d in w.days if any(w.days[d].get(v) is None for v in REQUIRED_WEATHER)]
    if missing:
        raise ValueError(f"{len(missing)} dias com SRAD/TMAX/TMIN/RAIN ausentes (ex.: {missing[0]})")


def tav_amp(w: Weather) -> tuple[float, float]:
    """TAV: média anual de longo prazo; AMP: amplitude (máx − mín) das médias mensais (WEATHER.CDE)."""
    by_month: dict[int, list[float]] = defaultdict(list)
    for d, v in w.days.items():
        by_month[d.month].append((v["TMAX"] + v["TMIN"]) / 2)
    means = [sum(x) / len(x) for x in by_month.values()]
    return sum(means) / len(means), max(means) - min(means)


def write_wth_files(w: Weather, insi: str, outdir: Path, title: str) -> list[str]:
    """Um arquivo por ano: <INSI><AA>01.WTH (convenção DSSAT), datas AADDD (o leitor rejeita AAAADDD aqui)."""
    outdir.mkdir(parents=True, exist_ok=True)
    tav, amp = tav_amp(w)
    by_year: dict[int, list[date]] = defaultdict(list)
    for d in w.days:
        by_year[d.year].append(d)
    names = []
    for year, ds in sorted(by_year.items()):
        name = f"{insi}{year % 100:02d}01.WTH"
        lines = [
            f"*WEATHER DATA : {title}",
            "",
            "@ INSI      LAT     LONG  ELEV   TAV   AMP REFHT WNDHT",
            f"  {insi:4s} {w.lat:8.3f} {w.lon:8.3f} {w.elev:5.0f} {tav:5.1f} {amp:5.1f}   2.0   2.0",
            "@DATE  SRAD  TMAX  TMIN  RAIN  DEWP  WIND  RHUM",
        ]
        for d in ds:
            v = w.days[d]
            lines.append(
                f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"
                f"{_f(v['SRAD'], 6, 1)}{_f(v['TMAX'], 6, 1)}{_f(v['TMIN'], 6, 1)}{_f(v['RAIN'], 6, 1)}"
                f"{_f(v.get('DEWP'), 6, 1)}{_f(v.get('WIND'), 6, 0)}{_f(v.get('RHUM'), 6, 1)}"
            )
        (outdir / name).write_text("\n".join(lines) + "\n")
        names.append(name)
    return names


def _f(v: float | None, width: int, dec: int) -> str:
    if v is None:
        return f"{-99:>{width}}"
    return f"{v:{width}.{dec}f}"


# ----------------------------------------------------------------------------- solo
# Fonte: PronaSolos (Embrapa / Serviço Geológico do Brasil), atributos a 90 m.
# Não fornece densidade nem retenção de água: derivadas por Saxton & Rawls (2006, USDA-ARS).

PS_DEPTHS = [("0-5cm", 5), ("5-15cm", 15), ("15-30cm", 30), ("30-60cm", 60), ("60-100cm", 100), ("100-200cm", 200)]


def read_pronasolos_csv(path: Path) -> dict[str, dict[str, float]]:
    return read_pronasolos_csv_text(Path(path).read_text())


def read_pronasolos_csv_text(text: str) -> dict[str, dict[str, float]]:
    """-> {profundidade: {propriedade: valor}} nas unidades do PronaSolos (g/kg, cmolc/kg, pH, dS/m)."""
    out: dict[str, dict[str, float]] = defaultdict(dict)
    for line in text.splitlines()[1:]:
        parts = line.strip().split(",")
        if len(parts) != 3:
            continue
        prop, depth, val = parts
        try:
            x = float(val)
        except ValueError:
            continue
        if x < 0:
            continue
        out[depth][prop] = x
    return dict(out)


def saxton_rawls(sand: float, clay: float, om: float) -> tuple[float, float, float]:
    """Saxton & Rawls (2006): θ1500, θ33, θS a partir de areia/argila (fração) e MO (%)."""
    S, C, OM = sand, clay, om
    t1500t = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
    t1500 = t1500t + (0.14 * t1500t - 0.02)
    t33t = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
    t33 = t33t + (1.283 * t33t ** 2 - 0.374 * t33t - 0.015)
    ts33t = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078
    ts33 = ts33t + (0.636 * ts33t - 0.107)
    tS = t33 + ts33 - 0.097 * S + 0.043
    return t1500, t33, tS


def ksat_cm_h(ll: float, dul: float, sat: float) -> float:
    """Saxton & Rawls (2006): Ks = 1930 (θS − θ33)^(3−λ) mm/h, λ = 1/B."""
    if not (0 < ll < dul < sat):
        return -99.0
    B = (math.log(1500) - math.log(33)) / (math.log(dul) - math.log(ll))
    lam = 1 / B
    return 1930 * (sat - dul) ** (3 - lam) / 10.0


def texture_code(sand: float, silt: float, clay: float) -> str:
    """Classe textural USDA (porcentagens) no código usado pelo DSSAT."""
    if clay >= 40:
        return "SIC" if silt >= 40 else ("C" if sand <= 45 else "SC")
    if clay >= 35 and sand > 45:
        return "SC"
    if clay >= 27:
        return "SICL" if sand <= 20 else ("CL" if sand <= 45 else "SCL")
    if clay >= 20 and sand > 45 and silt < 28:
        return "SCL"
    if silt >= 80 and clay < 12:
        return "SI"
    if silt >= 50:
        return "SIL"
    if sand >= 85 and silt + 1.5 * clay < 15:
        return "S"
    if sand >= 70 and silt + 2 * clay < 30:
        return "LS"
    if (clay < 7 and silt < 50 and sand > 43) or (clay < 20 and sand > 52):
        return "SL"
    return "L"


@dataclass
class SoilProfile:
    soil_id: str
    text: str
    layers: list[dict]
    provenance: dict[str, str]
    warnings: list[str]


# Superfície e outros parâmetros que nenhuma fonte coletada fornece: SUPOSIÇÕES explícitas.
SURFACE_DEFAULTS = {"SALB": 0.13, "SLU1": 6.0, "SLDR": 0.50, "SLRO": 75.0, "SLNF": 1.0, "SLPF": 1.0}


def build_soil(ps: dict[str, dict[str, float]], soil_id: str) -> SoilProfile:
    prov = {
        "SLB": "DADO: profundidades do PronaSolos (5,15,30,60,100,200 cm)",
        "SLCL/SLSI": "DADO: PronaSolos argila/silte (g/kg ÷ 10 = %)",
        "SLOC": "DADO: PronaSolos carbono orgânico (g/kg ÷ 10 = %)",
        "SLHW": "DADO: PronaSolos pH em água",
        "SCEC": "DADO: PronaSolos CTC (cmolc/kg)",
        "SLLL/SDUL/SSAT": "DERIVADO: Saxton & Rawls 2006 (areia, argila, MO = 1,724 × C orgânico)",
        "SBDM": "DERIVADO: densidade normal de Saxton & Rawls 2006, (1 − θS) × 2,65",
        "SSKS": "DERIVADO: Saxton & Rawls 2006",
        "SRGF": "DERIVADO: 1,0 até 15 cm, depois exp(−0,02 × profundidade média)",
        "SLNI/SLCF": "AUSENTE: PronaSolos não fornece N total nem cascalho (-99; N não é simulado)",
        "superficie": "SUPOSIÇÃO: SALB 0,13; SLU1 6; SLDR 0,50; SLRO 75; SLNF 1; SLPF 1 (sem dado local)",
    }
    warnings = []
    layers = []
    for dname, slb in PS_DEPTHS:
        v = ps.get(dname)
        if not v or not all(k in v for k in ("areia_g_kg", "argila_g_kg")):
            warnings.append(f"camada {dname}: textura ausente; perfil truncado")
            break
        sand, clay = v["areia_g_kg"] / 10, v["argila_g_kg"] / 10
        silt = v["silte_g_kg"] / 10 if "silte_g_kg" in v else max(0.0, 100 - sand - clay)
        oc = v.get("carbono_organico_g_kg", 0.0) / 10      # % C orgânico
        om = min(oc * 1.724, 8.0)                           # fórmula calibrada até 8 % de MO
        if oc * 1.724 > 8:
            warnings.append(f"camada {dname}: MO > 8 %, fora da faixa de Saxton & Rawls")
        ll, dul, sat = saxton_rawls(sand / 100, clay / 100, om)
        if not (0 < ll < dul < sat < 1):
            warnings.append(f"camada {dname}: retenção inconsistente ({ll:.3f}/{dul:.3f}/{sat:.3f}); ajustada")
            ll = max(ll, 0.01); dul = max(dul, ll + 0.02); sat = max(sat, dul + 0.03)
        bd = (1 - sat) * 2.65
        if v.get("ce_ds_m", 0) > 4:
            warnings.append(f"camada {dname}: salinidade alta (CE {v['ce_ds_m']} dS/m) não representada pelo DSSAT")
        top = 0 if not layers else layers[-1]["SLB"]
        mid = (top + slb) / 2
        layers.append({
            "SLB": slb, "SLLL": ll, "SDUL": dul, "SSAT": sat,
            "SRGF": 1.0 if mid <= 15 else math.exp(-0.02 * mid),
            "SSKS": ksat_cm_h(ll, dul, sat), "SBDM": bd, "SLOC": oc,
            "SLCL": clay, "SLSI": silt, "SLCF": -99, "SLNI": -99,
            "SLHW": v.get("ph_agua", -99), "SCEC": v.get("ctc_cmolc_kg", -99),
            "_sand": sand, "_ec": v.get("ce_ds_m"),
        })
    if not layers:
        raise ValueError("PronaSolos sem camadas utilizáveis")
    top = layers[0]
    tx = texture_code(top["_sand"], top["SLSI"], top["SLCL"])
    return SoilProfile(soil_id=soil_id, text=tx, layers=layers, provenance=prov, warnings=warnings)


def write_sol(p: SoilProfile, path: Path, site: str, lat: float, lon: float) -> None:
    s = SURFACE_DEFAULTS
    depth = p.layers[-1]["SLB"]
    lines = [
        "*SOILS: Field Shift - perfis estimados (PronaSolos 90 m, Embrapa/SGB; agua por Saxton & Rawls 2006)",
        "",
        f"*{p.soil_id:<10}  PronaSolos  {p.text:<5}{depth:5d} ESTIMATIVA REGIONAL 90M - NAO E ANALISE LOCAL",
        "@SITE        COUNTRY          LAT     LONG SCS FAMILY",
        f" {site[:11]:<11} {'BRAZIL':<11} {lat:8.3f} {lon:8.3f} -99",
        "@ SCOM  SALB  SLU1  SLDR  SLRO  SLNF  SLPF  SMHB  SMPX  SMKE",
        f"{'-99':>6}{s['SALB']:6.2f}{s['SLU1']:6.1f}{s['SLDR']:6.2f}{s['SLRO']:6.1f}{s['SLNF']:6.2f}{s['SLPF']:6.2f}"
        f"{'IB001':>6}{'IB001':>6}{'IB001':>6}",
        "@  SLB  SLMH  SLLL  SDUL  SSAT  SRGF  SSKS  SBDM  SLOC  SLCL  SLSI  SLCF  SLNI  SLHW  SLHB  SCEC  SADC",
    ]
    for L in p.layers:
        lines.append(
            f"{L['SLB']:6d}{'-99':>6}{L['SLLL']:6.3f}{L['SDUL']:6.3f}{L['SSAT']:6.3f}{L['SRGF']:6.3f}"
            f"{_n(L['SSKS'], 2)}{L['SBDM']:6.2f}{L['SLOC']:6.2f}{L['SLCL']:6.1f}{L['SLSI']:6.1f}"
            f"{_n(L['SLCF'], 1)}{_n(L['SLNI'], 3)}{_n(L['SLHW'], 1)}{'-99':>6}{_n(L['SCEC'], 1)}{'-99':>6}"
        )
    path.write_text("\n".join(lines) + "\n\n")


def _n(v: float, dec: int) -> str:
    return f"{-99:>6}" if v is None or v == -99 else f"{v:6.{dec}f}"


# ----------------------------------------------------------------------------- cenários

# SUPOSIÇÕES DE CENÁRIO (não são dados): devem ser revistas com o zoneamento agrícola (ZARC)
# e com a prática local. Janelas = início da estação chuvosa típica de cada local.
CULTIVAR = ("IB0171", "AG9010")  # híbrido brasileiro da biblioteca DSSAT (calibrado em Piracicaba-SP)
PLANTING = {"PPOP": 5.0, "PPOE": 5.0, "PLRS": 80, "PLDP": 5}  # plantas/m², espaçamento cm, profundidade cm
WINDOWS = {
    "JUAZ": [(11, 15), (12, 15), (1, 15)],
    "IREC": [(11, 15), (12, 15), (1, 15)],
    "QUIX": [(2, 1), (3, 1), (4, 1)],
    "CGPB": [(4, 1), (5, 1), (6, 1)],
    "CRUZ": [(4, 1), (5, 1), (6, 1)],
}
DEFAULT_WINDOWS = [(1, 15), (3, 1), (4, 15)]


@dataclass
class Scenario:
    trno: int
    name: str
    planting: date
    irrigated: bool


def scenarios_for(site: str, first_year: int) -> list[Scenario]:
    wins = WINDOWS.get(site, DEFAULT_WINDOWS)
    out = []
    for i, (m, d) in enumerate(wins, start=1):
        out.append(Scenario(i, f"Janela {i} {d:02d}/{m:02d} sequeiro", date(first_year, m, d), False))
    m, d = wins[1]
    out.append(Scenario(len(wins) + 1, f"Janela 2 {d:02d}/{m:02d} irrigado auto", date(first_year, m, d), True))
    return out


def _yyddd(d: date) -> str:
    return f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"


def write_filex(path: Path, site: str, title: str, soil: SoilProfile, scen: list[Scenario],
                n_years: int, init_frac: float = 0.25) -> None:
    """FileX de milho (CERES-Maize), análise sazonal: NYERS anos, reinício a cada ano."""
    L = []
    L.append(f"*EXP.DETAILS: {path.stem[:8]}MZ FIELD SHIFT {title.upper()[:40]}")
    L += ["", "*GENERAL", "@PEOPLE", "Field Shift (NASA Space Apps 2026) - gerado automaticamente",
          "@SITE", title, "@NOTES",
          " Clima: NASA POWER diario (AG). Solo: PronaSolos 90 m (estimativa). Cultivar, janelas,",
          " densidade e condicao inicial sao SUPOSICOES de cenario. N nao simulado (sem limitacao).",
          " Uso: comparacao relativa entre cenarios; nao e previsao de produtividade.", ""]
    L.append("*TREATMENTS                        -------------FACTOR LEVELS------------")
    L.append("@N R O C TNAME.................... CU FL SA IC MP MI MF MR MC MT ME MH SM")
    for s in scen:
        L.append(f"{s.trno:2d} 1 0 0 {s.name[:25]:<25} 1  1  0 {s.trno:2d} {s.trno:2d}  0  0  0  0  0  0  0 {s.trno:2d}")
    L += ["", "*CULTIVARS", "@C CR INGENO CNAME", f" 1 MZ {CULTIVAR[0]} {CULTIVAR[1]}", ""]
    L += ["*FIELDS",
          "@L ID_FIELD WSTA....  FLSA  FLOB  FLDT  FLDD  FLDS  FLST SLTX  SLDP  ID_SOIL    FLNAME",
          f" 1 {site}0001 {site}       -99     0 DR000     0     0 00000 {soil.text:<5}{soil.layers[-1]['SLB']:5d}  {soil.soil_id} {site}",
          ""]
    L.append("*INITIAL CONDITIONS")
    for s in scen:
        start = s.planting - timedelta(days=30)
        L.append("@C   PCR ICDAT  ICRT  ICND  ICRN  ICRE  ICWD ICRES ICREN ICREP ICRIP ICRID ICNAME")
        L.append(f"{s.trno:2d}    MZ {_yyddd(start)}   -99   -99     1     1   -99     0   -99   -99   -99   -99 inicio")
        L.append("@C  ICBL  SH2O  SNH4  SNO3")
        for lay in soil.layers:
            sh2o = lay["SLLL"] + init_frac * (lay["SDUL"] - lay["SLLL"])
            L.append(f"{s.trno:2d} {lay['SLB']:5d} {sh2o:5.3f}   0.5   3.0")
    L.append("")
    L.append("*PLANTING DETAILS")
    L.append("@P PDATE EDATE  PPOP  PPOE  PLME  PLDS  PLRS  PLRD  PLDP  PLWT  PAGE  PENV  PLPH  SPRL                        PLNAME")
    for s in scen:
        L.append(f"{s.trno:2d} {_yyddd(s.planting)}   -99 {PLANTING['PPOP']:5.1f} {PLANTING['PPOE']:5.1f}     S     R"
                 f" {PLANTING['PLRS']:5d}     0 {PLANTING['PLDP']:5d}   -99   -99   -99   -99     0                        -99")
    L.append("")
    L.append("*SIMULATION CONTROLS")
    for s in scen:
        start = s.planting - timedelta(days=30)
        irr = "A" if s.irrigated else "N"
        L += [
            "@N GENERAL     NYERS NREPS START SDATE RSEED SNAME.................... SMODEL",
            f"{s.trno:2d} GE          {n_years:5d}     1     S {_yyddd(start)}  2150 {s.name[:25]:<25}",
            "@N OPTIONS     WATER NITRO SYMBI PHOSP POTAS DISES  CHEM  TILL   CO2",
            f"{s.trno:2d} OP              Y     N     N     N     N     N     N     N     M",
            "@N METHODS     WTHER INCON LIGHT EVAPO INFIL PHOTO HYDRO NSWIT MESOM MESEV MESOL",
            f"{s.trno:2d} ME              M     M     E     R     S     R     R     1     G     R     2",
            "@N MANAGEMENT  PLANT IRRIG FERTI RESID HARVS",
            f"{s.trno:2d} MA              R     {irr}     N     N     M",
            "@N OUTPUTS     FNAME OVVEW SUMRY FROPT GROUT CAOUT WAOUT NIOUT MIOUT DIOUT VBOSE CHOUT OPOUT FMOPT",
            f"{s.trno:2d} OU              N     N     Y     1     N     N     N     N     N     N     0     N     N     A",
            "",
            "@  AUTOMATIC MANAGEMENT",
            "@N PLANTING    PFRST PLAST PH2OL PH2OU PH2OD PSTMX PSTMN",
            f"{s.trno:2d} PL          {_yyddd(s.planting)} {_yyddd(s.planting)}    40   100    30    40    10",
            "@N IRRIGATION  IMDEP ITHRL ITHRU IROFF IMETH IRAMT IREFF",
            f"{s.trno:2d} IR             30    50   100 GS000 IR001    10  0.75",
            "@N NITROGEN    NMDEP NMTHR NAMNT NCODE NAOFF",
            f"{s.trno:2d} NI             30    50    25 FE001 GS000",
            "@N RESIDUES    RIPCN RTIME RIDEP",
            f"{s.trno:2d} RE            100     1    20",
            "@N HARVEST     HFRST HLAST HPCNP HPCNR",
            f"{s.trno:2d} HA              0   -99   100     0",
            "",
        ]
    path.write_text("\n".join(L) + "\n")


ASSUMPTIONS = {
    "cultivar": f"{CULTIVAR[1]} ({CULTIVAR[0]}), híbrido calibrado em Piracicaba-SP; não calibrado no Nordeste",
    "janelas_plantio": "início típico da estação chuvosa de cada local; validar com o ZARC (MAPA)",
    "densidade_plantio": f"{PLANTING['PPOP']} plantas/m², espaçamento {PLANTING['PLRS']} cm, profundidade {PLANTING['PLDP']} cm",
    "condicao_inicial": "água do solo a 25% da água disponível 30 dias antes do plantio; N mineral baixo",
    "nitrogenio": "não simulado (NITRO=N): resultado é limitado por clima, água e solo, não por adubação",
    "irrigacao_auto": "irrigação automática a 50% da água disponível em 30 cm, eficiência 0,75 (teto hídrico)",
    "superficie_solo": "albedo, drenagem e curva de escoamento padrão (sem dado local)",
    "fontes_excluidas": "nenhuma fonte, autor ou dado de origem chinesa (política da equipe)",
}


# ----------------------------------------------------------------------------- orquestração

def build_site(site: str, title: str, power_json: Path, soil_csv: Path, outdir: Path) -> dict:
    """Gera .WTH, .SOL e .MZX de um local. Devolve metadados de proveniência."""
    outdir.mkdir(parents=True, exist_ok=True)
    w = read_power_json(power_json)
    wth = write_wth_files(w, site, outdir, f"{title} - NASA POWER diario (AG)")
    first = min(w.days).year + 1                    # margem para o início 30 dias antes do plantio
    last_planting_year = max(w.days).year - 1       # garante que a última safra termine dentro dos dados
    n_years = last_planting_year - first + 1
    if n_years < 1:
        raise ValueError("série de clima curta demais para uma safra completa")
    soil = build_soil(read_pronasolos_csv(soil_csv), soil_id=f"FS{site}0001")
    write_sol(soil, outdir / "FS.SOL", title, w.lat, w.lon)
    scen = scenarios_for(site, first)
    filex = outdir / f"{site}0001.MZX"
    write_filex(filex, site, title, soil, scen, n_years)
    tav, amp = tav_amp(w)
    return {
        "site": site, "title": title, "lat": w.lat, "lon": w.lon, "elev_m": w.elev,
        "filex": filex.name, "weather_files": len(wth),
        "weather_period": [min(w.days).isoformat(), max(w.days).isoformat()],
        "weather_gap_filled_days": w.filled, "tav_c": round(tav, 2), "amp_c": round(amp, 2),
        "seasons": {"first_planting_year": first, "n_years": n_years},
        "scenarios": [{"trno": s.trno, "name": s.name, "planting_mm_dd": s.planting.strftime("%m-%d"),
                       "irrigated": s.irrigated} for s in scen],
        "soil": {"id": soil.soil_id, "texture_top": soil.text, "depth_cm": soil.layers[-1]["SLB"],
                 "layers": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in L.items()
                             if not k.startswith("_")} | {"CE_dS_m": L.get("_ec")} for L in soil.layers],
                 "warnings": soil.warnings},
        "provenance": {
            "weather": "DADO: NASA POWER (SRAD, TMAX, TMIN, RAIN, DEWP, WIND, RHUM); WIND m/s×86,4 = km/dia",
            "soil": soil.provenance,
        },
        "assumptions": ASSUMPTIONS,
    }
