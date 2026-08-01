import { Layout, theme, message } from "antd";
import { useMount } from "ahooks";
import { AppHeader } from "@/components/Layout";
import Editor from "@/editor/Editor";

const { Content } = Layout;

export default function App() {
  const { token } = theme.useToken();

  useMount(() => {
    message.success("编辑器已加载，从顶部拖入组件到画布");
  });

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <AppHeader />
      <Content style={{ flex: 1, overflow: "hidden", background: token.colorBg }}>
        <Editor />
      </Content>
    </Layout>
  );
}
