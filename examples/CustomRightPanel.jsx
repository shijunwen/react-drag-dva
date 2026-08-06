import { useState, useEffect } from "react";
import { Input, InputNumber, Button, Space, Empty } from "antd";
import {
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useEditor } from "@/editor/useEditor";
import styles from "./CustomRightPanel.module.less";

const NUMBER_STYLE = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  width: "100%",
};

/** 数值字段:聚焦时记一条历史,编辑过程实时更新(与默认属性面板同款) */
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

/** 名称编辑:本地草稿,Enter/blur 提交(避免每次按键都记一条历史) */
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
    />
  );
}

/**
 * 自定义右侧面板演示(完全替换默认属性面板)。
 *
 * 经 <Editor rightPanel={<CustomRightPanel/>}> 渲染,在 Provider/DndContext 内,
 * useEditor() 直接可用:位置/尺寸/旋转走 updateElement(实时)+ beginChange(历史),
 * 改名/锁定/隐藏/复制/删除走各专用 action,全部即时作用于画布。
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
        <Empty description="未选中元素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const update = (patch) => updateElement({ id: selected.id, patch });
  const toggleHide = () => {
    beginChange();
    update({ hidden: !selected.hidden });
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>元素</div>
        <RenameInput
          name={selected.name ?? ""}
          placeholder={selected.type}
          onCommit={(v) => renameElement({ id: selected.id, name: v })}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>位置与尺寸</div>
        <div className={styles.grid}>
          <NumberField label="X" value={Math.round(selected.x)} onChange={(v) => update({ x: v })} onBegin={beginChange} />
          <NumberField label="Y" value={Math.round(selected.y)} onChange={(v) => update({ y: v })} onBegin={beginChange} />
          <NumberField label="宽" value={Math.round(selected.width)} onChange={(v) => update({ width: v })} onBegin={beginChange} />
          <NumberField label="高" value={Math.round(selected.height)} onChange={(v) => update({ height: v })} onBegin={beginChange} />
          <NumberField label="旋转" value={Math.round(selected.rotation)} onChange={(v) => update({ rotation: v })} onBegin={beginChange} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>操作</div>
        <Space size={6} wrap>
          <Button
            size="small"
            icon={selected.locked ? <UnlockOutlined /> : <LockOutlined />}
            onClick={() => toggleElementLock({ id: selected.id })}
          >
            {selected.locked ? "解锁" : "锁定"}
          </Button>
          <Button
            size="small"
            icon={selected.hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={toggleHide}
          >
            {selected.hidden ? "显示" : "隐藏"}
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={duplicateSelected}>
            复制
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteElements([selected.id])}
          >
            删除
          </Button>
        </Space>
      </section>
    </div>
  );
}
