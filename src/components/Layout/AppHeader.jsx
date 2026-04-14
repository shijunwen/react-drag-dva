import { memo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Layout, Button, Dropdown, theme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, BellOutlined } from "@ant-design/icons";
import { collapsedAtom, toggleCollapsedAtom, selectedMenuAtom } from "@/atoms/layout";
import { MENU_ITEMS, USER_MENU_ITEMS } from "@/config/menu";

const { Header } = Layout;

function AppHeaderInner() {
  const collapsed = useAtomValue(collapsedAtom);
  const toggleCollapsed = useSetAtom(toggleCollapsedAtom);
  const selectedKey = useAtomValue(selectedMenuAtom);
  const { token } = theme.useToken();

  const currentMenu = MENU_ITEMS.find((m) => m.key === selectedKey);

  return (
    <Header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleCollapsed}
        style={{ fontSize: 16 }}
      />
      <span style={{ fontSize: 18, fontWeight: 600 }}>
        {currentMenu?.label || "首页"}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Button type="text" icon={<BellOutlined />} />
        <Dropdown menu={{ items: USER_MENU_ITEMS }} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />}>
            用户
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
}

export const AppHeader = memo(AppHeaderInner);