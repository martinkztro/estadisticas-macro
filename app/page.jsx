"use client";
import { useState } from "react";
import {
  Button,
  Input,
  Table,
  Spin,
  Card,
  Tag,
  Empty,
  Drawer,
  Statistic,
  Space,
  message,
  Modal,
  Select,
} from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  CarOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { procesarArchivoCSV } from "@/lib/procesarExcelJS";
import styles from "./page.module.css";

export default function Home() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [zones, setZones] = useState("");
  const [rangeStart, setRangeStart] = useState("00:00");
  const [rangeEnd, setRangeEnd] = useState("23:59");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const notify = (type, msg) => {
    messageApi[type](msg);
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const handleFileClick = () => {
    const fileInput = document.getElementById("file-upload");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleProcessing = async () => {
    if (!file) {
      notify("warning", "Por favor, selecciona un archivo");
      return;
    }
    if (!zones.trim()) {
      notify("warning", "Por favor, ingresa al menos un ZoneId");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const zonesArr = zones
        .split(",")
        .map((z) => parseInt(z.trim()))
        .filter((z) => !isNaN(z));

      if (zonesArr.length === 0) {
        notify("error", "Los ZoneId deben ser números separados por comas");
        setLoading(false);
        return;
      }

      const data = await procesarArchivoCSV(file, [], zonesArr, [[rangeStart, rangeEnd]]);
      setResults(data);

      if (data.length === 0) {
        notify("info", "No se encontraron datos con los filtros aplicados");
      } else {
        notify("success", `${data.length} registros procesados correctamente`);
      }
    } catch (err) {
      console.error(err);
      notify("error", `Error: ${err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!results || results.length === 0) {
      notify("info", "No hay datos para exportar");
      return;
    }

    let fileName = "reporte_trafico";
    modalApi.confirm({
      title: "Descargar reporte en Excel",
      content: (
        <Input
          placeholder="Nombre del archivo (sin extensión)"
          defaultValue={fileName}
          onChange={(e) => (fileName = e.target.value)}
        />
      ),
      okText: "Descargar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const ExcelJS = await import("exceljs");
          const wb = new ExcelJS.Workbook();
          const ws = wb.addWorksheet("Tráfico");

          const headers = ["Zona", "Fecha", "Hora", "Vehículos"];
          ws.addTable({
            name: "TraficTable",
            ref: "A1",
            headerRow: true,
            columns: headers.map((h) => ({ name: h })),
            rows: results.map((r) => [r.Zona, r.Fecha, r.Intervalo, r.Total_vehiculos]),
            style: { theme: "TableStyleMedium2" },
          });

          ws.columns.forEach((col) => (col.width = 18));

          const buffer = await wb.xlsx.writeBuffer();
          const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const date = new Date().toISOString().split("T")[0];
          const finalName = `${fileName || "reporte_trafico"}_${date}.xlsx`;

          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = finalName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);

          notify("success", `Archivo descargado: ${finalName}`);
        } catch (err) {
          notify("error", "Error al generar Excel");
        }
      },
    });
  };

  const tableColumns = [
    {
            title: "📍 Zona",
            dataIndex: "Zona",
            key: "Zona",
            width: 80,
            render: (zona) => <Tag color="blue">{zona}</Tag>,
          },
          {
      title: "� Fecha",
      dataIndex: "Fecha",
      key: "Fecha",
      width: 120,
    },
    {
      title: "⏰ Hora",
      dataIndex: "Intervalo",
      key: "Intervalo",
      width: 100,
    },
    {
      title: "🚗 Vehículos",
      dataIndex: "Total_vehiculos",
      key: "Total_vehiculos",
      width: 120,
      render: (num) => (
        <span style={{ fontWeight: "bold", fontSize: "16px", color: "#003366" }}>
          {num}
        </span>
      ),
    },
  ];

  const totalVehicles = results.reduce((sum, r) => sum + r.Total_vehiculos, 0);
  const uniqueDates = new Set(results.map((r) => r.Fecha)).size;
  const uniqueZones = new Set(results.map((r) => r.Zona)).size;

  return (
    <>
      {contextHolder}
      {modalContextHolder}

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleSection}>
              <CarOutlined className={styles.titleIcon} />
              <div>
                <h1>Análisis de Tráfico Vehicular</h1>
                <p>Sistema de procesamiento y análisis de datos de aforos por zona horaria</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          <div className={styles.formSection}>
            <Card className={styles.formCard}>
              <div className={styles.formGrid}>
                {/* Upload Section */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <UploadOutlined /> Archivo de datos (CSV/XLSX)
                  </label>
                  <div className={styles.fileInput}>
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileSelect}
                      id="file-upload"
                      style={{ display: "none" }}
                    />
                    <Button 
                      icon={<UploadOutlined />} 
                      block
                      onClick={handleFileClick}
                    >
                      {fileName || "Seleccionar archivo"}
                    </Button>
                  </div>
                  {fileName && <span className={styles.fileName}>✓ {fileName}</span>}
                </div>

                {/* Zones Section */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <EnvironmentOutlined /> ZoneId a analizar
                  </label>
                  <Input
                    placeholder="Ej: 1,2,3,4,5"
                    value={zones}
                    onChange={(e) => setZones(e.target.value)}
                    size="large"
                  />
                  <small style={{ color: "#999" }}>Ingresa los números de ZoneId separados por comas</small>
                </div>

                {/* Time Range */}
                <div className={styles.timeRange}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <ClockCircleOutlined /> Hora inicio
                    </label>
                    <Input
                      type="time"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      size="large"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Hora fin</label>
                    <Input
                      type="time"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      size="large"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.actions}>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleProcessing}
                  loading={loading}
                  disabled={!file || !zones.trim()}
                  block
                >
                  {loading ? "Procesando..." : "Analizar datos"}
                </Button>
                <Button
                  type="default"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={downloadExcel}
                  disabled={results.length === 0}
                  block
                >
                  Descargar Excel
                </Button>
              </div>
            </Card>
          </div>

          {/* Results Section */}
          {results.length > 0 && (
            <div className={styles.resultsSection}>
              {/* Stats */}
              <div className={styles.statsGrid}>
                <Card className={styles.statCard}>
                  <Statistic
                    title="Total de vehículos"
                    value={totalVehicles}
                    prefix={<CarOutlined />}
                    valueStyle={{ color: "#1677ff" }}
                  />
                </Card>
                <Card className={styles.statCard}>
                  <Statistic
                    title="Fechas analizadas"
                    value={uniqueDates}
                    prefix={<DatabaseOutlined />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
                <Card className={styles.statCard}>
                  <Statistic
                    title="Zonas monitoreadas"
                    value={uniqueZones}
                    prefix={<EnvironmentOutlined />}
                    valueStyle={{ color: "#faad14" }}
                  />
                </Card>
                <Card className={styles.statCard}>
                  <Statistic
                    title="Registros procesados"
                    value={results.length}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: "#722ed1" }}
                  />
                </Card>
              </div>

              {/* Table */}
              <Card className={styles.tableCard}>
                <h3 style={{ marginBottom: "16px" }}>Detalle de aforos por hora</h3>
                <Table
                  columns={tableColumns}
                  dataSource={results}
                  rowKey={(r, i) => `${r.Zona}-${r.Fecha}-${r.Intervalo}-${i}`}
                  pagination={uniqueZones > 1 ? { pageSize: 20, position: ["bottomCenter"] } : false}
                  scroll={{ x: 600 }}
                  size="middle"
                />
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!loading && results.length === 0 && (
            <div className={styles.emptyState}>
              <Empty
                description="Selecciona un archivo y zonas para comenzar"
                style={{ marginTop: "60px" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer
        title="Detalle del registro"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        placement="right"
      >
        {selectedRecord && (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div>
              <strong>Zona:</strong>
              <p>{selectedRecord.Carriles}</p>
            </div>
            <div>
              <strong>Fecha:</strong>
              <p>{selectedRecord.Fecha}</p>
            </div>
            <div>
              <strong>Rango horario:</strong>
              <p>{selectedRecord.Intervalo}</p>
            </div>
            <div>
              <strong>Cantidad de vehículos:</strong>
              <p style={{ fontSize: "18px", fontWeight: "bold", color: "#1677ff" }}>
                {selectedRecord.Total_vehiculos}
              </p>
            </div>
            <div>
              <strong>Dirección:</strong>
              <p>{selectedRecord.Dirección}</p>
            </div>
          </Space>
        )}
      </Drawer>
    </>
  );
}
