import { atom } from "jotai";

/** 画布内全部元素（顶层 + 容器子元素，以 parentId 区分） */
export const elementsAtom = atom([]);
