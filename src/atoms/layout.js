import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/** 侧边栏折叠状态 */
export const collapsedAtom = atom(false);

/** 切换侧边栏折叠状态 */
export const toggleCollapsedAtom = atom(null, (get, set) => {
  set(collapsedAtom, !get(collapsedAtom));
});

/** 菜单选中键（持久化到 localStorage） */
export const selectedMenuAtom = atomWithStorage("menu-selected-key", "1");