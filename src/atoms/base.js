import { atom } from "jotai";

/** 画布内全部元素（顶层 + 容器子元素，以 parentId 区分） */
export const elementsAtom = atom([]);

/** 复制/粘贴剪贴板：存储最近复制的元素副本 */
export const clipboardAtom = atom([]);

/** 是否开启对齐网格吸附 */
export const gridSnapAtom = atom(false);

/** 网格吸附步长(px) */
export const gridSizeAtom = atom(20);
