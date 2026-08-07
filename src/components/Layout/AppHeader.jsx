import { memo, useCallback, useMemo } from "react";
import { Layout, Button, Space, Divider, Dropdown, Popconfirm, Tooltip } from "antd";
import {
  DeleteOutlined,
  GroupOutlined,
  UngroupOutlined,
  AlignLeftOutlined,
  ClearOutlined,
  UndoOutlined,
  RedoOutlined,
  EyeOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useAtomValue, useSetAtom } from "jotai";
import { useEditor } from "@/editor/useEditor";
import { previewModeAtom, setPreviewModeAtom } from "../../atoms/preview";
import styles from "./AppHeader.module.less";

const { Header } = Layout;

const ALIGN_ITEMS = [
  { key: "left", label: "左对齐" },
  { key: "right", label: "右对齐" },
  { key: "centerH", label: "水平居中" },
  { key: "top", label: "顶部对齐" },
  { key: "bottom", label: "底部对齐" },
  { key: "centerV", label: "垂直居中" },
];

function AppHeaderInner() {
  const {
    selectedIds,
    selectedElements,
    canUndo,
    canRedo,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    alignSelected,
    clearCanvas,
    undo,
    redo,
  } = useEditor();
  const previewMode = useAtomValue(previewModeAtom);
  const setPreviewMode = useSetAtom(setPreviewModeAtom);

  const canGroup = selectedIds.length >= 2;
  const canUngroup = selectedElements.some((el) => el.groupId);
  const canAlign = selectedIds.length >= 2;

  // 对齐下拉菜单：稳定引用，避免每次 render 传入新对象
  const handleAlign = useCallback(({ key }) => alignSelected(key), [alignSelected]);
  const alignMenu = useMemo(
    () => ({ items: ALIGN_ITEMS, onClick: handleAlign }),
    [handleAlign],
  );

  return (
    <Header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandIndicator} />
        <span className={styles.brandName}>精密制图工坊</span>
        <span className={styles.brandSub}>Drafting Atelier</span>
      </div>

      <Space size="small" className={styles.tools}>
        <Tooltip title={previewMode ? "返回编辑" : "预览"} placement="bottom">
          <Button
            type={previewMode ? "primary" : "text"}
            icon={previewMode ? <EditOutlined /> : <EyeOutlined />}
            onClick={() => setPreviewMode(!previewMode)}
            className={styles.toolBtn}
          >
            {previewMode ? "编辑" : "预览"}
          </Button>
        </Tooltip>

        {!previewMode && (
          <>
            <Divider orientation="vertical" className={styles.divider} />

            <Tooltip title="撤销" placement="bottom">
              <Button
                type="text"
                icon={<UndoOutlined />}
                disabled={!canUndo}
                onClick={undo}
                className={styles.iconBtn}
              />
            </Tooltip>
            <Tooltip title="重做" placement="bottom">
              <Button
                type="text"
                icon={<RedoOutlined />}
                disabled={!canRedo}
                onClick={redo}
                className={styles.iconBtn}
              />
            </Tooltip>

            <Divider orientation="vertical" className={styles.divider} />

            <Tooltip title="合并成一个块" placement="bottom">
              <Button
                type="text"
                icon={<GroupOutlined />}
                disabled={!canGroup}
                onClick={groupSelected}
                className={styles.iconBtn}
              />
            </Tooltip>
            <Tooltip title="取消合并" placement="bottom">
              <Button
                type="text"
                icon={<UngroupOutlined />}
                disabled={!canUngroup}
                onClick={ungroupSelected}
                className={styles.iconBtn}
              />
            </Tooltip>

            <Dropdown
              menu={alignMenu}
              disabled={!canAlign}
              placement="bottom"
            >
              <Button
                type="text"
                icon={<AlignLeftOutlined />}
                disabled={!canAlign}
                className={styles.iconBtn}
              >
                对齐
              </Button>
            </Dropdown>

            <Divider orientation="vertical" className={styles.divider} />

            <Tooltip title="删除选中" placement="bottom">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedIds.length}
                onClick={deleteSelected}
                className={styles.iconBtn}
              />
            </Tooltip>

            <Popconfirm
              title="确定清空画布？"
              onConfirm={clearCanvas}
              okText="清空"
              cancelText="取消"
            >
              <Button type="text" icon={<ClearOutlined />} className={styles.iconBtn}>
                清空
              </Button>
            </Popconfirm>
          </>
        )}
      </Space>
    </Header>
  );
}

export const AppHeader = memo(AppHeaderInner);
