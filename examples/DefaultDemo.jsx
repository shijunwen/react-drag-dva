import { Layout, theme } from "antd";
import { AppHeader } from "@/components/Layout";
import Editor from "@/editor/Editor";

const { Content } = Layout;

const LAYOUT_STYLE = { height: "100vh", overflow: "hidden" };

/**
 * 默认 Demo — 开箱即用。
 *
 * - 不传 leftPanel / rightPanel，自动渲染默认组件树 + 默认属性面板
 * - 顶部工具栏(AppHeader)通过 children 注入，内联在 <Editor> 的 Provider 中
 * - 无需任何配置即可拖拽、移动、缩放、分组
 */
export default function DefaultDemo() {
  const { token } = theme.useToken();

  return (
    <Layout style={LAYOUT_STYLE}>
      <Content
        style={{ flex: 1, overflow: "hidden", background: token.colorBg }}
      >
        <Editor>
          <AppHeader />
        </Editor>
      </Content>
    </Layout>
  );
}
