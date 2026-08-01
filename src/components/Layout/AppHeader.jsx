import { memo } from "react";
import { Layout, Button, Space, Divider, Dropdown, Popconfirm, theme, Tooltip } from "antd";
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
import { previewModeAtom, setPreviewModeAtom } from "@/atoms";

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
  const { token } = theme.useToken();
  const previewMode = useAtomValue(previewModeAtom);
  const setPreviewMode = useSetAtom(setPreviewModeAtom);

  const canGroup = selectedIds.length >= 2;
  const canUngroup = selectedElements.some((el) => el.groupId);
  const canAlign = selectedIds.length >= 2;

  return (
    <Header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 600 }}>拖拽编辑器</span>

      <Space size={4}>
        <Tooltip title={previewMode ? "返回编辑" : "预览"}>
          <Button
            type={previewMode ? "primary" : "text"}
            icon={previewMode ? <EditOutlined /> : <EyeOutlined />}
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? "编辑" : "预览"}
          </Button>
        </Tooltip>

        <Divider type="vertical" style={{ margin: "0 4px" }} />

        {!previewMode && (
          <>
            <Tooltip title="撤销">
              <Button type="text" icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} />
            </Tooltip>
            <Tooltip title="重做">
              <Button type="text" icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} />
            </Tooltip>

            <Divider type="vertical" style={{ margin: "0 4px" }} />

            <Tooltip title="合并成一个块">
              <Button
                type="text"
                icon={<GroupOutlined />}
                disabled={!canGroup}
                onClick={groupSelected}
              />
            </Tooltip>
            <Tooltip title="取消合并">
              <Button
                type="text"
                icon={<UngroupOutlined />}
                disabled={!canUngroup}
                onClick={ungroupSelected}
              />
            </Tooltip>

            <Dropdown
              menu={{
                items: ALIGN_ITEMS,
                onClick: ({ key }) => alignSelected(key),
              }}
              disabled={!canAlign}
            >
              <Button type="text" icon={<AlignLeftOutlined />} disabled={!canAlign}>
                对齐
              </Button>
            </Dropdown>

            <Divider type="vertical" style={{ margin: "0 4px" }} />

            <Tooltip title="删除选中">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedIds.length}
                onClick={deleteSelected}
              />
            </Tooltip>

            <Popconfirm title="确定清空画布？" onConfirm={clearCanvas} okText="清空" cancelText="取消">
              <Button type="text" icon={<ClearOutlined />}>清空</Button>
            </Popconfirm>
          </>
        )}
      </Space>
    </Header>
  );
}

export const AppHeader = memo(AppHeaderInner);
