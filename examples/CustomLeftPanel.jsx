import { useState, useEffect } from "react";
import { Input, Button, Space, Tag, Empty } from "antd";
import {
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useEditor } from "@/editor/useEditor";
import { DEFAULT_TEMPLATE_ID } from "../src/atoms/templates";
import styles from "./CustomLeftPanel.module.less";

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
 * 自定义左侧面板演示(完全替换默认组件树)。
 *
 * 经 <Editor leftPanel={<CustomLeftPanel/>}> 渲染,处于 Editor 的
 * Jotai Provider / DndContext 内,故 useEditor() 直接可用 -- 选中/改名/锁定/删除
 * 全部代理到画布,与默认组件树同权。
 *
 * - 上:选中元素检视卡(改名/锁定/删除 + 尺寸元信息)
 * - 下:当前模板的顶层元素平铺列表(点击选中、行内锁定/删除)
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

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>选中元素</div>
        {selected ? (
          <div className={styles.card}>
            <RenameInput
              name={selected.name ?? ""}
              placeholder={selected.type}
              onCommit={(v) => renameElement({ id: selected.id, name: v })}
            />
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
                danger
                icon={<DeleteOutlined />}
                onClick={() => deleteElements([selected.id])}
              >
                删除
              </Button>
            </Space>
            <div className={styles.meta}>
              <Tag color="blue" bordered={false}>
                {selected.type}
              </Tag>
              <span className={styles.dim}>
                {Math.round(selected.width)} × {Math.round(selected.height)}
              </span>
            </div>
          </div>
        ) : (
          <Empty description="未选中元素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </section>

      <section className={styles.sectionGrow}>
        <div className={styles.sectionTitle}>
          {activeTpl?.name ?? "模板"} · 顶层元素
        </div>
        <div className={styles.list}>
          {list.length === 0 ? (
            <Empty description="暂无元素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            list.map((el) => {
              const isSelected = selectedIds.includes(el.id);
              return (
                <div
                  key={el.id}
                  className={[
                    styles.listItem,
                    isSelected ? styles.selected : "",
                    el.locked ? styles.locked : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => select([el.id])}
                >
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
