import { atom } from "jotai";

const DEFAULT_SYSTEM_INFO = {
  name: "React Drag Dva",
  version: "v0.0.1",
  stack: "React + Antd + ahooks + jotai",
  status: "运行中",
};

/** 系统信息 */
export const systemInfoAtom = atom(DEFAULT_SYSTEM_INFO);