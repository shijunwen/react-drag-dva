import { atom } from "jotai";

/** 预览模式开关 */
export const previewModeAtom = atom(false);

export const setPreviewModeAtom = atom(null, (get, set, value) => {
  set(previewModeAtom, value);
});
