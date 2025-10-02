import sys
import json
import pandas as pd
from datetime import datetime


def parse_args():
    # Expect: script.py input_path lanes intervals
    # lanes: "1,2"
    # intervals: "09:00-11:00,12:15-14:15"
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing args"}), file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    lanes_arg = sys.argv[2] if len(sys.argv) > 2 else ""
    intervals_arg = sys.argv[3] if len(sys.argv) > 3 else ""

    # parse lanes
    if lanes_arg:
        try:
            lanes = [int(x.strip()) for x in lanes_arg.split(",") if x.strip()]
        except Exception:
            lanes = []
    else:
        lanes = []

    # parse intervals
    intervals = []
    if intervals_arg:
        parts = [p.strip() for p in intervals_arg.split(",") if p.strip()]
        for p in parts:
            if "-" in p:
                a, b = p.split("-", 1)
                intervals.append((a.strip(), b.strip()))

    return input_path, lanes, intervals


def main():
    input_path, carriles, intervalos = parse_args()

    # Read file (let pandas infer engine by extension)
    try:
        df = pd.read_csv(input_path)
    except Exception:
        # try Excel
        df = pd.read_excel(input_path)

    # Clean column names
    df.columns = df.columns.str.strip()

    # Convert Time column
    # Try several formats fallback
    try:
        df["Time"] = pd.to_datetime(df["Time"], format="%d/%m/%Y %H:%M:%S")
    except Exception:
        df["Time"] = pd.to_datetime(df["Time"], errors="coerce")

    df["Fecha"] = df["Time"].dt.date

    # If no lanes provided, keep all
    if carriles:
        df = df[df["Lane"].isin(carriles)]

    resultados = []


    for fecha, grupo in df.groupby("Fecha"):
        for inicio, fin in (intervalo for intervalo in (intervalos if intervalos else [("00:00", "23:59")])):
            # construct datetimes
            try:
                inicio_hora = pd.to_datetime(str(fecha) + " " + inicio)
                fin_hora = pd.to_datetime(str(fecha) + " " + fin)
            except Exception:
                inicio_hora = None
                fin_hora = None

            if inicio_hora is not None and fin_hora is not None:
                subset = grupo[(grupo["Time"] >= inicio_hora) & (grupo["Time"] < fin_hora)]
            else:
                subset = grupo

            total = 0
            if "#vehicles" in subset.columns:
                try:
                    total = int(subset["#vehicles"].sum())
                except Exception:
                    total = int(subset["#vehicles"].sum() or 0)
            else:
                # try alternative column names
                for col in subset.columns:
                    if "vehicle" in col.lower():
                        try:
                            total = int(subset[col].sum())
                        except Exception:
                            total = int(subset[col].sum() or 0)
                        break

            resultados.append({
                "Fecha": str(fecha),
                "Intervalo": f"{inicio}-{fin}",
                "Carriles": ",".join(map(str, carriles)) if carriles else "all",
                "Total_vehiculos": total,
            })

    # If caller requested Excel output via flag, write file
    df_res = pd.DataFrame(resultados)
    if "--write-xlsx" in sys.argv:
        out_path = "resumen_intervalos.xlsx"
        df_res.to_excel(out_path, index=False)

    # Print JSON once
    print(json.dumps(resultados, ensure_ascii=False))


if __name__ == "__main__":
    main()
