import { memo, useMemo } from "react";
import { InputNumber, Typography, Empty, Segmented, Switch } from "antd";
import { useEditor } from "../useEditor";
import { getDef } from "../elements";
import ElementErrorBoundary from "../ElementErrorBoundary";
import { getBounds } from "../utils";
import styles from "./PropertiesPanel.module.less";

const { Text } = Typography;

// 提升到模块作用域的静态对象，避免每次 render 产生新引用
const NUMBER_STYLE = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
const UNIT_OPTIONS = [
  { label: "px", value: "px" },
  { label: "%", value: "%" },
];

/** 数值字段：聚焦时开启一条历史记录，编辑过程实时更新 */
function NumberField({ label, value, onChange, onBegin }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <InputNumber
        size="small"
        value={value}
        min={0}
        onFocus={onBegin}
        onChange={(v) => onChange(v ?? 0)}
        style={NUMBER_STYLE}
      />
    </label>
  );
}

const Z_ACTIONS = [
  { to: "back", label: "置底" },
  { to: "backward", label: "下移" },
  { to: "forward", label: "上移" },
  { to: "front", label: "置顶" },
];

// 无 props，memo 阻断父级 Editor 的 zoom 等无关重渲染波及至此；
// 自身仍随 selectedElements（useEditor）变化重渲染。
const PropertiesPanel = memo(function PropertiesPanel() {
  const {
    selectedElements,
    updateElement,
    setElementUnit,
    beginChange,
    groupSelected,
    ungroupSelected,
    reorderZ,
  } = useEditor();
  const single = selectedElements.length === 1 ? selectedElements[0] : null;
  // 类型专属属性编辑器(从元素注册表取,无则不渲染该区块内容)
  const TypePropsComp = single ? getDef(single.type)?.Props : null;
  const bounds = useMemo(
    () => (selectedElements.length > 1 ? getBounds(selectedElements) : null),
    [selectedElements]
  );

  const update = (patch) => updateElement({ id: single.id, patch });

  return (
    <div className={styles.panel}>
      {!selectedElements.length ? (
        <Empty description="未选中组件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : single ? (
        <>
          <section className={styles.section}>
            <Text type="secondary" className={styles.sectionTitle}>
              位置与大小
            </Text>
            <div className={styles.grid}>
              <NumberField label="X" value={single.x} onChange={(v) => update({ x: v })} onBegin={beginChange} />
              <NumberField label="Y" value={single.y} onChange={(v) => update({ y: v })} onBegin={beginChange} />
              <NumberField label="宽" value={single.width} onChange={(v) => update({ width: v })} onBegin={beginChange} />
              <NumberField label="高" value={single.height} onChange={(v) => update({ height: v })} onBegin={beginChange} />
              <div className={styles.unitRow}>
                <span className={styles.unitLabel}>单位</span>
                <Segmented
                  size="small"
                  value={single.unit || "px"}
                  onChange={(v) => setElementUnit({ id: single.id, unit: v })}
                  options={UNIT_OPTIONS}
                />
              </div>
              <NumberField label="旋转" value={single.rotation} onChange={(v) => update({ rotation: v })} onBegin={beginChange} />
              <div className={styles.field}>
                <span className={styles.label}>锁定</span>
                <Switch
                  size="small"
                  checked={single.locked}
                  onChange={(checked) => {
                    beginChange();
                    update({ locked: checked });
                  }}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>隐藏</span>
                <Switch
                  size="small"
                  checked={single.hidden}
                  onChange={(checked) => {
                    beginChange();
                    update({ hidden: checked });
                  }}
                />
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <Text type="secondary" className={styles.sectionTitle}>
              层叠顺序
            </Text>
            <div className={styles.groupBtns}>
              {Z_ACTIONS.map((a) => (
                <button
                  key={a.to}
                  className={styles.miniBtn}
                  onClick={() => reorderZ({ id: single.id, to: a.to })}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <Text type="secondary" className={styles.sectionTitle}>
              组件属性
            </Text>
            {TypePropsComp ? (
              <ElementErrorBoundary
                resetKey={single.id}
                fallback={<span style={{ color: "#ef4444", fontSize: 12 }}>属性面板渲染失败</span>}
              >
                <TypePropsComp el={single} update={update} begin={beginChange} styles={styles} />
              </ElementErrorBoundary>
            ) : null}
          </section>
        </>
      ) : (
        <section className={styles.section}>
          <Text type="secondary" className={styles.sectionTitle}>
            已选中 {selectedElements.length} 个组件
          </Text>
          {bounds && (
            <div className={styles.grid}>
              <NumberField label="总宽" value={Math.round(bounds.width)} onChange={() => {}} onBegin={() => {}} />
              <NumberField label="总高" value={Math.round(bounds.height)} onChange={() => {}} onBegin={() => {}} />
            </div>
          )}
          <div className={styles.groupBtns}>
            <button className={styles.miniBtn} onClick={groupSelected}>
              合并成块
            </button>
            <button className={styles.miniBtn} onClick={ungroupSelected}>
              取消合并
            </button>
          </div>
        </section>
      )}
    </div>
  );
});

export default PropertiesPanel;
