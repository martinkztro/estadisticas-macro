import Papa from "papaparse";

/**
 * Procesa un archivo CSV de tráfico, replicando la lógica del script Python original,
 * pero con corrección de intervalos y sin problemas de zona horaria.
 * 
 * Calcula totales de vehículos por dirección, fecha y rango horario (intervalo).
 * 
 * @param {File} file - Archivo CSV a procesar
 * @param {number[]} lanesNS - Carriles Norte→Sur
 * @param {number[]} lanesSN - Carriles Sur→Norte
 * @param {Array<[string, string]>} intervals - Rango(s) horarios (por ejemplo [["05:00","10:00"],["13:00","16:00"]])
 */
export async function procesarArchivoCSV(file, lanesNS, lanesSN, intervals) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            reject("El archivo está vacío o no contiene datos válidos.");
            return;
          }

          // 🔹 Limpiar nombres de columnas
          const cleaned = results.data.map((row) => {
            const fixed = {};
            Object.keys(row).forEach((k) => {
              fixed[k.trim()] = row[k];
            });
            return fixed;
          });

          // 🔹 Normalizar campos
          const df = cleaned
            .map((r) => {
              const timeStr = (r["Time"] || "").trim();
              const [fechaTexto, horaTexto] = timeStr.split(" ");
              return {
                ...r,
                Lane: parseInt(r["Lane"] || 0),
                "#vehicles": parseFloat(r["#vehicles"] || 0),
                FechaTexto: fechaTexto,
                HoraTexto: horaTexto || "",
              };
            })
            .filter((r) => r.FechaTexto && r.HoraTexto && !isNaN(r["#vehicles"]));

          if (df.length === 0) {
            reject("No se pudieron leer registros válidos del CSV.");
            return;
          }

          // 🔹 Procesar ambas direcciones
          const ns = procesarDireccion(df, lanesNS, intervals, "Norte → Sur");
          const sn = procesarDireccion(df, lanesSN, intervals, "Sur → Norte");

          resolve([...ns, ...sn]);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err.message),
    });
  });
}

// ---------------------------------------------------------------------
// 🔧 Procesa una dirección (grupo de carriles)
// ---------------------------------------------------------------------
function procesarDireccion(df, carriles, intervalos, nombre) {
  const resultados = [];
  const datos =
    carriles && carriles.length > 0
      ? df.filter((r) => carriles.includes(r.Lane))
      : df;

  if (datos.length === 0) return [];

  const fechas = [...new Set(datos.map((r) => r.FechaTexto))];

  for (const fecha of fechas) {
    const registrosFecha = datos.filter((r) => r.FechaTexto === fecha);
    const intervalosDia = intervalos.length > 0 ? intervalos : [["00:00", "23:59"]];

    for (const [inicio, fin] of intervalosDia) {
      const total = sumarVehiculosPorIntervalo(registrosFecha, inicio, fin);

      resultados.push({
        Dirección: nombre,
        Fecha: fecha,
        Intervalo: `${inicio}-${fin}`,
        Carriles: carriles && carriles.length ? carriles.join(",") : "all",
        Total_vehiculos: total,
      });
    }
  }

  return resultados;
}

// ---------------------------------------------------------------------
// 🔹 Suma los vehículos dentro de intervalos de 15 minutos exactos
// ---------------------------------------------------------------------
function sumarVehiculosPorIntervalo(registros, inicio, fin) {
  let total = 0;
  const [ih, im] = inicio.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);

  const start = ih * 3600 + im * 60;
  const end = fh * 3600 + fm * 60;

  // Recorrer intervalos de 15 minutos (900 segundos)
  for (let marca = start; marca < end; marca += 900) {
    const siguiente = marca + 900;

    const sub = registros.filter((r) => {
      const s = parseHoraEnSegundos(r.HoraTexto);
      return s >= marca && s < siguiente; // [inicio, siguiente)
    });

    total += sub.reduce((acc, r) => acc + (r["#vehicles"] || 0), 0);
  }

  return Math.round(total); // igual que int() en Python
}

// ---------------------------------------------------------------------
// 🔹 Convierte "HH:MM(:SS)" a segundos del día
// ---------------------------------------------------------------------
function parseHoraEnSegundos(horaStr) {
  if (!horaStr) return NaN;
  const m = horaStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const [, hh, mm, ss = "0"] = m;
  return (+hh) * 3600 + (+mm) * 60 + (+ss);
}
