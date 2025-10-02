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
} from "antd";
import { UploadOutlined } from "@ant-design/icons";

export default function Home() {
  const [file, setFile] = useState(null);
  const [lanes, setLanes] = useState("");
  // separate time ranges with defaults
  const [morningFrom, setMorningFrom] = useState("05:00");
  const [morningTo, setMorningTo] = useState("10:00");
  const [afternoonFrom, setAfternoonFrom] = useState("13:00");
  const [afternoonTo, setAfternoonTo] = useState("16:00");
  const [nightFrom, setNightFrom] = useState("16:00");
  const [nightTo, setNightTo] = useState("22:00");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const buildIntervals = () => {
    const ranges = [];
    if (morningFrom && morningTo) ranges.push(`${morningFrom}-${morningTo}`);
    if (afternoonFrom && afternoonTo) ranges.push(`${afternoonFrom}-${afternoonTo}`);
    if (nightFrom && nightTo) ranges.push(`${nightFrom}-${nightTo}`);
    return ranges.join(",");
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults([]);

    const intervalsStr = buildIntervals();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes", lanes);
    formData.append("intervals", intervalsStr);

    try {
      const res = await fetch("/api/process", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Error processing file");
        setLoading(false);
        return;
      }

      const json = await res.json();
      setResults(json.data || []);
    } catch (e) {
      setError(e.message || "Error processing file");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!file) return;
    const intervalsStr = buildIntervals();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes", lanes);
    formData.append("intervals", intervalsStr);
    const res = await fetch("/api/process?format=xlsx", { method: "POST", body: formData });
    if (!res.ok) return setError("Error downloading Excel");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resumen_intervalos.xlsx";
    a.click();
  };

  // Group results by Fecha
  const grouped = results.reduce((acc, item) => {
    (acc[item.Fecha] = acc[item.Fecha] || []).push(item);
    return acc;
  }, {});

  const columns = results && results.length > 0
    ? Object.keys(results[0]).map((k) => ({ title: k.replaceAll("_", " "), dataIndex: k, key: k }))
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Typography.Title level={3} style={{ marginBottom: 8 }}>Procesar archivo de Tráfico</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Suba un archivo CSV o XLSX con los datos de tráfico. Seleccione los rangos horarios que desea analizar.
      </Typography.Paragraph>

      <Card bordered size="default" style={{ marginTop: 16 }}>
        <Form layout="vertical">
          <Row gutter={16} align="middle">
            <Col span={12}>
              <Form.Item label="Archivo">
                <Upload beforeUpload={(f) => { setFile(f); return false; }} maxCount={1} accept=".csv,.xlsx">
                  <Button icon={<UploadOutlined />}>Seleccionar archivo</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Carriles (ej: 1,2,3)">
                <Input value={lanes} onChange={(e) => setLanes(e.target.value)} placeholder="1,2,3" />
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

          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col>
              <Space>
                <Button type="primary" onClick={handleUpload} disabled={!file || loading}>
                  {loading ? <Spin /> : "Procesar"}
                </Button>
                <Button onClick={downloadExcel} disabled={!file || loading}>Descargar Excel</Button>
              </Space>
            </Col>
          </Row>

          {error && <Alert style={{ marginTop: 16 }} message="Error" description={error} type="error" showIcon />}
        </Form>
      </Card>

      {results && results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Typography.Title level={4}>Resultados</Typography.Title>
          <Collapse accordion items={Object.keys(grouped).map((fecha) => ({
            key: fecha,
            label: (
              <Row align="middle" gutter={8}>
                <Col>
                  <Tag color="blue" style={{ fontWeight: 700 }}>{fecha}</Tag>
                </Col>
                <Col>
                  <Tag color="green">{grouped[fecha].length} intervalos</Tag>
                </Col>
              </Row>
            ),
            children: (
              <Card size="small" style={{ background: '#fafafa', border: 'none' }}>
                <Table
                  dataSource={grouped[fecha]}
                  columns={columns}
                  rowKey={(r) => `${r.Intervalo}-${r.Carriles}`}
                  pagination={false}
                />
              </Card>
            ),
          }))}>
          </Collapse>
        </div>
      )}
    </div>
  );
}
