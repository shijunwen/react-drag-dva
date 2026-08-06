import { Layout, theme } from "antd";
import { AppHeader } from "@/components/Layout";
import { CustomElements } from "./CustomElements";
import { CustomLeftPanel } from "./CustomLeftPanel";
import { CustomRightPanel } from "./CustomRightPanel";
import Editor from "@/editor/Editor";

const { Content } = Layout;

const LAYOUT_STYLE = { height: "100vh", overflow: "hidden" };

export default function App() {
  const { token } = theme.useToken();

  return (
    <Layout style={LAYOUT_STYLE}>
      <Content
        style={{ flex: 1, overflow: "hidden", background: token.colorBg }}
      >
        <Editor
          leftPanel={<CustomLeftPanel />}
          leftPanelTitle="图层"
          rightPanel={<CustomRightPanel />}
          rightPanelTitle="配置"
        >
          <AppHeader />
          <CustomElements />
        </Editor>
      </Content>
    </Layout>
  );
}
