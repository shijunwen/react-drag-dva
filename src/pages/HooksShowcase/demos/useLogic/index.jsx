import { Card, Alert, Typography, Tag } from "antd";

const { Paragraph, Text } = Typography;

const LogicDemo = () => (
  <Card title="useLogic" style={{ marginBottom: 16 }}>
    <Alert
      type="warning"
      message="此 Hook 依赖特定组件环境 (useRegisterComponent, triggerEvent)，无法独立演示"
    />
    <Paragraph style={{ marginTop: 8 }}>
      <Text>用途：</Text>注册事件动作定义，提供快捷会议触发功能。
    </Paragraph>
    <Paragraph>
      <Text>返回：</Text>
      <Tag>handleQuickMeeting</Tag> - 触发快捷会议的函数
    </Paragraph>
  </Card>
);

export default LogicDemo;