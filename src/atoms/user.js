import { atom } from "jotai";

const DEFAULT_USER = {
  username: "admin",
  email: "admin@example.com",
  role: "管理员",
  registerTime: "2026-03-01",
};

/** 用户信息 */
export const userAtom = atom(DEFAULT_USER);