import { useAtomValue } from "jotai";
import { Layout, theme, message } from "antd";
import { useMount } from "ahooks";
import { selectedMenuAtom } from "@/atoms/layout";
import { AppHeader, AppSider } from "@/components/Layout";
import MenuContent from "@/components/MenuContent";
import SideContent from "@/components/SideContent";

const { Sider, Content } = Layout;

export default function App() {
  const selectedKey = useAtomValue(selectedMenuAtom);
  const { token } = theme.useToken();

  useMount(() => {
    message.success("系统已加载完成");
  });

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <AppSider />
      <Layout style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AppHeader />
        <Layout style={{ flex: 1, overflow: "hidden" }}>
          <Content
            style={{
              flex: 1,
              margin: 24,
              padding: 24,
              background: token.colorBgContainer,
              borderRadius: 12,
              overflow: "auto",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <MenuContent selectedKey={selectedKey} />
          </Content>
          <Sider
            width={240}
            style={{
              background: token.colorBgElevated,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              padding: 24,
              overflow: "auto",
            }}
            breakpoint="lg"
            collapsedWidth={0}
            trigger={null}
          >
            <SideContent />
          </Sider>
        </Layout>
      </Layout>
    </Layout>
  );
}