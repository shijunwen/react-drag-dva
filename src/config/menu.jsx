import { HomeOutlined, CodeOutlined } from "@ant-design/icons";

/** 菜单配置 - 提取为常量避免重复创建 */
export const MENU_ITEMS = [
  { key: "1", icon: <HomeOutlined />, label: "首页" },
  { key: "5", icon: <CodeOutlined />, label: "Hooks" },
];

/** 用户下拉菜单配置 */
export const USER_MENU_ITEMS = [
  { key: "profile", label: "个人中心" },
  { key: "settings", label: "设置" },
  { key: "logout", label: "退出登录" },
];
