import { memo, useMemo, useState, useEffect } from "react";
import { InputNumber, Typography, Segmented, Switch, Select, Input } from "antd";
import { PlusOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEditor } from "../useEditor";
import { getDef } from "../elements";
import SchemaProps from "../SchemaProps";
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
const COLUMNS_OPTIONS = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
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

/** 模板重命名输入:本地草稿,Enter/blur 提交,外部 name 变化时同步 */
function TemplateNameField({ name, onCommit }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onCommit(trimmed);
    else setDraft(name);
  };
  return (
    <Input
      size="small"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onPressEnter={commit}
      onBlur={commit}
    />
  );
}

/** 画布与模板配置(无选中时显示在属性面板) */
const CanvasConfig = memo(function CanvasConfig() {
  const {
    templates,
    activeTemplateId,
    templateColumns,
    addTemplate,
    duplicateTemplate,
    deleteTemplate,
    renameTemplate,
    setTemplateSize,
    setActiveTemplate,
    setTemplateColumns,
  } = useEditor();
  const active = templates.find((t) => t.id === activeTemplateId) ?? templates[0];
  if (!active) return null;

  return (
    <section className={styles.section}>
      <Text type="secondary" className={styles.sectionTitle}>
        画布与模板
      </Text>
      <div className={styles.tplRow}>
        <Select
          size="small"
          value={activeTemplateId}
          onChange={setActiveTemplate}
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
          className={styles.tplSelect}
        />
        <button type="button" className={styles.tplIconBtn} onClick={() => addTemplate()} title="新增模板">
          <PlusOutlined />
        </button>
        <button
          type="button"
          className={styles.tplIconBtn}
          onClick={() => duplicateTemplate(activeTemplateId)}
          title="复制模板"
        >
          <CopyOutlined />
        </button>
        <button
          type="button"
          className={styles.tplIconBtn}
          onClick={() => deleteTemplate(activeTemplateId)}
          title="删除模板"
          disabled={templates.length <= 1}
        >
          <DeleteOutlined />
        </button>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>名称</span>
        <TemplateNameField
          name={active.name}
          onCommit={(name) => renameTemplate({ id: active.id, name })}
        />
      </div>
      <div className={styles.grid}>
        <NumberField
          label="宽"
          value={active.width}
          onChange={(v) => setTemplateSize({ id: active.id, width: v, height: active.height })}
          onBegin={() => {}}
        />
        <NumberField
          label="高"
          value={active.height}
          onChange={(v) => setTemplateSize({ id: active.id, width: active.width, height: v })}
          onBegin={() => {}}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>列数</span>
        <Segmented
          size="small"
          options={COLUMNS_OPTIONS}
          value={templateColumns}
          onChange={(v) => setTemplateColumns(v)}
        />
      </div>
    </section>
  );
});

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
  // 类型专属属性编辑器:优先自定义 Props;否则回退到 inspector schema 自动生成;都没有则不渲染
  const def = single ? getDef(single.type) : null;
  const TypePropsComp = single
    ? def?.Props ?? (def?.inspector?.length ? SchemaProps : null)
    : null;
  const bounds = useMemo(
    () => (selectedElements.length > 1 ? getBounds(selectedElements) : null),
    [selectedElements]
  );

  const update = (patch) => updateElement({ id: single.id, patch });

  return (
    <div className={styles.panel}>
      {!selectedElements.length ? (
        <CanvasConfig />
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
