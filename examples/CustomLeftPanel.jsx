import { useState, useEffect } from "react";
import { Input, Empty } from "antd";
import {
  LockOutlined,
  UnlockOutlined,
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
import { DEFAULT_TEMPLATE_ID } from "@/atoms/templates";
import { ELEMENT_TYPES } from "@/editor/elements";
import styles from "./CustomLeftPanel.module.less";

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

/**
 * 自定义左侧面板 — 精密制图工坊风格。
 *
 * 经 <Editor leftPanel={<CustomLeftPanel/>}> 渲染，处于 Editor 的
 * Jotai Provider / DndContext 内，useEditor() 直接可用。
 *
 * · 上方 — 选中元素检视卡（类型图标、改名、锁定/删除、尺寸元信息）
 * · 下方 — 当前模板顶层元素平铺列表（类型图标、点击选中、hover 行内操作）
 */
export function CustomLeftPanel() {
  const {
    elements,
    selectedIds,
    select,
    renameElement,
    toggleElementLock,
    deleteElements,
    templates,
    activeTemplateId,
  } = useEditor();

  const selected =
    selectedIds.length === 1
      ? elements.find((e) => e.id === selectedIds[0]) ?? null
      : null;

  const activeTpl = templates.find((t) => t.id === activeTemplateId);
  const list = elements.filter(
    (e) => !e.parentId && (e.templateId ?? DEFAULT_TEMPLATE_ID) === activeTemplateId,
  );

  // 选中元素类型图标
  const TypeIcon = selected ? (TYPE_ICONS[selected.type] ?? FALLBACK_ICON) : null;

  return (
    <div className={styles.wrap}>
      {/* ---- 选中元素检视卡 ---- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>选中元素</div>
        {selected ? (
          <div className={styles.card}>
            {/* 头部：图标 + 名称 + 操作 */}
            <div className={styles.cardHead}>
              <div className={styles.typeBadge}>
                {TypeIcon && <TypeIcon />}
              </div>
              <RenameInput
                name={selected.name ?? ""}
                placeholder={selected.type}
                onCommit={(v) => renameElement({ id: selected.id, name: v })}
              />
            </div>

            {/* 元信息行：类型标签 + 尺寸 */}
            <div className={styles.cardMeta}>
              <span className={styles.metaTag}>{selected.type}</span>
              <span className={styles.metaDim}>
                {Math.round(selected.width)} × {Math.round(selected.height)}
              </span>
              <span className={styles.metaDim}>
                x: {Math.round(selected.x)}, y: {Math.round(selected.y)}
              </span>
            </div>

            {/* 操作按钮行 */}
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => toggleElementLock({ id: selected.id })}
              >
                {selected.locked ? <><UnlockOutlined /> 解锁</> : <><LockOutlined /> 锁定</>}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.danger}`}
                onClick={() => deleteElements([selected.id])}
              >
                <DeleteOutlined /> 删除
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <Empty
              description="点击画布元素以选中"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </section>

      {/* ---- 元素列表 ---- */}
      <section className={styles.sectionGrow}>
        <div className={styles.sectionTitle}>
          {activeTpl?.name ?? "模板"} · 顶层
        </div>
        <div className={styles.list}>
          {list.length === 0 ? (
            <Empty
              description="从顶部面板拖入元素"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            list.map((el) => {
              const isSelected = selectedIds.includes(el.id);
              const IconComp = TYPE_ICONS[el.type] ?? FALLBACK_ICON;
              const cls = `${styles.listItem}${isSelected ? ` ${styles.selected}` : ""}${el.locked ? ` ${styles.locked}` : ""}`;
              return (
                <div
                  key={el.id}
                  className={cls}
                  onClick={() => select([el.id])}
                >
                  <span className={styles.listIcon}>
                    <IconComp />
                  </span>
                  <span className={styles.listName} title={el.name || el.type}>
                    {el.name || el.type}
                  </span>
                  <span className={styles.listActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleElementLock({ id: el.id });
                      }}
                      title={el.locked ? "解锁" : "锁定"}
                    >
                      {el.locked ? <UnlockOutlined /> : <LockOutlined />}
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteElements([el.id]);
                      }}
                      title="删除"
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
