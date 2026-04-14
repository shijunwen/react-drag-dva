import { memo } from "react";
import { useAtomValue } from "jotai";
import { selectedMenuAtom } from "@/atoms/layout";

/** 右侧栏内容配置 */
const MENU_INFO_MAP = {
  "1": { title: "快捷操作", items: ["新建项目", "查看日志", "导出数据"] },
  "2": { title: "数据统计", items: ["总计: 3", "进行中: 1", "已完成: 1"] },
  "3": { title: "配置项", items: ["基础设置", "高级设置", "权限管理"] },
  "4": { title: "账户操作", items: ["修改密码", "绑定手机", "实名认证"] },
};

const DEFAULT_INFO = { title: "右侧栏", items: ["附加信息"] };

function SideContentInner() {
  const selectedKey = useAtomValue(selectedMenuAtom);
  const info = MENU_INFO_MAP[selectedKey] || DEFAULT_INFO;

  return (
    <>
      <h3
        style={{
          margin: 0,
          marginBottom: 16,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--color-primary)",
        }}
      >
        {info.title}
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {info.items.map((item, idx) => (
          <li
            key={idx}
            className="interactive"
            style={{
              padding: "10px 0",
              borderBottom: "1px dashed var(--color-border)",
              cursor: "pointer",
              opacity: 0,
              animation: `fade-in-up 250ms ease forwards`,
              animationDelay: `${idx * 50}ms`,
              color: "var(--color-text-muted)",
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </>
  );
}

export default memo(SideContentInner);