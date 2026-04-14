import { useState } from "react";
import { Card, Button, Space, Alert, Typography } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import useAutoScrolled from "@/hooks/useAutoScrolled";

const { Paragraph } = Typography;

const AutoScrolledDemo = () => {
  const [messages, setMessages] = useState([
    "消息 1: 欢迎使用 useAutoScrolled demo",
    "消息 2: 这是一个自动滚动的演示",
  ]);
  const { contentRef, setUserScrolled } = useAutoScrolled(messages);

  const addMessage = () => {
    setMessages((prev) => [...prev, `消息 ${prev.length + 1}: 新增消息 ${Date.now()}`]);
  };

  const scrollToBottom = () => {
    setUserScrolled(false);
  };

  return (
    <Card title="useAutoScrolled Demo" style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 8 }}>
        <Button icon={<PlayCircleOutlined />} onClick={addMessage}>
          添加消息
        </Button>
        <Button onClick={scrollToBottom}>滚动到底部</Button>
      </Space>

      <div
        ref={contentRef}
        style={{
          height: 200,
          overflow: "auto",
          border: "1px solid #d9d9d9",
          borderRadius: 6,
          padding: 12,
          background: "#fafafa",
        }}
      >
        {messages.map((msg, i) => (
          <Paragraph key={i} style={{ margin: "4px 0" }}>
            {msg}
          </Paragraph>
        ))}
      </div>

      <Alert
        type="info"
        message="说明：当内容更新时自动滚动到底部，用户手动向上滚动时会停止自动滚动"
        style={{ marginTop: 8 }}
      />
    </Card>
  );
};

export default AutoScrolledDemo;