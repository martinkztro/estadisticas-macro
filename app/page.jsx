"use client";
import { useState } from "react";
import {
  Upload,
  Button,
  Input,
  Table,
  Spin,
  Alert,
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
} from "antd";
import { UploadOutlined, InfoCircleOutlined } from "@ant-design/icons";

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
  const [error, setError] = useState(null);
  const [api, contextHolder] = notification.useNotification();

  // Mostrar notificación única
  const showNotification = (type, message, description) => {
    api.open({
      type,
      message,
      description,
      placement: "topRight",
      duration: 3.5,
    });
  };

  const buildIntervals = () => {
    const ranges = [];
    if (morningFrom && morningTo) ranges.push(`${morningFrom}-${morningTo}`);
    if (afternoonFrom && afternoonTo) ranges.push(`${afternoonFrom}-${afternoonTo}`);
    if (nightFrom && nightTo) ranges.push(`${nightFrom}-${nightTo}`);
    return ranges.join(",");
  };

  const handleUpload = async () => {
    // Validaciones básicas
    if (!file) {
      showNotification("warning", "Falta archivo", "Por favor, seleccione un archivo CSV o XLSX antes de continuar.");
      return;
    }
    if (!lanesNS && !lanesSN) {
      showNotification("warning", "Faltan carriles", "Debe ingresar al menos un grupo de carriles (Norte→Sur o Sur→Norte).");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    const intervalsStr = buildIntervals();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes_ns", lanesNS);
    formData.append("lanes_sn", lanesSN);
    formData.append("intervals", intervalsStr);

    try {
      const res = await fetch("/api/process", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        showNotification("error", "Error en procesamiento", json.error || "Error desconocido al procesar el archivo.");
        setLoading(false);
        return;
      }

      if (!json.data || json.data.length === 0) {
        showNotification("info", "Sin resultados", "El archivo no contiene datos válidos para los criterios seleccionados.");
      } else {
        showNotification("success", "Archivo procesado", "Los datos fueron analizados correctamente.");
      }

      setResults(json.data || []);
    } catch (e) {
      showNotification(
        "error",
        "Error interno",
        "Ocurrió un error inesperado. Contacte al desarrollador si el problema persiste."
      );
      console.error("Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!file) {
      showNotification("warning", "Falta archivo", "Debe cargar un archivo antes de descargar el Excel.");
      return;
    }

    const intervalsStr = buildIntervals();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes_ns", lanesNS);
    formData.append("lanes_sn", lanesSN);
    formData.append("intervals", intervalsStr);

    try {
      const res = await fetch("/api/process?format=xlsx", { method: "POST", body: formData });
      if (!res.ok) {
        showNotification("error", "Descarga fallida", "No se pudo generar el archivo Excel. Contacte al desarrollador.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resumen_intervalos.xlsx";
      a.click();
    } catch (e) {
      showNotification("error", "Error de descarga", "Ocurrió un problema al descargar el archivo.");
    }
  };

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

  return (
    <App>
      {contextHolder}
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <Typography.Title level={3}>Procesar archivo de Tráfico</Typography.Title>
        <Typography.Paragraph type="secondary">
          Suba un archivo CSV o XLSX con los datos de tráfico. Ingrese los carriles
          y los rangos horarios que desea analizar.
        </Typography.Paragraph>

        <Card bordered size="default">
          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Archivo">
                  <Upload beforeUpload={(f) => { setFile(f); return false; }} maxCount={1} accept=".csv,.xlsx">
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
              <Button onClick={downloadExcel} disabled={!file || loading}>Descargar Excel</Button>
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
