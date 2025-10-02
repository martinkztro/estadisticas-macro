"use client";
import React from "react";
import { ConfigProvider, theme } from "antd";

const { defaultAlgorithm } = theme;

export default function AntdProvider({ children }) {
  return (
    <ConfigProvider
      theme={{
        // always use the default (light) algorithm regardless of system
        algorithm: [defaultAlgorithm],
      }}
    >
      <div style={{ minHeight: "100vh", background: undefined }}>
        {children}
      </div>
    </ConfigProvider>
  );
}
