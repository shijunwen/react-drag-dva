import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App.jsx";
import "@/styles/index.less";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#0d9488",
          borderRadius: 6,
          // 与「制图工坊」token 对齐:冷纸底 + 发丝线 + IBM Plex
          colorBgLayout: "#f5f7fa",
          colorBorder: "#e2e8f0",
          colorBorderSecondary: "#eef2f6",
          colorText: "#1e293b",
          colorTextSecondary: "#64748b",
          fontFamily:
            "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);