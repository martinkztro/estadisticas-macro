"use client";
import React, { useEffect } from "react";
import { ConfigProvider, theme } from "antd";

const { defaultAlgorithm } = theme;

export default function AntdProvider({ children }) {
  useEffect(() => {
    // Suprimir advertencia de Ant Design en React 19 a nivel de useEffect
    const originalWarn = console.warn;
    const originalError = console.error;

    const isAntdMsg = (msg) => {
      if (!msg) return false;
      const str = msg?.toString?.() || "";
      return (
        str.includes("antd") ||
        str.includes("React is 16") ||
        str.includes("compatible") ||
        str.includes("[antd:")
      );
    };

    console.warn = (...args) => {
      if (!isAntdMsg(args[0])) originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (!isAntdMsg(args[0])) originalError.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: [defaultAlgorithm],
      }}
    >
      <div style={{ minHeight: "100vh", background: undefined }}>
        {children}
      </div>
    </ConfigProvider>
  );
}
