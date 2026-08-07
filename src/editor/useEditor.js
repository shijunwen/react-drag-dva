import { useEditorState } from "./useEditorState";
import { useElementActions } from "./useElementActions";
import { useSelectionActions } from "./useSelectionActions";
import { useTemplateActions } from "./useTemplateActions";
import { useHistoryActions } from "./useHistoryActions";

/**
 * 编辑器统一 action 入口（向后兼容）。
 * 返回只读状态 + 全部 actions。
 *
 * 如需更细粒度订阅，请直接使用子 hook：
 *   useEditorState / useElementActions / useSelectionActions / useTemplateActions / useHistoryActions
 */
export function useEditor() {
  return {
    ...useEditorState(),
    ...useElementActions(),
    ...useSelectionActions(),
    ...useTemplateActions(),
    ...useHistoryActions(),
  };
}
