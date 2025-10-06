import formidable from "formidable";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const lanes_ns = Array.isArray(fields.lanes_ns) ? fields.lanes_ns[0] : fields.lanes_ns || "";
    const lanes_sn = Array.isArray(fields.lanes_sn) ? fields.lanes_sn[0] : fields.lanes_sn || "";
    const intervals = Array.isArray(fields.intervals) ? fields.intervals[0] : fields.intervals || "";

    let filePath;
    try {
      const f = files.file;
      if (Array.isArray(f)) filePath = f[0]?.filepath || f[0]?.path;
      else filePath = f?.filepath || f?.path;
    } catch (e) {
      console.error("Error leyendo archivo subido:", e);
    }

    if (!filePath) return res.status(400).json({ error: "No se recibió ningún archivo" });

    const uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const tempCopy = path.join(uploadDir, path.basename(filePath));
    fs.copyFileSync(filePath, tempCopy);

    const wantXlsx = req.query && req.query.format === "xlsx";

    const pyArgs = [
      path.join(process.cwd(), "scripts/procesar_excel.py"),
      tempCopy,
      lanes_ns,
      lanes_sn,
      intervals,
    ];
    if (wantXlsx) pyArgs.push("--write-xlsx");

    const python = spawn("python3", pyArgs);

    let output = "";
    let stderr = "";
    python.stdout.on("data", (d) => (output += d.toString()));
    python.stderr.on("data", (d) => (stderr += d.toString()));

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Error en script Python:", stderr);
        return res.status(500).json({ error: "Error procesando archivo", details: stderr });
      }

      try {
        const json = JSON.parse(output);
        const messages = [];
        stderr
          .split(/\r?\n/)
          .filter(Boolean)
          .forEach((line) => {
            try {
              const obj = JSON.parse(line);
              if (obj.type && obj.message) messages.push(obj);
            } catch {}
          });

        if (wantXlsx) {
          const outPath = path.join(process.cwd(), "resumen_intervalos.xlsx");
          if (fs.existsSync(outPath)) {
            const data = fs.readFileSync(outPath);
            res.setHeader("Content-Disposition", "attachment; filename=resumen_intervalos.xlsx");
            res.setHeader(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            return res.send(data);
          }
        }

        return res.status(200).json({ data: json, messages });
      } catch (e) {
        console.error("Error parseando salida:", e);
        return res.status(500).json({ error: "Salida inválida del script Python" });
      }
    });
  });
}
