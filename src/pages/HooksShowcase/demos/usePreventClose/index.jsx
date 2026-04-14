import { useState } from "react";
import { Card, Button, Space, Alert, Tag } from "antd";
import usePreventClose from "@/hooks/usePreventClose";

const PreventCloseDemo = () => {
  const [shouldPrevent, setShouldPrevent] = useState(false);
  usePreventClose(shouldPrevent, "正在编辑中，确定要离开吗？");

  return (
    <Card title="usePreventClose Demo" style={{ marginBottom: 16 }}>
      <Space>
        <Tag color={shouldPrevent ? "red" : "green"}>
          {shouldPrevent ? "已启用防止关闭" : "未启用防止关闭"}
        </Tag>
        <Button
          type={shouldPrevent ? "primary" : "default"}
          danger={shouldPrevent}
          onClick={() => setShouldPrevent(!shouldPrevent)}
        >
          {shouldPrevent ? "关闭防止" : "启用防止"}
        </Button>
      </Space>

      <Alert
        type="warning"
        message="启用后，刷新或关闭页面时会弹出确认提示"
        style={{ marginTop: 8 }}
      />
    </Card>
  );
};

export default PreventCloseDemo;