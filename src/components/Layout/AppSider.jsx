import { memo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Layout, Menu, theme } from "antd";
import { collapsedAtom, selectedMenuAtom } from "@/atoms/layout";
import { MENU_ITEMS } from "@/config/menu";

const { Sider } = Layout;

const LOGO_COLLAPSED = "L";
const LOGO_EXPANDED = "Logo";

function AppSiderInner() {
  const collapsed = useAtomValue(collapsedAtom);
  const [selectedKey, setSelectedKey] = useAtom(selectedMenuAtom);
  const { token } = theme.useToken();

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={200}
      collapsedWidth={60}
      style={{
        background: token.colorBgElevated,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? 0 : "0 24px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: token.colorPrimary,
            overflow: "hidden",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
        >
          {collapsed ? LOGO_COLLAPSED : LOGO_EXPANDED}
        </span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={({ key }) => setSelectedKey(key)}
        items={MENU_ITEMS}
        style={{ border: "none", background: "transparent" }}
      />
    </Sider>
  );
}

export const AppSider = memo(AppSiderInner);