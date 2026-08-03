import { memo } from "react";
import { Slider } from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import DraggableElement from "@/editor/DraggableElement";
import styles from "./CustomElements.module.less";

const StatCard = memo(function StatCard({ el }) {
  return (
    <div className={styles.statCard}>
      <span
        className={styles.statValue}
        style={{ fontSize: el.props.size }}
      >
        {el.props.value}
      </span>
      <span className={styles.statTitle}>{el.props.title}</span>
    </div>
  );
});

/**
 * 自定义元素拖拽入口示例:放在 <Editor> children 内(已在 DndContext 中)。
 * 传一整块 inspector 配置即可自动生成右侧属性面板(标题/数值/字号),无需手写 Props 组件。
 * "字号"用 render 自定义渲染(Slider),其余字段走内置 type。
 * 拖入画布后生成可移动/缩放/选中的统计卡片实例。
 */
export function CustomElements() {
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>自定义</span>
      <DraggableElement
        type="stat-card"
        label="统计卡片"
        icon={BarChartOutlined}
        width={180}
        height={96}
        inspector={[
          { key: "title", label: "标题", type: "text", default: "活跃用户" },
          { key: "value", label: "数值", type: "text", default: "1,204" },
          {
            key: "size",
            label: "字号",
            default: 28,
            render: ({ value, set }) => (
              <Slider
                min={12}
                max={48}
                value={value}
                onChange={set}
                style={{ margin: "2px 0" }}
              />
            ),
          },
        ]}
      >
        {({ el }) => <StatCard el={el} />}
      </DraggableElement>
    </div>
  );
}
