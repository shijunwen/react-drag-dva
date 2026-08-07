import { Layout, theme } from "antd";
import { AppHeader } from "@/components/Layout";
import { CustomElements } from "./CustomElements";
import { CustomLeftPanel } from "./CustomLeftPanel";
import { CustomRightPanel } from "./CustomRightPanel";
import Editor from "@/editor/Editor";

const { Content } = Layout;

const LAYOUT_STYLE = { height: "100vh", overflow: "hidden" };

/**
 * 自定义配置 Demo — 展示全部扩展能力。
 *
 * - leftPanel: 自定义图层面板(选中检视/顶层元素列表/行内锁定删除)
 * - rightPanel: 自定义属性面板(位置尺寸/改名/锁定隐藏/复制删除)
 * - children: 顶部工具栏 + 自定义可拖入元素(统计卡片)
 * - 所有自定义面板均处于 Editor 的 Jotai Provider / DndContext 内，
 *   useEditor() 直接可用，与画布双向联动。
 */
export default function CustomDemo() {
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
