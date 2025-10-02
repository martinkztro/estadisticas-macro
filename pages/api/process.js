import formidable from "formidable";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Use the modern formidable initializer (works with ESM interop / Turbopack)
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err });

    // Debug: ensure we can find the uploaded file
    // `files` shape can vary across formidable versions. Try several fallbacks.
    const lanes = fields.lanes;
    const intervals = fields.intervals;

    let filePath;
    try {
      if (files && files.file) {
        const f = files.file;
        if (Array.isArray(f)) {
          const first = f[0];
          filePath = first && (first.filepath || first.path || first.tempFilePath || first.tempFile);
        } else {
          filePath = f.filepath || f.path || f.tempFilePath || f.tempFile;
        }
      } else if (files && Object.keys(files).length > 0) {
        // take the first file
        const f = files[Object.keys(files)[0]];
        filePath = f && (f.filepath || f.path || f.tempFilePath || f.tempFile);
      }
    } catch (e) {
      console.error("error reading uploaded file info", e, files);
    }

    if (!filePath) {
      console.error("no uploaded file found", { files, fields });
      return res.status(400).json({ error: "No file uploaded or could not read uploaded file path", files });
    }

    // Ejecutar script de Python que ahora emite JSON en stdout
    const wantXlsx = req.query && req.query.format === "xlsx";

    const pyArgs = [path.join(process.cwd(), "scripts/procesar_excel.py"), filePath, lanes || "", intervals || ""];
    if (wantXlsx) pyArgs.push("--write-xlsx");

    const python = spawn("python3", pyArgs);

    let output = "";
    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    let stderr = "";
    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("python error:", stderr);
        return res.status(500).json({ error: "Processing failed", details: stderr });
      }

      try {
        const json = JSON.parse(output);
        if (wantXlsx) {
          // send generated file
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

        return res.status(200).json({ data: json });
      } catch (e) {
        console.error("parse error", e, output);
        return res.status(500).json({ error: "Invalid JSON from processing script" });
      }
    });
  });
}
