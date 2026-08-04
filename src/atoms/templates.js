import { atom } from "jotai";
import { elementsAtom } from "./base";
import { selectedIdsAtom } from "./selection";
import { beginChangeAtom } from "./history";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/editor/constants";
import { genId, cloneElementsForTemplate } from "@/editor/utils";

/** 默认模板 id(单模板/向后兼容用) */
export const DEFAULT_TEMPLATE_ID = "tpl_default";

/** 模板列表:每个模板是一页独立画布,有自己的尺寸与元素集合 */
export const templatesAtom = atom([
  { id: DEFAULT_TEMPLATE_ID, name: "模板 1", width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
]);

/** 当前激活模板 id(尺寸输入/落点默认目标/标尺对齐) */
export const activeTemplateIdAtom = atom(DEFAULT_TEMPLATE_ID);

/** 多模板网格布局列数:1=一行一个,N=一行多个 */
export const templateColumnsAtom = atom(1);

/** 激活模板对象(派生) */
export const activeTemplateAtom = atom((get) => {
  const tpls = get(templatesAtom);
  const id = get(activeTemplateIdAtom);
  return tpls.find((t) => t.id === id) ?? tpls[0] ?? null;
});

/** 激活模板尺寸(派生,供 UI 订阅) */
export const canvasWidthAtom = atom((get) => get(activeTemplateAtom)?.width ?? CANVAS_WIDTH);
export const canvasHeightAtom = atom((get) => get(activeTemplateAtom)?.height ?? CANVAS_HEIGHT);

/** 网格列数范围 */
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 4;

/** 按元素所属模板查尺寸(纯函数,供 action atom 内 get 后调用) */
export const getTemplateSize = (templates, templateId) => {
  const id = templateId ?? DEFAULT_TEMPLATE_ID;
  return (
    templates.find((t) => t.id === id) ??
    templates[0] ?? { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
  );
};

/* ----------------------------- 模板增删改 ----------------------------- */

/** 新增模板(可选 basedOnId 克隆其元素),设为激活,返回新 id */
export const addTemplateAtom = atom(null, (get, set, opts = {}) => {
  set(beginChangeAtom);
  const tpls = get(templatesAtom);
  const base = opts.basedOnId ? tpls.find((t) => t.id === opts.basedOnId) : null;
  const tpl = {
    id: genId("tpl"),
    name: `模板 ${tpls.length + 1}`,
    width: base?.width ?? CANVAS_WIDTH,
    height: base?.height ?? CANVAS_HEIGHT,
  };
  set(templatesAtom, [...tpls, tpl]);
  if (base) {
    const els = get(elementsAtom).filter(
      (e) => (e.templateId ?? DEFAULT_TEMPLATE_ID) === base.id
    );
    if (els.length) {
      const cloned = cloneElementsForTemplate(els, tpl.id);
      set(elementsAtom, (list) => [...list, ...cloned]);
    }
  }
  set(activeTemplateIdAtom, tpl.id);
  return tpl.id;
});

/** 复制模板(克隆模板 + 其元素),设为激活 */
export const duplicateTemplateAtom = atom(null, (get, set, id) => {
  const tpls = get(templatesAtom);
  const src = tpls.find((t) => t.id === id);
  if (!src) return;
  set(beginChangeAtom);
  const tpl = {
    id: genId("tpl"),
    name: `${src.name} 副本`,
    width: src.width,
    height: src.height,
  };
  set(templatesAtom, [...tpls, tpl]);
  const els = get(elementsAtom).filter(
    (e) => (e.templateId ?? DEFAULT_TEMPLATE_ID) === id
  );
  if (els.length) {
    const cloned = cloneElementsForTemplate(els, tpl.id);
    set(elementsAtom, (list) => [...list, ...cloned]);
  }
  set(activeTemplateIdAtom, tpl.id);
});

/** 删除模板(级联删其元素;至少保留一个模板) */
export const deleteTemplateAtom = atom(null, (get, set, id) => {
  const tpls = get(templatesAtom);
  if (tpls.length <= 1) return;
  if (!tpls.some((t) => t.id === id)) return;
  set(beginChangeAtom);
  set(templatesAtom, tpls.filter((t) => t.id !== id));
  set(elementsAtom, (list) =>
    list.filter((e) => (e.templateId ?? DEFAULT_TEMPLATE_ID) !== id)
  );
  // 清理已不存在的选中
  const sel = get(selectedIdsAtom);
  if (sel.length) {
    const remaining = new Set(get(elementsAtom).map((e) => e.id));
    const nextSel = sel.filter((sid) => remaining.has(sid));
    if (nextSel.length !== sel.length) set(selectedIdsAtom, nextSel);
  }
  // active 被删则重置到首个
  if (get(activeTemplateIdAtom) === id) {
    set(activeTemplateIdAtom, get(templatesAtom)[0].id);
  }
});

/** 重命名模板 */
export const renameTemplateAtom = atom(null, (get, set, { id, name }) => {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return;
  set(templatesAtom, (tpls) => tpls.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
});

/** 设置模板尺寸(不记历史,与原画布尺寸输入一致) */
export const setTemplateSizeAtom = atom(
  null,
  (get, set, { id, width, height }) => {
    set(templatesAtom, (tpls) =>
      tpls.map((t) =>
        t.id === id
          ? {
              ...t,
              width: width && width > 0 ? width : t.width,
              height: height && height > 0 ? height : t.height,
            }
          : t
      )
    );
  }
);

/** 切换激活模板 */
export const setActiveTemplateAtom = atom(null, (get, set, id) => {
  if (get(templatesAtom).some((t) => t.id === id)) set(activeTemplateIdAtom, id);
});

/** 设置网格列数(clamp 1..4) */
export const setTemplateColumnsAtom = atom(null, (get, set, n) => {
  const cols = Math.round(n);
  if (!Number.isFinite(cols)) return;
  set(templateColumnsAtom, Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, cols)));
});
