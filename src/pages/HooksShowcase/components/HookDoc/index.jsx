import { Card, Typography, Space, Tag, Divider } from "antd";

const { Title, Paragraph, Text } = Typography;

const HookDoc = ({ name, description, api, codeExample }) => (
  <Card
    title={
      <Space>
        <Tag color="blue">{name}</Tag>
        <Text type="secondary">{description}</Text>
      </Space>
    }
    style={{ marginBottom: 16 }}
  >
    <Title level={5}>API</Title>
    <Paragraph>
      <pre
        style={{
          background: "#f6f8fa",
          padding: 16,
          borderRadius: 6,
          overflow: "auto",
        }}
      >
        {api}
      </pre>
    </Paragraph>

    <Divider />

    <Title level={5}>代码示例</Title>
    <Paragraph>
      <pre
        style={{
          background: "#f6f8fa",
          padding: 16,
          borderRadius: 6,
          overflow: "auto",
        }}
      >
        {codeExample}
      </pre>
    </Paragraph>
  </Card>
);

export default HookDoc;