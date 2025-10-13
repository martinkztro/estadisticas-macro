import formidable from "formidable";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Error procesando formulario." });

    const lanes_ns = fields.lanes_ns || "";
    const lanes_sn = fields.lanes_sn || "";
    const autoMode = String(fields.autoMode) === "true";
    const hours = fields.hours ? parseInt(fields.hours) : 1;

    const file = files?.file;
    const filePath = Array.isArray(file) ? file[0]?.filepath || file[0]?.path : file?.filepath || file?.path;
    if (!filePath) return res.status(400).json({ error: "No se recibió archivo." });

    const wantXlsx = req.query && req.query.format === "xlsx";

    const pyArgs = [
      path.join(process.cwd(), "scripts/procesar_excel.py"),
      filePath,
      lanes_ns,
      lanes_sn,
      "",
    ];
    if (wantXlsx) pyArgs.push("--write-xlsx");
    if (autoMode) {
      pyArgs.push("--auto");
      pyArgs.push("--hours", String(hours));
    }

    const python = spawn("python3", pyArgs);
    let output = "", stderr = "";

    python.stdout.on("data", (d) => (output += d.toString()));
    python.stderr.on("data", (d) => (stderr += d.toString()));

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python error:", stderr);
        return res.status(500).json({ error: "Error en script Python", details: stderr });
      }
      try {
        const json = JSON.parse(output);
        if (wantXlsx) {
          const outPath = path.join(process.cwd(), "resumen_intervalos.xlsx");
          if (fs.existsSync(outPath)) {
            const data = fs.readFileSync(outPath);
            res.setHeader("Content-Disposition", "attachment; filename=resumen_intervalos.xlsx");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            return res.send(data);
          }
        }
        return res.status(200).json({ data: json });
      } catch (e) {
        console.error("Parse error:", e, output);
        return res.status(500).json({ error: "Salida JSON inválida del script" });
      }
    });
  });
}
