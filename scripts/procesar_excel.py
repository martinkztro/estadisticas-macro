import sys
import json
import pandas as pd
from datetime import timedelta


# ---------------------------------------------------------
# PARÁMETROS DESDE LA LÍNEA DE COMANDO
# ---------------------------------------------------------
def parse_args():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing args"}), file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    lanes_ns = sys.argv[2] if len(sys.argv) > 2 else ""
    lanes_sn = sys.argv[3] if len(sys.argv) > 3 else ""
    intervals_arg = sys.argv[4] if len(sys.argv) > 4 else ""
    write_xlsx = "--write-xlsx" in sys.argv
    auto_mode = "--auto" in sys.argv
    hours = 1
    for i, arg in enumerate(sys.argv):
        if arg == "--hours" and i + 1 < len(sys.argv):
            try:
                hours = int(sys.argv[i + 1])
            except:
                pass
    return input_path, lanes_ns, lanes_sn, intervals_arg, write_xlsx, auto_mode, hours


# ---------------------------------------------------------
# FUNCIÓN PARA DIVIDIR INTERVALOS MANUALMENTE
# ---------------------------------------------------------
def parse_intervals(intervals_arg):
    intervals = []
    if intervals_arg:
        parts = [p.strip() for p in intervals_arg.split(",") if p.strip()]
        for p in parts:
            if "-" in p:
                a, b = p.split("-", 1)
                intervals.append((a.strip(), b.strip()))
    return intervals


# ---------------------------------------------------------
# CÁLCULO DE INTERVALOS DE MÁXIMA DEMANDA (AUTOMÁTICO)
# ---------------------------------------------------------
def top_interval_in_range(series_15m, start_h, end_h, window_len):
    """Encuentra el intervalo con mayor volumen dentro de una franja fija."""
    if len(series_15m) == 0:
        return None

    subset = series_15m.between_time(f"{start_h:02d}:00", f"{end_h:02d}:59")
    if subset.empty:
        return None

    roll = subset.rolling(window=window_len, min_periods=window_len).sum()
    if roll.empty or roll.isna().all():
        return None

    max_idx = roll.idxmax()
    max_val = roll.max()

    ini = max_idx - timedelta(minutes=15 * (window_len - 1))
    fin = max_idx + timedelta(minutes=15)
    return ini, fin, int(max_val)


# ---------------------------------------------------------
# AGRUPAR CLASES Y NORMALIZAR TIEMPOS
# ---------------------------------------------------------
def ensure_15min_index(df_day):
    """Agrupa por carril y 15 min, sumando clases (sin duplicar)."""
    day = df_day["Time"].dt.date.iloc[0]
    df_day["slot"] = df_day["Time"].dt.floor("15min")

    df_grouped = df_day.groupby(["slot", "Lane"])["#vehicles"].sum().reset_index()
    s = df_grouped.groupby("slot")["#vehicles"].sum()
    full_index = pd.date_range(f"{day} 00:00", f"{day} 23:45", freq="15min")
    return s.reindex(full_index, fill_value=0)


# ---------------------------------------------------------
# PROCESAMIENTO PRINCIPAL
# ---------------------------------------------------------
def main():
    input_path, lanes_ns, lanes_sn, intervals_arg, write_xlsx, auto_mode, hours = parse_args()

    try:
        df = pd.read_csv(input_path, sep=None, engine="python")
    except Exception:
        df = pd.read_excel(input_path)

    df.columns = df.columns.str.strip()
    df["Time"] = pd.to_datetime(df["Time"], errors="coerce", dayfirst=True)
    df.dropna(subset=["Time"], inplace=True)
    df["Fecha"] = df["Time"].dt.date

    resultados = []
    intervalos = parse_intervals(intervals_arg)

    def procesa(nombre, lanes_sel):
        if not lanes_sel:
            return
        sel = [int(x) for x in lanes_sel.split(",") if x.strip().isdigit()]
        subset = df[df["Lane"].isin(sel)]

        for fecha, grupo in subset.groupby("Fecha"):
            s = ensure_15min_index(grupo)

            if auto_mode:
                window_len = hours * 4
                rangos = [
                    ("Mañana", 0, 11),
                    ("Tarde", 12, 16),
                    ("Noche", 17, 23),
                ]
                for etiqueta, h_ini, h_fin in rangos:
                    result = top_interval_in_range(s, h_ini, h_fin, window_len)
                    if result:
                        ini, fin, total = result
                        resultados.append({
                            "Fecha": str(fecha),
                            "Dirección": nombre,
                            "Etiqueta": etiqueta,
                            "Intervalo": f"{ini.strftime('%H:%M')} - {fin.strftime('%H:%M')}",
                            "Carriles": ",".join(map(str, sel)),
                            "Duración (h)": hours,
                            "Total_vehiculos": int(total),
                        })

            else:
                # MODO MANUAL
                for intervalo in intervalos:
                    inicio, fin = intervalo
                    try:
                        inicio_hora = pd.to_datetime(str(fecha) + " " + inicio)
                        fin_hora = pd.to_datetime(str(fecha) + " " + fin)
                    except Exception:
                        continue

                    subset_intervalo = grupo[
                        (grupo["Time"] >= inicio_hora) & (grupo["Time"] < fin_hora)
                    ]

                    total = int(subset_intervalo["#vehicles"].sum())
                    resultados.append({
                        "Fecha": str(fecha),
                        "Dirección": nombre,
                        "Etiqueta": "Manual",
                        "Intervalo": f"{inicio} - {fin}",
                        "Carriles": ",".join(map(str, sel)),
                        "Total_vehiculos": total,
                    })

    procesa("Norte→Sur", lanes_ns)
    procesa("Sur→Norte", lanes_sn)

    if write_xlsx:
        pd.DataFrame(resultados).to_excel("resumen_intervalos.xlsx", index=False)

    print(json.dumps(resultados, ensure_ascii=False))


if __name__ == "__main__":
    main()
