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
  const [messages, setMessages] = useState([]);

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
    setMessages([]);

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
        setError(json.error || "Error procesando archivo");
        setLoading(false);
        return;
      }

      setResults(json.data || []);
      setMessages(json.messages || []);
    } catch (e) {
      setError(e.message || "Error procesando archivo");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!file) return;
    const intervalsStr = buildIntervals();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lanes_ns", lanesNS);
    formData.append("lanes_sn", lanesSN);
    formData.append("intervals", intervalsStr);
    const res = await fetch("/api/process?format=xlsx", { method: "POST", body: formData });
    if (!res.ok) return setError("Error descargando Excel");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resumen_intervalos.xlsx";
    a.click();
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

  // Info de intersecciones
  const laneInfo = [
    {
      title: "FORJADORES - JALISCO",
      ns: "Carriles 4, 5 y 6",
      sn: "Carriles 1, 2 y 3",
    },
    {
      title: "FORJADORES - COLOSIO",
      ns: "Carriles 1, 2 y 3",
      sn: "Carriles 4, 5 y 6",
    },
    {
      title: "FORJADORES - SIERRA DE LAS VIRGENES",
      ns: "Carriles 1, 2 y 3",
      sn: "Carriles 5, 6 y 7",
    },
    {
      title: "FORJADORES - UABCS",
      ns: "Carriles 1, 2 y 3",
      sn: "Carriles 4, 5 y 6",
    },
    {
      title: "FORJADORES - UNION",
      ns: "Carriles 1, 2 y 3",
      sn: "Carriles 4, 5 y 6",
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Typography.Title level={3} style={{ marginBottom: 8 }}>
        Procesar archivo de Tráfico
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Suba un archivo CSV o XLSX con los datos de tráfico. Ingrese los carriles
        para ambas direcciones y seleccione los rangos horarios que desea analizar.
      </Typography.Paragraph>

      <Card bordered size="default" style={{ marginTop: 16 }}>
        <Form layout="vertical">
          <Row gutter={16} align="middle">
            <Col span={12}>
              <Form.Item label="Archivo">
                <Upload
                  beforeUpload={(f) => {
                    setFile(f);
                    return false;
                  }}
                  maxCount={1}
                  accept=".csv,.xlsx"
                >
                  <Button icon={<UploadOutlined />}>Seleccionar archivo</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={
                  <Space>
                    Carriles Norte → Sur
                    <Tooltip title="Ingrese los números de carril que se mueven de Norte a Sur">
                      <InfoCircleOutlined style={{ color: "#1677ff" }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Input
                  value={lanesNS}
                  onChange={(e) => setLanesNS(e.target.value)}
                  placeholder="Ej: 1,2,3"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    Carriles Sur → Norte
                    <Tooltip title="Ingrese los números de carril que se mueven de Sur a Norte">
                      <InfoCircleOutlined style={{ color: "#722ed1" }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Input
                  value={lanesSN}
                  onChange={(e) => setLanesSN(e.target.value)}
                  placeholder="Ej: 4,5,6"
                />
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
                <Button onClick={downloadExcel} disabled={!file || loading}>
                  Descargar Excel
                </Button>
              </Space>
            </Col>
          </Row>

          {messages.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {messages.map((msg, i) => (
                <Alert
                  key={i}
                  message={msg.type === "success" ? "Éxito" : msg.type === "warning" ? "Advertencia" : msg.type === "error" ? "Error" : "Información"}
                  description={msg.message}
                  type={msg.type}
                  showIcon
                  style={{ marginBottom: 8 }}
                />
              ))}
            </div>
          )}

          {error && (
            <Alert
              style={{ marginTop: 16 }}
              message="Error"
              description={error}
              type="error"
              showIcon
            />
          )}
        </Form>
      </Card>

      {/* 🟩 Guía informativa de carriles */}
      <Card
        title="Guía informativa de carriles por intersección"
        style={{
          marginTop: 24,
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
              <Row justify="space-between" align="middle">
                <Col>
                  <Tag
                    color="blue"
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      padding: "4px 10px",
                      borderRadius: 8,
                    }}
                  >
                    {info.title}
                  </Tag>
                </Col>
              </Row>
            ),
            children: (
              <div
                style={{
                  padding: "12px 18px",
                  background: "#fafafa",
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <Row gutter={[16, 12]}>
                  <Col span={24}>
                    <Space direction="vertical" size="small" style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 15,
                          lineHeight: 1.8,
                        }}
                      >
                        <Tag
                          color="purple"
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Norte → Sur
                        </Tag>
                        <span>{info.ns}</span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 15,
                          lineHeight: 1.8,
                        }}
                      >
                        <Tag
                          color="green"
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Sur → Norte
                        </Tag>
                        <span>{info.sn}</span>
                      </div>
                    </Space>
                  </Col>
                </Row>
              </div>
            ),
          }))}
        />
      </Card>


      {results && results.length > 0 && (
        <div style={{ marginTop: 20 }}>
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
                    <Col>
                      <Tag color="blue" style={{ fontWeight: 700 }}>
                        {fechaCompleta}
                      </Tag>
                    </Col>
                    <Col>
                      <Tag color="purple">{direccion}</Tag>
                    </Col>
                    <Col>
                      <Tag color="green">{grouped[key].length} intervalos</Tag>
                    </Col>
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
    </div>
  );
}
