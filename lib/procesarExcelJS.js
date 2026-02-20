import Papa from "papaparse";
import * as XLSX from "xlsx";
export async function procesarArchivoCSV(file, lanesNS, lanesSN, intervals, columnMap = {}) {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

  if (isExcel) {
    return procesarExcel(file, lanesNS, lanesSN, intervals, columnMap);
  } else {
    return procesarCSV(file, lanesNS, lanesSN, intervals, columnMap);
  }
}

export async function extraerZoneIdsDisponibles(file, columnMap = {}) {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
  const rows = isExcel ? await leerFilasExcel(file) : await leerFilasCSV(file);

  const zonas = rows
    .map((r) => {
      const valor = obtenerValorDeCampo(r, "zoneId", ["zoneid", "lane", "zone", "laneid"], columnMap);
      const numero = parseInt(String(valor ?? "").trim(), 10);
      return Number.isFinite(numero) ? numero : null;
    })
    .filter((z) => z !== null);

  return [...new Set(zonas)].sort((a, b) => a - b);
}

export async function extraerColumnasDisponibles(file) {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
  const rows = isExcel ? await leerFilasExcel(file) : await leerFilasCSV(file);
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]).filter((c) => !!String(c || "").trim());
}

export function sugerirMapeoColumnas(columnas = []) {
  const sugerir = (aliases) => {
    for (const columna of columnas) {
      const normalizada = normalizarClave(columna);
      const coincide = aliases.some((alias) => {
        const aliasNormalizado = normalizarClave(alias);
        return normalizada === aliasNormalizado || normalizada.includes(aliasNormalizado);
      });
      if (coincide) return columna;
    }
    return "";
  };

  return {
    utc: sugerir(["utc", "time", "timestamp", "datetime", "fecha", "hora"]),
    zoneId: sugerir(["zoneid", "lane", "zone", "laneid"]),
    numVeh: sugerir(["numveh", "vehicles", "vehiclecount", "volume", "count", "veh"]),
  };
}

async function leerFilasExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (!jsonData || jsonData.length < 2) {
          resolve([]);
          return;
        }

        const headers = jsonData[0].map((h) => String(h ?? "").trim());
        const rows = jsonData
          .slice(1)
          .map((row) => {
            const obj = {};
            headers.forEach((header, idx) => {
              obj[header] = row[idx];
            });
            return obj;
          })
          .filter((row) => Object.values(row).some((val) => val !== null && val !== undefined && val !== ""));

        resolve(rows);
      } catch (err) {
        reject(`Error al leer archivo Excel: ${err.message}`);
      }
    };

    reader.onerror = () => reject("Error al leer el archivo");
    reader.readAsArrayBuffer(file);
  });
}

async function leerFilasCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve([]);
          return;
        }

        const cleaned = results.data.map((row) => {
          const fixed = {};
          Object.keys(row).forEach((k) => {
            fixed[String(k).trim()] = row[k];
          });
          return fixed;
        });

        resolve(cleaned);
      },
      error: (err) => reject(err.message),
    });
  });
}

async function procesarExcel(file, lanesNS, lanesSN, intervals, columnMap = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          reject("El archivo Excel está vacío o no tiene datos.");
          return;
        }

        const headers = jsonData[0].map(h => {
          if (h === null || h === undefined) return "";
          return String(h).trim();
        });
        console.log("Columnas detectadas en Excel:", headers);

        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx];
          });
          return obj;
        }).filter(row => {
          return Object.values(row).some(val => val !== null && val !== undefined && val !== "");
        });

        console.log("Primeras 3 filas del Excel:", rows.slice(0, 3));

        const result = procesarDatos(rows, lanesNS, lanesSN, intervals, columnMap);
        resolve(result);
      } catch (err) {
        console.error("Error procesando Excel:", err);
        reject(`Error al procesar archivo Excel: ${err.message}`);
      }
    };

    reader.onerror = () => {
      reject("Error al leer el archivo");
    };

    reader.readAsArrayBuffer(file);
  });
}

async function procesarCSV(file, lanesNS, lanesSN, intervals, columnMap = {}) {
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

          console.log("Primeras 3 filas del CSV:", results.data.slice(0, 3));
          console.log("Columnas detectadas:", Object.keys(results.data[0]));

          const cleaned = results.data.map((row) => {
            const fixed = {};
            Object.keys(row).forEach((k) => {
              fixed[k.trim()] = row[k];
            });
            return fixed;
          });

          const result = procesarDatos(cleaned, lanesNS, lanesSN, intervals, columnMap);
          resolve(result);
        } catch (err) {
          console.error("Error procesando CSV:", err);
          reject(err);
        }
      },
      error: (err) => reject(err.message),
    });
  });
}

function procesarDatos(rows, lanesNS, lanesSN, intervals, columnMap = {}) {
  const df = rows
    .map((r, index) => {
      const utcValue = obtenerValorDeCampo(
        r,
        "utc",
        ["utc", "time", "timestamp", "datetime", "fecha", "hora"],
        columnMap
      ) || "";
      const zoneIdValue =
        obtenerValorDeCampo(r, "zoneId", ["zoneid", "lane", "zone", "laneid"], columnMap) || 0;
      const numVehValue =
        obtenerValorDeCampo(
          r,
          "numVeh",
          ["numveh", "vehicles", "vehiclecount", "volume", "count", "veh"],
          columnMap
        ) || 0;
      
      const { fechaTexto, horaTexto } = extraerFechaHora(utcValue);

      if (index === 0) {
        console.log("Procesando primera fila:");
        console.log("  - utcValue:", utcValue);
        console.log("  - fechaTexto:", fechaTexto);
        console.log("  - horaTexto:", horaTexto);
        console.log("  - zoneIdValue:", zoneIdValue);
        console.log("  - numVehValue:", numVehValue);
      }
      
      return {
        ...r,
        Lane: parseInt(zoneIdValue, 10),
        "#vehicles": parseFloat(numVehValue),
        FechaTexto: fechaTexto,
        HoraTexto: horaTexto,
      };
    })
    .filter((r) => {
      const hasDate = !!r.FechaTexto;
      const hasTime = !!r.HoraTexto;
      const hasVehicles = !isNaN(r["#vehicles"]);
      
      return hasDate && hasTime && hasVehicles;
    });

  console.log("Registros válidos después del filtro:", df.length);
  if (df.length > 0) {
    console.log("Primer registro válido:", df[0]);
  }

  const dfSinDuplicados = deduplicarRegistros(df);
  console.log(
    "Registros después de deduplicar:",
    dfSinDuplicados.length,
    "(eliminados:",
    df.length - dfSinDuplicados.length,
    ")"
  );

  if (dfSinDuplicados.length === 0) {
    throw new Error("No se pudieron leer registros válidos. Verifica que tenga las columnas: Utc, ZoneId, NumVeh");
  }

  const zonasSolicitadas = [...new Set([...(lanesNS || []), ...(lanesSN || [])])].filter((z) => Number.isFinite(z));
  const todasLasZonas =
    zonasSolicitadas.length > 0
      ? zonasSolicitadas
      : [...new Set(dfSinDuplicados.map((r) => r.Lane).filter((z) => Number.isFinite(z)))];
  console.log("Zonas a procesar:", todasLasZonas);

  const resultados = [];
  
  for (const zona of todasLasZonas) {
    console.log(`Procesando zona ${zona}...`);
    const resultadosZona = procesarZona(dfSinDuplicados, zona, intervals);
    resultados.push(...resultadosZona);
  }

  console.log("Total de resultados generados:", resultados.length);
  return resultados;
}

function deduplicarRegistros(registros) {
  const porClave = new Map();

  for (const r of registros) {
    const horaMinuto = normalizarHoraMinuto(r.HoraTexto);
    if (!horaMinuto) continue;

    const clase = obtenerClaseRegistro(r);
    const key = `${r.Lane}|${r.FechaTexto}|${horaMinuto}|${clase}`;
    const vehiculos = Number(r["#vehicles"] || 0);

    if (!porClave.has(key)) {
      porClave.set(key, {
        ...r,
        HoraTexto: `${horaMinuto}:00`,
        "#vehicles": Number.isFinite(vehiculos) ? vehiculos : 0,
      });
      continue;
    }

    const existente = porClave.get(key);
    const vehiculosExistente = Number(existente["#vehicles"] || 0);
    const vehiculosActual = Number.isFinite(vehiculos) ? vehiculos : 0;

    if (vehiculosActual > vehiculosExistente) {
      porClave.set(key, {
        ...existente,
        ...r,
        HoraTexto: `${horaMinuto}:00`,
        "#vehicles": vehiculosActual,
      });
    }
  }

  return Array.from(porClave.values());
}

function obtenerClaseRegistro(registro) {
  const posiblesClaves = ["Class", "class", "VehicleClass", "vehicleClass"];
  for (const clave of posiblesClaves) {
    if (Object.prototype.hasOwnProperty.call(registro, clave)) {
      const valor = String(registro[clave] ?? "").trim();
      return valor || "_NO_CLASS_";
    }
  }
  return "_NO_CLASS_";
}

function procesarZona(df, zona, intervalos) {
  const resultados = [];
  
  console.log(`Filtrando datos para zona ${zona}`);
  const datos = df.filter((r) => r.Lane === zona);
  console.log(`Registros encontrados para zona ${zona}:`, datos.length);

  if (datos.length === 0) {
    console.warn(`No hay datos para zona ${zona}`);
    return [];
  }

  const fechas = [...new Set(datos.map((r) => r.FechaTexto))];
  console.log(`Fechas encontradas para zona ${zona}:`, fechas);

  for (const fecha of fechas) {
    const registrosFecha = datos.filter((r) => r.FechaTexto === fecha);

    const tramos = (intervalos || []).flatMap(([inicio, fin]) => dividirEnQuinceMinutos(inicio, fin));
    const usarFiltroHorario = tramos.length > 0;

    const porHora = {};

    registrosFecha.forEach((r) => {
      const horaMinuto = normalizarHoraMinuto(r.HoraTexto);
      if (!horaMinuto) return;

      const segundos = parseHoraEnSegundos(`${horaMinuto}:00`);
      if (isNaN(segundos)) return;

      if (usarFiltroHorario) {
        const dentroDeTramo = tramos.some((t) => segundos >= t.inicio && segundos < t.fin);
        if (!dentroDeTramo) return;
      }

      const hora = `${horaMinuto.slice(0, 2)}:00`;

      if (!porHora[hora]) {
        porHora[hora] = 0;
      }
      porHora[hora] += r["#vehicles"] || 0;
    });

    const horasOrdenadas = Object.keys(porHora).sort();

    for (const hora of horasOrdenadas) {
      resultados.push({
        Zona: zona,
        Fecha: fecha,
        Intervalo: hora,
        Total_vehiculos: Math.round(porHora[hora]),
      });
    }

  }

  console.log(`Resultados generados para zona ${zona}:`, resultados.length);
  return resultados;
}

function procesarDireccion(df, carriles, intervalos, nombre) {
  const resultados = [];

  let datos = df;
  if (carriles && carriles.length > 0) {
    console.log("Filtrando por zonas:", carriles);
    datos = df.filter((r) => carriles.includes(r.Lane));
    console.log("Registros después de filtrar por zonas:", datos.length);
  }

  if (datos.length === 0) {
    console.warn("No hay datos después de filtrar por zonas");
    return [];
  }

  const fechas = [...new Set(datos.map((r) => r.FechaTexto))];
  console.log("Fechas encontradas:", fechas);

  for (const fecha of fechas) {
    const registrosFecha = datos.filter((r) => r.FechaTexto === fecha);
    console.log(`Registros para fecha ${fecha}:`, registrosFecha.length);
    
    const porHora = {};
    
    registrosFecha.forEach((r) => {
      const horaParts = r.HoraTexto.split(":");
      const hora = `${horaParts[0].padStart(2, '0')}:00`;
      
      if (!porHora[hora]) {
        porHora[hora] = 0;
      }
      porHora[hora] += r["#vehicles"] || 0;
    });
    
    console.log(`Vehículos por hora para ${fecha}:`, porHora);
    
    const horasOrdenadas = Object.keys(porHora).sort();
    
    for (const hora of horasOrdenadas) {
      resultados.push({
        Dirección: nombre,
        Fecha: fecha,
        Intervalo: hora,
        Carriles: carriles && carriles.length ? carriles.join(",") : "all",
        Total_vehiculos: Math.round(porHora[hora]),
      });
    }
  }

  console.log("Resultados generados:", resultados.length);
  return resultados;
}

function dividirEnQuinceMinutos(inicio, fin) {
  const start = parseHoraEnSegundos(inicio);
  const end = parseHoraEnSegundos(fin);
  if (isNaN(start) || isNaN(end) || end <= start) return [];

  const tramos = [];
  for (let marca = start; marca < end; marca += 900) {
    const siguiente = Math.min(marca + 900, end);
    tramos.push({
      inicio: marca,
      fin: siguiente,
      label: `${formatearHora(marca)}-${formatearHora(siguiente)}`,
    });
  }
  return tramos;
}

function formatearHora(seg) {
  const hh = Math.floor(seg / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((seg % 3600) / 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseHoraEnSegundos(horaStr) {
  if (!horaStr) return NaN;
  const m = horaStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const [, hh, mm, ss = "0"] = m;
  return (+hh) * 3600 + (+mm) * 60 + (+ss);
}

function normalizarHoraMinuto(horaStr) {
  if (!horaStr && horaStr !== 0) return "";
  const texto = String(horaStr).trim();
  const m = texto.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return "";
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  return `${hh}:${mm}`;
}

function extraerFechaHora(utcStr) {
  if (!utcStr && utcStr !== 0) return { fechaTexto: "", horaTexto: "" };

  if (!isNaN(utcStr) && typeof utcStr === 'number') {
    console.log("Detectado número serial de Excel:", utcStr);

    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + utcStr * 86400000);
    
    const d = jsDate.getDate();
    const m = jsDate.getMonth() + 1;
    const y = jsDate.getFullYear();
    const h = jsDate.getHours();
    const mi = jsDate.getMinutes();
    const s = jsDate.getSeconds();
    
    const fechaTexto = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const horaTexto = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    console.log("✅ Convertido de serial Excel:", { fechaTexto, horaTexto });
    return { fechaTexto, horaTexto };
  }

  const trimmed = String(utcStr).trim();
  if (!trimmed) return { fechaTexto: "", horaTexto: "" };

  console.log("Intentando extraer fecha/hora de texto:", trimmed);

  const m = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h, mi, s = "00"] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    const fechaTexto = `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${yyyy}`;
    const horaTexto = `${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${s.padStart(2, "0")}`;
    console.log("✅ Extraído con regex:", { fechaTexto, horaTexto });
    return { fechaTexto, horaTexto };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    console.log("⚠️ Usando split por espacios:", parts);
    return { fechaTexto: parts[0], horaTexto: parts[1] };
  }

  console.log("❌ No se pudo extraer fecha/hora");
  return { fechaTexto: "", horaTexto: "" };
}

function normalizarClave(clave) {
  return String(clave ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function obtenerValorPorAlias(obj, aliases) {
  if (!obj || typeof obj !== "object") return undefined;
  const entries = Object.entries(obj);
  for (const [k, v] of entries) {
    const nk = normalizarClave(k);
    const coincide = aliases.some((alias) => {
      const na = normalizarClave(alias);
      return nk === na || nk.includes(na);
    });
    if (coincide) return v;
  }
  return undefined;
}

function obtenerValorDeCampo(obj, mapKey, aliases, columnMap = {}) {
  const columnaConfigurada = String(columnMap?.[mapKey] ?? "").trim();
  if (columnaConfigurada && Object.prototype.hasOwnProperty.call(obj, columnaConfigurada)) {
    return obj[columnaConfigurada];
  }
  return obtenerValorPorAlias(obj, aliases);
}
