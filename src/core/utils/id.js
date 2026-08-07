/** 生成唯一 id */
let seed = 0;
export const genId = (prefix = "el") => `${prefix}_${Date.now().toString(36)}_${(seed++).toString(36)}`;
