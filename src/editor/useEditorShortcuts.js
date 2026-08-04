import { useKeyPress } from "ahooks";
import { isEditable } from "./utils";

/**
 * 编辑器键盘快捷键:删除/撤销/重做/复制/粘贴/复制偏移/方向键微调。
 * 输入框聚焦时放行原生行为(isEditable 判定)。
 * useKeyPress 内部以 ref 持有最新 handler,故闭包读取的 selectedIds 始终最新。
 */
export function useEditorShortcuts({
  selectedIds,
  deleteSelected,
  undo,
  redo,
  copySelected,
  paste,
  duplicateSelected,
  nudgeSelected,
}) {
  // Delete / Backspace 删除选中元素
  useKeyPress(
    ["delete", "backspace"],
    () => {
      if (isEditable(document.activeElement)) return;
      if (selectedIds.length) deleteSelected();
    },
    { exactMatch: true },
  );
  // 撤销 Ctrl+Z
  useKeyPress(
    "ctrl.z",
    () => { if (!isEditable(document.activeElement)) undo(); },
    { exactMatch: false },
  );
  // 重做 Ctrl+Shift+Z 或 Ctrl+Y
  useKeyPress(
    ["ctrl.shift.z", "ctrl.y"],
    () => { if (!isEditable(document.activeElement)) redo(); },
    { exactMatch: false },
  );
  // 复制 Ctrl+C
  useKeyPress(
    "ctrl.c",
    () => { if (!isEditable(document.activeElement)) copySelected(); },
    { exactMatch: false },
  );
  // 粘贴 Ctrl+V
  useKeyPress(
    "ctrl.v",
    () => { if (!isEditable(document.activeElement)) paste(); },
    { exactMatch: false },
  );
  // 复制并偏移 Ctrl+D
  useKeyPress(
    "ctrl.d",
    () => { if (!isEditable(document.activeElement)) duplicateSelected(); },
    { exactMatch: false },
  );
  // 方向键微调 / Shift 快速微调
  useKeyPress(
    ["arrowup", "arrowdown", "arrowleft", "arrowright"],
    (e, key) => {
      if (isEditable(document.activeElement)) return;
      const step = e.shiftKey ? 10 : 1;
      if (!selectedIds.length) return;
      if (key === "arrowup") nudgeSelected({ dx: 0, dy: -step });
      if (key === "arrowdown") nudgeSelected({ dx: 0, dy: step });
      if (key === "arrowleft") nudgeSelected({ dx: -step, dy: 0 });
      if (key === "arrowright") nudgeSelected({ dx: step, dy: 0 });
    },
    { exactMatch: false },
  );
}
