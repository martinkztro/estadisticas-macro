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
  CloseOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  extraerColumnasDisponibles,
  extraerZoneIdsDisponibles,
  procesarArchivoCSV,
  sugerirMapeoColumnas,
} from "@/lib/procesarExcelJS";
import styles from "./page.module.css";

export default function Home() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [rangeStart, setRangeStart] = useState("00:00");
  const [rangeEnd, setRangeEnd] = useState("23:59");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [zoneIdsArchivo, setZoneIdsArchivo] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [columnMap, setColumnMap] = useState({ utc: "", zoneId: "", numVeh: "" });
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const notify = (type, msg) => {
    messageApi[type](msg);
  };

  const handleFileSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setResults([]);
      setSelectedDates([]);
      setSelectedZones([]);
      try {
        const columnas = await extraerColumnasDisponibles(selectedFile);
        const sugerido = sugerirMapeoColumnas(columnas);
        setAvailableColumns(columnas);
        setColumnMap(sugerido);

        const zonas = await extraerZoneIdsDisponibles(selectedFile, sugerido);
        setZoneIdsArchivo(zonas);
      } catch (err) {
        console.error(err);
        setAvailableColumns([]);
        setColumnMap({ utc: "", zoneId: "", numVeh: "" });
        setZoneIdsArchivo([]);
        notify("warning", "No se pudieron detectar columnas del archivo automáticamente");
      }
    }
  };

  const handleFileClick = () => {
    const fileInput = document.getElementById("file-upload");
    if (fileInput) {
      fileInput.value = "";
      fileInput.click();
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setFileName("");
    setResults([]);
    setSelectedDates([]);
    setSelectedZones([]);
    setZoneIdsArchivo([]);
    setAvailableColumns([]);
    setColumnMap({ utc: "", zoneId: "", numVeh: "" });
    setIsMappingModalOpen(false);

    const fileInput = document.getElementById("file-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleApplyColumnMapping = async () => {
    if (!file) return;
    try {
      const zonas = await extraerZoneIdsDisponibles(file, columnMap);
      setZoneIdsArchivo(zonas);
      setSelectedZones([]);
      setIsMappingModalOpen(false);
      notify("success", "Mapeo de columnas actualizado");
    } catch (err) {
      console.error(err);
      notify("error", "No se pudo aplicar el mapeo de columnas");
    }
  };

  const handleProcessing = async () => {
    if (!file) {
      notify("warning", "Por favor, selecciona un archivo");
      return;
    }

    setLoading(true);
    setResults([]);
    setSelectedDates([]);
    setSelectedZones([]);

    try {
      const data = await procesarArchivoCSV(file, [], [], [[rangeStart, rangeEnd]], columnMap);
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
    if (!filteredResults || filteredResults.length === 0) {
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
            rows: filteredResults.map((r) => [r.Zona, r.Fecha, r.Intervalo, r.Total_vehiculos]),
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

  const availableDates = [...new Set(results.map((r) => r.Fecha))].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
  });
  const hasMultipleDates = availableDates.length > 1;
  const allDatesValue = "__ALL_DATES__";
  const dateOptions = [
    { label: "Todas las fechas", value: allDatesValue },
    ...availableDates.map((fecha) => ({ label: fecha, value: fecha })),
  ];
  const availableZones =
    zoneIdsArchivo.length > 0
      ? zoneIdsArchivo.map(String)
      : [...new Set(results.map((r) => String(r.Zona)))].sort((a, b) => Number(a) - Number(b));
  const hasMultipleZones = availableZones.length > 1;
  const allZonesValue = "__ALL_ZONES__";
  const zoneOptions = [
    { label: "Todas las zonas", value: allZonesValue },
    ...availableZones.map((zona) => ({ label: zona, value: zona })),
  ];

  const dateFilteredResults =
    selectedDates.length > 0 && !selectedDates.includes(allDatesValue)
      ? results.filter((r) => selectedDates.includes(r.Fecha))
      : results;
  const filteredResults =
    selectedZones.length > 0 && !selectedZones.includes(allZonesValue)
      ? dateFilteredResults.filter((r) => selectedZones.includes(String(r.Zona)))
      : dateFilteredResults;

  const totalVehicles = filteredResults.reduce((sum, r) => sum + r.Total_vehiculos, 0);
  const uniqueDates = new Set(filteredResults.map((r) => r.Fecha)).size;
  const uniqueZones = availableZones.length;

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
                <h1>Sistema de Aforo Vehicular</h1>
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
                  {fileName && (
                    <div className={styles.fileMetaRow}>
                      <div className={styles.fileMetaLeft}>
                        <span className={styles.fileName}>✓ {fileName}</span>
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={handleClearFile}
                          aria-label="Quitar archivo actual"
                        />
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => setIsMappingModalOpen(true)}
                        aria-label="Configurar mapeo de columnas"
                      >
                        Mapear columnas
                      </Button>
                    </div>
                  )}
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
                  disabled={!file}
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
              {(hasMultipleDates || hasMultipleZones) && (
                <Card className={styles.tableCard} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    {hasMultipleDates && (
                      <>
                        <strong>Filtrar fechas:</strong>
                        <Select
                          mode="multiple"
                          allowClear
                          style={{ minWidth: 280 }}
                          placeholder="Todas las fechas"
                          value={selectedDates}
                          onChange={(values) => {
                            if (values.includes(allDatesValue)) {
                              setSelectedDates([allDatesValue]);
                              return;
                            }
                            setSelectedDates(values);
                          }}
                          options={dateOptions}
                        />
                      </>
                    )}

                    {hasMultipleZones && (
                      <>
                        <strong>Filtrar zonas:</strong>
                        <Select
                          mode="multiple"
                          allowClear
                          style={{ minWidth: 280 }}
                          placeholder="Todas las zonas"
                          value={selectedZones}
                          onChange={(values) => {
                            if (values.includes(allZonesValue)) {
                              setSelectedZones([allZonesValue]);
                              return;
                            }
                            setSelectedZones(values);
                          }}
                          options={zoneOptions}
                        />
                      </>
                    )}
                  </div>
                </Card>
              )}

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
                    title="Zonas en archivo"
                    value={uniqueZones}
                    prefix={<EnvironmentOutlined />}
                    valueStyle={{ color: "#faad14" }}
                  />
                </Card>
                <Card className={styles.statCard}>
                  <Statistic
                    title="Registros procesados"
                    value={filteredResults.length}
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
                  dataSource={filteredResults}
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
                description="Selecciona un archivo para comenzar"
                style={{ marginTop: "60px" }}
              />
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          © 2026 Martin Castro. Todos los derechos reservados.
        </footer>
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

      <Modal
        title="Mapeo de columnas"
        open={isMappingModalOpen}
        onCancel={() => setIsMappingModalOpen(false)}
        onOk={handleApplyColumnMapping}
        okText="Aplicar"
        cancelText="Cancelar"
      >
        <div className={styles.mappingGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Fecha/Hora</label>
            <Select
              showSearch
              allowClear
              placeholder="Selecciona columna"
              value={columnMap.utc || undefined}
              onChange={(value) => setColumnMap((prev) => ({ ...prev, utc: value || "" }))}
              options={availableColumns.map((c) => ({ label: c, value: c }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>ZoneId</label>
            <Select
              showSearch
              allowClear
              placeholder="Selecciona columna"
              value={columnMap.zoneId || undefined}
              onChange={(value) => setColumnMap((prev) => ({ ...prev, zoneId: value || "" }))}
              options={availableColumns.map((c) => ({ label: c, value: c }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Vehículos</label>
            <Select
              showSearch
              allowClear
              placeholder="Selecciona columna"
              value={columnMap.numVeh || undefined}
              onChange={(value) => setColumnMap((prev) => ({ ...prev, numVeh: value || "" }))}
              options={availableColumns.map((c) => ({ label: c, value: c }))}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
