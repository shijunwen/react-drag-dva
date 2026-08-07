import { useState } from "react";
import { Segmented, Typography } from "antd";
import { ThunderboltOutlined, SettingOutlined } from "@ant-design/icons";
import DefaultDemo from "./DefaultDemo";
import CustomDemo from "./CustomDemo";

const { Text } = Typography;

const DEMOS = [
  {
    value: "default",
    label: "默认",
    icon: <ThunderboltOutlined />,
    tip: "开箱即用 — 默认组件树 + 默认属性面板",
    Component: DefaultDemo,
  },
  {
    value: "custom",
    label: "自定义",
    icon: <SettingOutlined />,
    tip: "全定制 — 自定义面板 + 自定义元素 + Inspector",
    Component: CustomDemo,
  },
];

const SWITCHER_STYLE = {
  position: "fixed",
  top: 12,
  right: 16,
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "var(--color-layer, #fff)",
  padding: "4px 8px 4px 16px",
  borderRadius: 10,
  boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
};

const SEGMENTED_OPTIONS = DEMOS.map((d) => ({
  value: d.value,
  icon: d.icon,
  label: d.label,
}));

export default function App() {
  const [demo, setDemo] = useState("default");

  const active = DEMOS.find((d) => d.value === demo) ?? DEMOS[0];
  const ActiveComponent = active.Component;

  return (
    <>
      <div style={SWITCHER_STYLE}>
        <Segmented
          size="small"
          value={demo}
          options={SEGMENTED_OPTIONS}
          onChange={setDemo}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {active.tip}
        </Text>
      </div>
      <ActiveComponent />
    </>
  );
}
