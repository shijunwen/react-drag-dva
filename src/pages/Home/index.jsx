import { Card, Descriptions } from "antd";
import { useAtomValue } from "jotai";
import { systemInfoAtom } from "@/atoms";

export default function Home() {
  const systemInfo = useAtomValue(systemInfoAtom);

  return (
    <div>
      <h1 style={{ margin: 0, marginBottom: 16 }}>首页</h1>
      <Card>
        <p>欢迎使用系统，这是首页概览内容。</p>
        <Descriptions column={2}>
          <Descriptions.Item label="系统名称">{systemInfo.name}</Descriptions.Item>
          <Descriptions.Item label="版本">{systemInfo.version}</Descriptions.Item>
          <Descriptions.Item label="技术栈">{systemInfo.stack}</Descriptions.Item>
          <Descriptions.Item label="状态">{systemInfo.status}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}