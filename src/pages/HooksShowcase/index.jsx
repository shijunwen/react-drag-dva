import { useState } from "react";
import { Tabs, Typography, Space, Tag, Divider } from "antd";
import {
  CopyOutlined,
  VerticalAlignBottomOutlined,
  CloseCircleOutlined,
  AudioOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import HookDoc from "./components/HookDoc";
import {
  AutoScrolledDemo,
  PreventCloseDemo,
  RecordingDemo,
  LogicDemo,
  UploadDemo,
} from "./demos";
import { HOOKS_CONFIG } from "./config";
import styles from "./styles.module.less";

const { Title, Paragraph } = Typography;

const ICON_MAP = {
  VerticalAlignBottomOutlined,
  CloseCircleOutlined,
  AudioOutlined,
  ThunderboltOutlined,
  UploadOutlined,
};

const DEMO_MAP = {
  useAutoScrolled: AutoScrolledDemo,
  usePreventClose: PreventCloseDemo,
  useRecording: RecordingDemo,
  useLogic: LogicDemo,
  useUpload: UploadDemo,
};

const HooksShowcase = () => {
  const [activeKey, setActiveKey] = useState("useAutoScrolled");

  const items = HOOKS_CONFIG.map((hook) => {
    const IconComponent = ICON_MAP[hook.icon];
    const DemoComponent = DEMO_MAP[hook.key];

    return {
      key: hook.key,
      label: (
        <Space size={4}>
          <IconComponent />
          <span>{hook.label}</span>
        </Space>
      ),
      children: (
        <div>
          {hook.api && (
            <HookDoc
              name={hook.label}
              description={hook.description}
              api={hook.api}
              codeExample={hook.codeExample}
            />
          )}
          <DemoComponent />
        </div>
      ),
    };
  });

  return (
    <div className={styles["hooks-showcase"]}>
      <div className={styles["hooks-header"]}>
        <Title level={3}>
          <Space>
            <CopyOutlined />
            Hooks 集合
          </Space>
        </Title>
        <Paragraph type="secondary">
          本项目封装的自定义 Hooks，参考 ahooks 设计风格
        </Paragraph>
        <Divider />
      </div>

      <Tabs
        className={styles["hooks-tabs"]}
        activeKey={activeKey}
        onChange={setActiveKey}
        items={items}
        tabBarExtraContent={
          <Space>
            {HOOKS_CONFIG.map((h) => (
              <Tag
                key={h.key}
                color={h.color}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveKey(h.key)}
              >
                {h.label}
              </Tag>
            ))}
          </Space>
        }
      />
    </div>
  );
};

export default HooksShowcase;