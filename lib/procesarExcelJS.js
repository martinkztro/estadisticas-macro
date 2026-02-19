import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Procesa un archivo CSV o XLSX de tráfico, replicando la lógica del script Python original,
 * pero con corrección de intervalos y sin problemas de zona horaria.
 * 
 * Calcula totales de vehículos por dirección, fecha y rango horario (intervalo).
 * 
 * @param {File} file - Archivo CSV o XLSX a procesar
 * @param {number[]} lanesNS - Carriles Norte→Sur
 * @param {number[]} lanesSN - Carriles Sur→Norte
 * @param {Array<[string, string]>} intervals - Rango(s) horarios (por ejemplo [["05:00","10:00"],["13:00","16:00"]])
 */
export async function procesarArchivoCSV(file, lanesNS, lanesSN, intervals) {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

  if (isExcel) {
    return procesarExcel(file, lanesNS, lanesSN, intervals);
  } else {
    return procesarCSV(file, lanesNS, lanesSN, intervals);
  }
}

// ---------------------------------------------------------------------
// 🔧 Procesar archivos Excel (.xlsx)
// ---------------------------------------------------------------------
async function procesarExcel(file, lanesNS, lanesSN, intervals) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Leer la primera hoja
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          reject("El archivo Excel está vacío o no tiene datos.");
          return;
        }

        // Primera fila son los headers - convertir todo a string
        const headers = jsonData[0].map(h => {
          if (h === null || h === undefined) return "";
          return String(h).trim();
        });
        console.log("Columnas detectadas en Excel:", headers);

        // Convertir a objetos
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx];
          });
          return obj;
        }).filter(row => {
          // Filtrar filas completamente vacías
          return Object.values(row).some(val => val !== null && val !== undefined && val !== "");
        });

        console.log("Primeras 3 filas del Excel:", rows.slice(0, 3));

        // Procesar los datos normalizados
        const result = procesarDatos(rows, lanesNS, lanesSN, intervals);
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

// ---------------------------------------------------------------------
// 🔧 Procesar archivos CSV
// ---------------------------------------------------------------------
async function procesarCSV(file, lanesNS, lanesSN, intervals) {
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

          // Limpiar nombres de columnas
          const cleaned = results.data.map((row) => {
            const fixed = {};
            Object.keys(row).forEach((k) => {
              fixed[k.trim()] = row[k];
            });
            return fixed;
          });

          const result = procesarDatos(cleaned, lanesNS, lanesSN, intervals);
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

// ---------------------------------------------------------------------
// 🔧 Procesar datos normalizados (común para CSV y Excel)
// ---------------------------------------------------------------------
function procesarDatos(rows, lanesNS, lanesSN, intervals) {
  // 🔹 Normalizar campos
  const df = rows
    .map((r, index) => {
      // Acceso seguro a las propiedades
      const utcValue = r["Utc"] || r["Time"] || "";
      const zoneIdValue = r["ZoneId"] || r["Lane"] || 0;
      const numVehValue = r["NumVeh"] || r["#vehicles"] || 0;
      
      const { fechaTexto, horaTexto } = extraerFechaHora(utcValue);
      
      // Debug para la primera fila
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

  // 🔹 Obtener todas las zonas seleccionadas
  const todasLasZonas = [...new Set([...(lanesSN || [])])];
  console.log("Zonas a procesar:", todasLasZonas);

  // 🔹 Procesar cada zona por separado
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

// ---------------------------------------------------------------------
// 🔧 Procesa una zona específica
// ---------------------------------------------------------------------
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

    // Agrupar resultado final por hora (HH:00)
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

    // Convertir a array y ordenar
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

// ---------------------------------------------------------------------
// 🔧 Procesa una dirección (grupo de carriles)
// ---------------------------------------------------------------------
function procesarDireccion(df, carriles, intervalos, nombre) {
  const resultados = [];
  
  // Si se especificaron carriles, filtrar por ellos
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
    
    // Agrupar por hora (00:00, 01:00, 02:00, etc.)
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
    
    // Convertir a array y ordenar
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

// ---------------------------------------------------------------------
// 🔹 Genera tramos de 15 minutos entre dos horas
// ---------------------------------------------------------------------
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
  
  // Si es un número (fecha serial de Excel)
  if (!isNaN(utcStr) && typeof utcStr === 'number') {
    console.log("Detectado número serial de Excel:", utcStr);
    
    // Excel serial date: días desde 1/1/1900
    const excelEpoch = new Date(1899, 11, 30); // 30 de diciembre de 1899
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
  
  // Convertir a string de forma segura
  const trimmed = String(utcStr).trim();
  if (!trimmed) return { fechaTexto: "", horaTexto: "" };

  console.log("Intentando extraer fecha/hora de texto:", trimmed);

  // Patrón para dd/mm/yyyy hh:mm o dd-mm-yyyy hh:mm
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
