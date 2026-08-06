import { PALETTE_ITEM_MAP } from "./elements";
import { UNIT } from "./constants";

/** 生成唯一 id */
let seed = 0;
export const genId = (prefix = "el") => `${prefix}_${Date.now().toString(36)}_${(seed++).toString(36)}`;

/**
 * 深拷贝元素 props:避免 defaults.props 中的嵌套对象在多个实例间共享引用,
 * 否则误改一个实例的嵌套字段会污染所有同类型实例(含复制出来的实例)。
 * 优先 structuredClone(保留 Date/Map 等),环境不支持时降级 JSON。
 */
export const cloneProps = (props) =>
  props === undefined || props === null
    ? {}
    : typeof structuredClone === "function"
      ? structuredClone(props)
      : JSON.parse(JSON.stringify(props));

/**
 * 将带单位的值换算为百分比数值（0~100）。
 * px 值除以 canvasSize 换算；% 值直接返回。
 * @param {number} value - 值
 * @param {string} unit - "px" | "%"
 * @param {number} canvasSize - 画布尺寸（px）
 * @returns {number} 百分比（0~100）
 */
export const toPercent = (value, unit, canvasSize) => {
  if (unit === UNIT.PERCENT) return value;
  if (!canvasSize) return 0;
  return (value / canvasSize) * 100;
};

/**
 * 将逻辑像素值转换为元素存储单位下的值。
 * px 模式原样返回；% 模式按 canvasSize 换算为百分比（0~100）。
 * 与 toPercent 互为反向：toPercent 把存储值转成百分比用于渲染，
 * pxToUnit 把手势产生的像素位移/尺寸转成存储值。
 * @param {number} px - 逻辑像素值
 * @param {string} unit - "px" | "%"
 * @param {number} canvasSize - 画布尺寸（px）
 * @returns {number} 元素单位下的存储值
 */
export const pxToUnit = (px, unit, canvasSize) => {
  if (unit === UNIT.PERCENT && canvasSize) return (px / canvasSize) * 100;
  return px;
};

/**
 * 将带单位的值转为 CSS 字符串。
 * @param {number} value - 值
 * @param {string} unit - "px" | "%"
 * @returns {string} CSS 字符串如 "50%" 或 "40px"
 */
export const toCss = (value, unit) => {
  if (unit === UNIT.PERCENT) return `${value}%`;
  return `${value}px`;
};

/**
 * 根据类型创建一个新元素
 * @param {string} type - ELEMENT_TYPES
 * @param {number} x - x（px，相对画布/容器宽度）
 * @param {number} y - y（px，相对画布/容器顶部）
 */
export function createElement(type, x, y) {
  const def = PALETTE_ITEM_MAP[type];
  if (!def) throw new Error(`未知组件类型: ${type}`);

  return {
    id: genId(),
    type,
    x: Math.round(x),
    y: Math.round(y),
    width: def.defaults.width,
    height: def.defaults.height,
    unit: UNIT.PX, // 默认 px，可切换为 %
    rotation: 0,
    groupId: null,
    parentId: null, // null=画布顶层；containerId=容器内子元素
    templateId: null, // 所属模板 id(由 addElement 赋值;null 兜底为默认模板)
    z: 0, // 同级层叠顺序
    locked: false, // 锁定:不可移动/缩放(仍可选中以解锁)
    hidden: false, // 隐藏:不渲染(保留数据,可通过组件树选中后取消隐藏)
    name: null, // 实例名称(null 时回退为类型 label;组件树/属性面板可改)
    props: cloneProps(def.defaults.props),
  };
}

/** 取元素的 parentId（统一 null） */
export const getParentId = (el) => el.parentId ?? null;

/**
 * 计算一组元素的并集包围盒
 * x/width/y/height 的单位由 el.unit 决定（px 或 %），混合时仅在相同单位间比较
 * @param {Array} elements
 * @returns {{minX,minY,maxX,maxY,width,height}|null}
 */
export function getBounds(elements) {
  if (!elements.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * 展开选择：若选中元素属于某个分组，则把同组元素一并纳入选择
 * 用于「合并成一个块」后，点选任一成员即选中整组
 */
export function expandGroupSelection(elements, ids) {
  const idSet = new Set(ids);
  const groupIds = new Set(
    elements.filter((el) => idSet.has(el.id) && el.groupId).map((el) => el.groupId)
  );
  if (!groupIds.size) return [...ids];
  const expanded = new Set(ids);
  for (const el of elements) {
    if (el.groupId && groupIds.has(el.groupId)) expanded.add(el.id);
  }
  return [...expanded];
}

/**
 * 容器-子孙去重:若某元素的任一祖先容器也在选中集合内,则剔除该元素。
 * 用于框选:命中容器时不再单独选中其内部子组件(与「单击选中容器」行为一致,
 * 避免子组件被额外高亮/加 moveable 控制柄)。容器未命中时子组件照常可选。
 * @param {object[]} elements - 全部元素
 * @param {string[]} ids - 候选选中 id
 * @returns {string[]} 去重后的 id 列表(保持原顺序)
 */
export const excludeDescendantsOfSelected = (elements, ids) => {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const idSet = new Set(ids);
  return ids.filter((id) => {
    let parentId = byId.get(id)?.parentId ?? null;
    while (parentId) {
      if (idSet.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  });
};

/**
 * 计算选中元素所属分组的全部成员 id 集合。
 * 选中某分组任一成员时,整组成员都视为「分组选中」(高亮/一起操作)。
 * @param {object[]} elements - 全部元素
 * @param {string[]} selectedIds - 当前选中的元素 id
 * @returns {Set<string>} 分组成员 id 集合
 */
export const buildGroupedIds = (elements, selectedIds) => {
  const selectedSet = new Set(selectedIds);
  const selectedGroupIds = new Set();
  for (const e of elements) {
    if (e.groupId && selectedSet.has(e.id)) selectedGroupIds.add(e.groupId);
  }
  if (!selectedGroupIds.size) return new Set();
  const grouped = new Set();
  for (const e of elements) {
    if (e.groupId && selectedGroupIds.has(e.groupId)) grouped.add(e.id);
  }
  return grouped;
};

/** 判断元素是否为可编辑表单控件(快捷键在此类元素聚焦时应放行原生行为) */
export const isEditable = (el) => {
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
};

/** 不可变更新：替换指定 id 的元素 */
export const patchElement = (elements, id, patch) =>
  elements.map((el) => (el.id === id ? { ...el, ...patch, props: patch.props ? { ...el.props, ...patch.props } : el.props } : el));

/**
 * 不可变批量更新。patches 形状与 patchElement 的 patch 参数对齐:
 * `[{ id, patch: { x, y, ... } }]`--取出 patch 再展开到对应元素,
 * 切勿整项展开(否则会把 `patch` 字段本身写到元素上,而非 x/y)。
 */
export const patchElements = (elements, patches) => {
  const map = new Map(patches.map((p) => [p.id, p.patch]));
  return elements.map((el) => {
    const patch = map.get(el.id);
    if (!patch) return el;
    return { ...el, ...patch, props: patch.props ? { ...el.props, ...patch.props } : el.props };
  });
};

/**
 * 重新排列容器内元素的 z 索引
 * @param {Array} elements - 所有元素
 * @param {string} parentId - 容器 id
 * @param {Array} newOrder - 新顺序的 id 数组
 * @returns {Array} 更新后的元素数组
 */
export const reorderContainerChildren = (elements, parentId, newOrder) => {
  const zMap = new Map(newOrder.map((id, index) => [id, index]));
  return elements.map((el) => {
    if ((el.parentId ?? null) !== parentId) return el;
    const z = zMap.get(el.id);
    return z !== undefined ? { ...el, z } : el;
  });
};

/**
 * 克隆一组元素到新模板:新 id、新 templateId、重映射 parentId/groupId、
 * 保留 z/unit/rotation/locked/hidden,x/y 原样(不同模板不重叠)。
 * 用于「复制模板」。输入 elements 须已限定在单一模板内。
 */
export function cloneElementsForTemplate(elements, newTemplateId) {
  const idMap = new Map();
  const groupIdMap = new Map();
  for (const e of elements) {
    idMap.set(e.id, genId());
    if (e.groupId && !groupIdMap.has(e.groupId)) groupIdMap.set(e.groupId, genId("grp"));
  }
  return elements.map((e) => ({
    ...e,
    id: idMap.get(e.id),
    templateId: newTemplateId,
    parentId: e.parentId ? (idMap.get(e.parentId) ?? null) : null,
    groupId: e.groupId ? groupIdMap.get(e.groupId) : null,
    props: cloneProps(e.props),
  }));
}

/** parentId -> children[] 索引（null 键为顶层），用于 O(1) 子元素查找 */
export const buildChildrenMap = (elements) => {
  const map = new Map();
  for (const el of elements) {
    const pid = el.parentId ?? null;
    const arr = map.get(pid);
    if (arr) arr.push(el);
    else map.set(pid, [el]);
  }
  return map;
};

/**
 * 将 elementId 移入 targetContainerId 是否成环
 * （target 是 element 自身或其后代）。基于 childrenMap 的迭代 DFS，O(n)。
 */
export const wouldCreateCycle = (elements, elementId, targetContainerId) => {
  if (elementId === null || targetContainerId === null) return false;
  if (elementId === targetContainerId) return true;
  const childrenMap = buildChildrenMap(elements);
  const stack = [elementId];
  const seen = new Set([elementId]);
  while (stack.length) {
    const children = childrenMap.get(stack.pop());
    if (!children) continue;
    for (const c of children) {
      if (c.id === targetContainerId) return true;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return false;
};

/** 两矩形重叠面积(屏幕坐标,均含 zoom 缩放,直接比较即可) */
export const rectOverlapArea = (a, b) => {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return ix * iy;
};

/**
 * 在一组 DOM 元素中,找到包含指定点且面积最小(最内层)的元素。
 * 用于拖放命中测试:画板/容器嵌套时取最内层,与 pickInnermostDroppable 同义。
 * @param {Iterable<HTMLElement>} els - 候选 DOM 元素(NodeList/Array 均可)
 * @param {number} x - 屏幕坐标 x(clientX)
 * @param {number} y - 屏幕坐标 y(clientY)
 * @returns {HTMLElement|null}
 */
export const findSmallestHit = (els, x, y) => {
  let best = null;
  let bestArea = Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = el;
      }
    }
  }
  return best;
};

/**
 * 在流式子元素序列中,按落点中心找到插入索引。
 * 按渲染顺序遍历,找第一个「落点中心在其左半」的兄弟,插其前面;否则追加末尾。
 * @param {Array<{id, rect}>} orderedSiblings - 已按 z 排序、含 DOM rect 的兄弟(已排除拖拽元素)
 * @param {{x:number,y:number}} center - 落点中心(屏幕坐标)
 * @returns {number} 插入索引 0..length
 */
export const findFlowInsertIndex = (orderedSiblings, center) => {
  for (let i = 0; i < orderedSiblings.length; i++) {
    const mid = orderedSiblings[i].rect.left + orderedSiblings[i].rect.width / 2;
    if (center.x < mid) return i;
  }
  return orderedSiblings.length;
};
