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
  Typography,
  Row,
  Col,
  Form,
  Divider,
  Switch,
  Collapse,
  Tag,
  Slider,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";

export default function Home() {
  const [file, setFile] = useState(null);
  const [lanesNS, setLanesNS] = useState("");
  const [lanesSN, setLanesSN] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [autoMode, setAutoMode] = useState(false);
  const [hours, setHours] = useState(1);

  // manual intervals
  const [morningFrom, setMorningFrom] = useState("05:00");
  const [morningTo, setMorningTo] = useState("10:00");
  const [afternoonFrom, setAfternoonFrom] = useState("13:00");
  const [afternoonTo, setAfternoonTo] = useState("16:00");
  const [nightFrom, setNightFrom] = useState("16:00");
  const [nightTo, setNightTo] = useState("22:00");

  const buildIntervals = () => {
    const ranges = [];
    if (morningFrom && morningTo) ranges.push(`${morningFrom}-${morningTo}`);
    if (afternoonFrom && afternoonTo) ranges.push(`${afternoonFrom}-${afternoonTo}`);
    if (nightFrom && nightTo) ranges.push(`${nightFrom}-${nightTo}`);
    return ranges.join(",");
  };

  const handleUpload = async (download = false) => {
    if (!file) return setError("Debe seleccionar un archivo.");
    if (!lanesNS && !lanesSN) return setError("Ingrese al menos un grupo de carriles.");
    setLoading(true);
    setError(null);
    setResults([]);

    const intervalsStr = buildIntervals();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes_ns", lanesNS);
    formData.append("lanes_sn", lanesSN);
    formData.append("autoMode", autoMode);
    formData.append("hours", hours);
    if (!autoMode) formData.append("intervals", intervalsStr);

    const endpoint = download ? "/api/process?format=xlsx" : "/api/process";

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (download) {
        if (!res.ok) throw new Error("Error al generar Excel");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resumen_intervalos.xlsx";
        a.click();
      } else {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error procesando archivo");
        setResults(json.data || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const grouped = results.reduce((acc, item) => {
    const key = `${item.Dirección || "Dirección"} - ${item.Fecha}`;
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  const columns =
    results.length > 0
      ? Object.keys(results[0]).map((k) => ({
        title: k.replaceAll("_", " "),
        dataIndex: k,
        key: k,
      }))
      : [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Typography.Title level={3}>Procesar archivo de Tráfico</Typography.Title>
      <Typography.Paragraph type="secondary">
        Usa modo automático para detectar los intervalos de mayor carga en la mañana, tarde y noche.
        En modo manual puedes definir tus propios horarios.
      </Typography.Paragraph>

      <Card bordered style={{ marginTop: 16 }}>
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
              <Form.Item label="Carriles Norte → Sur">
                <Input value={lanesNS} onChange={(e) => setLanesNS(e.target.value)} placeholder="Ej: 1,2,3" />
              </Form.Item>
              <Form.Item label="Carriles Sur → Norte">
                <Input value={lanesSN} onChange={(e) => setLanesSN(e.target.value)} placeholder="Ej: 4,5,6" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row gutter={16}>
            <Col span={12}>
              <Typography.Text strong>Modo automático</Typography.Text>
              <Switch checked={autoMode} onChange={setAutoMode} style={{ marginLeft: 10 }} />
            </Col>
          </Row>

          {autoMode ? (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={16}>
                <Typography.Text>Duración del intervalo (horas): {hours}</Typography.Text>
                <Slider min={1} max={8} step={1} value={hours} onChange={setHours} tooltip={{ open: false }} />
              </Col>
            </Row>
          ) : (
            <>
              <Divider />
              <Typography.Title level={5}>Rangos horarios manuales</Typography.Title>
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
            </>
          )}

          <Row style={{ marginTop: 16 }}>
            <Space>
              <Button type="primary" onClick={() => handleUpload(false)} disabled={!file || loading}>
                {loading ? <Spin /> : "Procesar"}
              </Button>
              <Button onClick={() => handleUpload(true)} disabled={!file || loading}>
                Descargar Excel
              </Button>
            </Space>
          </Row>

          {error && <Alert style={{ marginTop: 16 }} message="Error" description={error} type="error" showIcon />}
        </Form>
      </Card>

      {results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Typography.Title level={4}>Resultados</Typography.Title>
          <Collapse
            accordion
            items={Object.keys(grouped).map((key) => ({
              key,
              label: (
                <Row align="middle" gutter={8}>
                  <Col><Tag color="blue">{key.split(" - ")[1]}</Tag></Col>
                  <Col><Tag color="purple">{key.split(" - ")[0]}</Tag></Col>
                  <Col><Tag color="green">{grouped[key].length} intervalos</Tag></Col>
                </Row>
              ),
              children: (
                <Card size="small" style={{ background: "#fafafa", border: "none" }}>
                  <Table dataSource={grouped[key]} columns={columns} rowKey={(r, i) => i} pagination={false} />
                </Card>
              ),
            }))}
          />
        </div>
      )}
    </div>
  );
}
