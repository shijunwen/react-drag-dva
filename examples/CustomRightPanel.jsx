import { useState, useEffect } from "react";
import { Input, InputNumber, Empty } from "antd";
import {
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  DeleteOutlined,
  BorderOutlined,
  FontSizeOutlined,
  AppstoreOutlined,
  PictureOutlined,
  RadiusSettingOutlined,
  ContainerOutlined,
  AimOutlined,
} from "@ant-design/icons";
import { useEditor } from "@/editor/useEditor";
import { ELEMENT_TYPES } from "@/editor/elements";
import styles from "./CustomRightPanel.module.less";

/** 每种元素类型的图标映射 */
const TYPE_ICONS = {
  [ELEMENT_TYPES.TEXT]: FontSizeOutlined,
  [ELEMENT_TYPES.RECT]: BorderOutlined,
  [ELEMENT_TYPES.CIRCLE]: AimOutlined,
  [ELEMENT_TYPES.IMAGE]: PictureOutlined,
  [ELEMENT_TYPES.BUTTON]: RadiusSettingOutlined,
  [ELEMENT_TYPES.CONTAINER]: ContainerOutlined,
};

const FALLBACK_ICON = AppstoreOutlined;

/** NumberField 数字输入样式(模块级单例,避免每次 render 新建对象) */
const NUMBER_INPUT_STYLE = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  width: "100%",
};

/** 名称编辑：本地草稿，Enter/blur 提交 */
function RenameInput({ name, placeholder, onCommit }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);
  const commit = () => {
    const v = draft.trim();
    if (v !== name) onCommit(v);
    else setDraft(name);
  };
  return (
    <Input
      size="small"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onPressEnter={commit}
      onBlur={commit}
      className={styles.cardName}
    />
  );
}

/** 数值字段 */
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
        style={NUMBER_INPUT_STYLE}
      />
    </label>
  );
}

/**
 * 自定义右侧面板 — 精密制图工坊风格。
 *
 * 经 <Editor rightPanel={<CustomRightPanel/>}> 渲染，在 Provider/DndContext 内，
 * useEditor() 直接可用。
 *
 * · 元素信息卡 — 类型图标 + 改名
 * · 位置与尺寸卡 — 网格数值输入（x/y/w/h/旋转）
 * · 操作卡 — 锁定 / 隐藏 / 复制 / 删除
 */
export function CustomRightPanel() {
  const {
    elements,
    selectedIds,
    updateElement,
    beginChange,
    renameElement,
    toggleElementLock,
    deleteElements,
    duplicateSelected,
  } = useEditor();

  const selected =
    selectedIds.length === 1
      ? elements.find((e) => e.id === selectedIds[0]) ?? null
      : null;

  if (!selected) {
    return (
      <div className={styles.empty}>
        <Empty
          description="选中画布元素以编辑属性"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const update = (patch) => updateElement({ id: selected.id, patch });
  const toggleHide = () => {
    beginChange();
    update({ hidden: !selected.hidden });
  };
  const TypeIcon = TYPE_ICONS[selected.type] ?? FALLBACK_ICON;

  return (
    <div className={styles.wrap}>
      {/* ---- 元素信息 ---- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>元素</div>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.typeBadge}>
              <TypeIcon />
            </div>
            <RenameInput
              name={selected.name ?? ""}
              placeholder={selected.type}
              onCommit={(v) => renameElement({ id: selected.id, name: v })}
            />
          </div>
        </div>
      </section>

      {/* ---- 位置与尺寸 ---- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>位置与尺寸</div>
        <div className={styles.card}>
          <div className={styles.grid}>
            <NumberField label="X" value={Math.round(selected.x)} onChange={(v) => update({ x: v })} onBegin={beginChange} />
            <NumberField label="Y" value={Math.round(selected.y)} onChange={(v) => update({ y: v })} onBegin={beginChange} />
            <NumberField label="W" value={Math.round(selected.width)} onChange={(v) => update({ width: v })} onBegin={beginChange} />
            <NumberField label="H" value={Math.round(selected.height)} onChange={(v) => update({ height: v })} onBegin={beginChange} />
            <NumberField label="R" value={Math.round(selected.rotation)} onChange={(v) => update({ rotation: v })} onBegin={beginChange} />
          </div>
        </div>
      </section>

      {/* ---- 操作 ---- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>操作</div>
        <div className={styles.actionGrid}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => toggleElementLock({ id: selected.id })}
          >
            {selected.locked ? <UnlockOutlined /> : <LockOutlined />}
            {selected.locked ? "解锁" : "锁定"}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.accent}`}
            onClick={toggleHide}
          >
            {selected.hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            {selected.hidden ? "显示" : "隐藏"}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={duplicateSelected}
          >
            <CopyOutlined />
            复制
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.danger}`}
            onClick={() => deleteElements([selected.id])}
          >
            <DeleteOutlined />
            删除
          </button>
        </div>
      </section>
    </div>
  );
}
