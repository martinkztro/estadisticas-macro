"use client";
import { useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  Button,
  Input,
  Table,
  Spin,
  Space,
  Card,
  Collapse,
  Tag,
  Typography,
  Row,
  Col,
  Form,
  Divider,
  Tooltip,
  App,
  notification,
  Modal, // usamos Modal.useModal() para evitar warnings
} from "antd";
import { UploadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { procesarArchivoCSV } from "@/lib/procesarExcelJS";

export default function Home() {
  const [file, setFile] = useState(null);
  const [lanesNS, setLanesNS] = useState("");
  const [lanesSN, setLanesSN] = useState("");
  const [morningFrom, setMorningFrom] = useState("05:00");
  const [morningTo, setMorningTo] = useState("10:00");
  const [afternoonFrom, setAfternoonFrom] = useState("13:00");
  const [afternoonTo, setAfternoonTo] = useState("16:00");
  const [nightFrom, setNightFrom] = useState("16:00");
  const [nightTo, setNightTo] = useState("22:00");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const [api, contextHolder] = notification.useNotification();
  const [modal, modalContextHolder] = Modal.useModal(); // ✅ modal con contexto

  // ---------------- Helpers ----------------
  const showNotification = (type, message, description) => {
    api.open({ type, message, description, placement: "topRight", duration: 3.5 });
  };

  const buildIntervals = () => {
    const ranges = [];
    if (morningFrom && morningTo) ranges.push(`${morningFrom}-${morningTo}`);
    if (afternoonFrom && afternoonTo) ranges.push(`${afternoonFrom}-${afternoonTo}`);
    if (nightFrom && nightTo) ranges.push(`${nightFrom}-${nightTo}`);
    return ranges.join(",");
  };

  // ------------- Procesar CSV -------------
  const handleUpload = async () => {
    if (!file) {
      showNotification("warning", "Falta archivo", "Selecciona un archivo CSV antes de continuar.");
      return;
    }
    if (!lanesNS && !lanesSN) {
      showNotification("warning", "Faltan carriles", "Debes ingresar al menos un grupo de carriles.");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const lanesNSArr = lanesNS ? lanesNS.split(",").map((x) => parseInt(x.trim())) : [];
      const lanesSNArr = lanesSN ? lanesSN.split(",").map((x) => parseInt(x.trim())) : [];
      const intervalos = buildIntervals()
        .split(",")
        .filter(Boolean)
        .map((r) => r.split("-").map((x) => x.trim()));

      const data = await procesarArchivoCSV(file, lanesNSArr, lanesSNArr, intervalos);
      setResults(data);

      if (data.length === 0) {
        showNotification("info", "Sin resultados", "No se generaron resultados con los filtros aplicados.");
      } else {
        showNotification("success", "Procesamiento exitoso", "Los datos fueron analizados correctamente.");
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Error al procesar", err.toString());
    } finally {
      setLoading(false);
    }
  };

  // ------------- Exportar Excel con estilo (ExcelJS) -------------
  const downloadExcel = async () => {
    if (!results || results.length === 0) {
      showNotification("info", "Sin datos", "No hay resultados para exportar.");
      return;
    }

    let nombreArchivo = "";

    modal.confirm({
      title: "Guardar archivo Excel",
      content: (
        <Input
          placeholder="Escribe el nombre del archivo (sin extensión)"
          onChange={(e) => (nombreArchivo = e.target.value)}
        />
      ),
      okText: "Descargar",
      cancelText: "Cancelar",
      centered: true,
      onOk: async () => {
        const ExcelJS = await import("exceljs"); // import dinámico compatible con Next

        if (!nombreArchivo.trim()) nombreArchivo = "resumen_intervalos";

        // Separar resultados por dirección
        const ns = results.filter((r) => r.Dirección === "Norte → Sur");
        const sn = results.filter((r) => r.Dirección === "Sur → Norte");

        // Crear libro
        const wb = new ExcelJS.Workbook();

        // ---- Helpers locales para la exportación ----
        const headers = ["Dirección", "Fecha", "Intervalo", "Carriles", "Total_vehiculos"];

        const fechaKeyToMillis = (ddmmyyyy) => {
          const [d, m, y] = ddmmyyyy.split("/").map(Number);
          return new Date(y, m - 1, d).getTime();
        };
        const intervaloInicioMin = (intervalo) => {
          const [ini] = intervalo.split("-");
          const [h, mm] = ini.split(":").map(Number);
          return h * 60 + mm;
        };

        const ordenar = (arr) =>
          arr.slice().sort(
            (a, b) =>
              fechaKeyToMillis(a.Fecha) - fechaKeyToMillis(b.Fecha) ||
              intervaloInicioMin(a.Intervalo) - intervaloInicioMin(b.Intervalo)
          );

        const thin = { style: "thin", color: { argb: "FF000000" } };

        const buildSheet = (name, data) => {
          const sorted = ordenar(data);
          const ws = wb.addWorksheet(name);

          // Crear Tabla
          ws.addTable({
            name: `${name.replace(/\W/g, "_")}_Table`,
            ref: "A1",
            headerRow: true,
            columns: headers.map((h) => ({ name: h })),
            rows: sorted.map((r) => [r.Dirección, r.Fecha, r.Intervalo, r.Carriles, r.Total_vehiculos]),
            style: { theme: "TableStyleMedium9", showRowStripes: true },
          });

          // Bordes externos + línea divisoria cada 3 filas (como openpyxl)
          const lastRow = sorted.length + 1; // +1 por encabezado
          const lastCol = headers.length;

          for (let r = 1; r <= lastRow; r++) {
            for (let c = 1; c <= lastCol; c++) {
              const cell = ws.getCell(r, c);
              const border = { ...cell.border };

              if (r === 1) border.top = thin;
              if (r === lastRow) border.bottom = thin;
              if (c === 1) border.left = thin;
              if (c === lastCol) border.right = thin;

              // línea divisoria inferior cada 3 filas de datos: filas 4,7,10,... (r>1 y (r-1)%3===0)
              if (r > 1 && (r - 1) % 3 === 0) {
                border.bottom = thin;
              }

              cell.border = border;

              // Formato numérico para Total_vehiculos (col 5)
              if (c === 5 && r > 1) {
                cell.numFmt = "0";
              }
            }
          }

          // Ajuste de ancho de columnas (opcional)
          const widths = [16, 12, 16, 14, 16];
          ws.columns.forEach((col, i) => (col.width = widths[i] || 14));
        };

        if (ns.length) buildSheet("Norte_Sur", ns);
        if (sn.length) buildSheet("Sur_Norte", sn);

        // Descargar archivo
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const fecha = new Date().toISOString().split("T")[0];
        const nombreFinal = `${nombreArchivo.trim()}_${fecha}.xlsx`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nombreFinal;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);

        showNotification("success", "Excel generado", `Archivo guardado como "${nombreFinal}"`);
      },
    });
  };

  // --------- Agrupar resultados para Collapse ---------
  const grouped = results.reduce((acc, item) => {
    const key = `${item.Dirección}-${item.Fecha}`;
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  const columns =
    results && results.length > 0
      ? Object.keys(results[0]).map((k) => ({
        title: k.replaceAll("_", " "),
        dataIndex: k,
        key: k,
      }))
      : [];

  const laneInfo = [
    { title: "FORJADORES - JALISCO", ns: "Carriles 4, 5 y 6 → Norte a Sur", sn: "Carriles 1, 2 y 3 → Sur a Norte" },
    { title: "FORJADORES - COLOSIO", ns: "Carriles 1, 2 y 3 → Norte a Sur", sn: "Carriles 4, 5 y 6 → Sur a Norte" },
    { title: "FORJADORES - SIERRA DE LAS VIRGENES", ns: "Carriles 1, 2 y 3 → Norte a Sur", sn: "Carriles 5, 6 y 7 → Sur a Norte" },
    { title: "FORJADORES - UABCS", ns: "Carriles 1, 2 y 3 → Norte a Sur", sn: "Carriles 4, 5 y 6 → Sur a Norte" },
    { title: "FORJADORES - UNION", ns: "Carriles 1, 2 y 3 → Norte a Sur", sn: "Carriles 4, 5 y 6 → Sur a Norte" },
  ];

  // ---------------- Render ----------------
  return (
    <App>
      {contextHolder}
      {modalContextHolder}

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <Typography.Title level={3}>Procesar archivo de Tráfico</Typography.Title>
        <Typography.Paragraph type="secondary">
          El procesamiento se realiza directamente en tu navegador — sin depender del servidor.
        </Typography.Paragraph>

        <Card bordered size="default">
          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Archivo">
                  <Upload beforeUpload={(f) => { setFile(f); return false; }} maxCount={1} accept=".csv">
                    <Button icon={<UploadOutlined />}>Seleccionar archivo</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<Space>Carriles Norte → Sur<Tooltip title="Carriles que van de Norte a Sur"><InfoCircleOutlined style={{ color: "#1677ff" }} /></Tooltip></Space>}>
                  <Input value={lanesNS} onChange={(e) => setLanesNS(e.target.value)} placeholder="Ej: 1,2,3" />
                </Form.Item>
                <Form.Item label={<Space>Carriles Sur → Norte<Tooltip title="Carriles que van de Sur a Norte"><InfoCircleOutlined style={{ color: "#722ed1" }} /></Tooltip></Space>}>
                  <Input value={lanesSN} onChange={(e) => setLanesSN(e.target.value)} placeholder="Ej: 4,5,6" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Typography.Title level={5}>Rangos horarios</Typography.Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Mañana">
                  <Space>
                    <Input type="time" value={morningFrom} onChange={(e) => setMorningFrom(e.target.value)} />
                    <Input type="time" value={morningTo} onChange={(e) => setMorningTo(e.target.value)} />
                  </Space>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Tarde">
                  <Space>
                    <Input type="time" value={afternoonFrom} onChange={(e) => setAfternoonFrom(e.target.value)} />
                    <Input type="time" value={afternoonTo} onChange={(e) => setAfternoonTo(e.target.value)} />
                  </Space>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Noche">
                  <Space>
                    <Input type="time" value={nightFrom} onChange={(e) => setNightFrom(e.target.value)} />
                    <Input type="time" value={nightTo} onChange={(e) => setNightTo(e.target.value)} />
                  </Space>
                </Form.Item>
              </Col>
            </Row>

            <Space>
              <Button type="primary" onClick={handleUpload} disabled={!file || loading}>
                {loading ? <Spin /> : "Procesar"}
              </Button>
              <Button onClick={downloadExcel} disabled={!results || results.length === 0}>
                Descargar Excel
              </Button>
            </Space>
          </Form>
        </Card>

        {/* Resultados */}
        {results && results.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <Typography.Title level={4}>Resultados</Typography.Title>
            <Collapse
              accordion
              items={Object.keys(grouped).map((key) => {
                const [direccion, ...fechaParts] = key.split("-");
                const fechaCompleta = fechaParts.join("-");
                return {
                  key,
                  label: (
                    <Row align="middle" gutter={8}>
                      <Col><Tag color="blue" style={{ fontWeight: 700 }}>{fechaCompleta}</Tag></Col>
                      <Col><Tag color="purple">{direccion}</Tag></Col>
                      <Col><Tag color="green">{grouped[key].length} intervalos</Tag></Col>
                    </Row>
                  ),
                  children: (
                    <Card size="small" style={{ background: "#fafafa", border: "none" }}>
                      <Table
                        dataSource={grouped[key]}
                        columns={columns}
                        rowKey={(r) => `${r.Dirección}-${r.Intervalo}-${r.Carriles}`}
                        pagination={false}
                      />
                    </Card>
                  ),
                };
              })}
            />
          </div>
        )}

        {/* Guía informativa */}
        <Card
          title="Guía informativa de carriles por intersección"
          style={{
            marginTop: 40,
            background: "#fefefe",
            border: "1px solid #d9d9d9",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <Collapse
            accordion={false}
            bordered={false}
            items={laneInfo.map((info) => ({
              key: info.title,
              label: (
                <Tag color="blue" style={{ fontWeight: 600, fontSize: 15, padding: "4px 10px", borderRadius: 8 }}>
                  {info.title}
                </Tag>
              ),
              children: (
                <div style={{ padding: "14px 18px", background: "#fafafa", borderRadius: 10 }}>
                  <div style={{ fontSize: 16, marginBottom: 6 }}>
                    <Tag color="purple" style={{ fontWeight: 600 }}>Norte → Sur</Tag> {info.ns}
                  </div>
                  <div style={{ fontSize: 16 }}>
                    <Tag color="green" style={{ fontWeight: 600 }}>Sur → Norte</Tag> {info.sn}
                  </div>
                </div>
              ),
            }))}
          />
        </Card>
      </div>
    </App>
  );
}
