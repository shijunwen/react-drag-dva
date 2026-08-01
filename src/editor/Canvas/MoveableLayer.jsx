import { memo, useMemo, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import Moveable from "react-moveable";
import {
  elementsAtom,
  selectedIdsAtom,
  selectAtom,
  updateElementAtom,
  updateElementsAtom,
  beginChangeAtom,
  zoomAtom,
  canvasWidthAtom,
  canvasHeightAtom,
  dropElementAtom,
  dragOverContainerIdAtom,
} from "@/atoms";
import { SNAP_THRESHOLD } from "../constants";
import { pxToUnit, rectOverlapArea, findFlowInsertIndex } from "../utils";
import { ELEMENT_TYPES } from "../elements";

const round = (v, decimals = 0) => {
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
};
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** 直接写 DOM，拖拽/缩放过程中不触发 React 重渲染（高性能）
 *  根据 unit 决定 x/width 用 % 还是 px，y/height 始终为 px
 */
const applyToDom = (target, patch, unit = "px") => {
  const xIsPercent = unit === "%";
  if (patch.x !== undefined) target.style.left = xIsPercent ? `${patch.x}%` : `${patch.x}px`;
  if (patch.y !== undefined) target.style.top = `${patch.y}px`;
  if (patch.width !== undefined) target.style.width = xIsPercent ? `${patch.width}%` : `${patch.width}px`;
  if (patch.height !== undefined) target.style.height = `${patch.height}px`;
};

/**
 * 锁定节点的可滚祖先(overflow: auto -> visible),返回可恢复快照。
 * 拖拽时禁用 .content 自动滚动(moveable Scrollable able 会滚它),且 visible
 * 不截断,让拖拽元素能视觉飞出容器边界。
 */
const lockScrollAncestors = (node) => {
  const locked = [];
  let p = node?.parentElement;
  while (p && p !== document.documentElement) {
    // 到达画板即停止：画板之上的 InfiniteViewer .wrapper(overflow:auto)是画布
    // 滚动/缩放容器，锁定它会清空其 scrollLeft/Top，导致画布整体漂移到右下角。
    // 仅锁定画板以内的可滚祖先(容器 .content)，让拖拽元素能视觉飞出容器边界。
    if (p.id === "canvas-board-el") break;
    const cs = getComputedStyle(p);
    const isAutoScroll =
      cs.overflow === "auto" || cs.overflowX === "auto" || cs.overflowY === "auto";
    if (isAutoScroll) {
      locked.push({ el: p, prev: p.style.overflow });
      p.style.overflow = "visible";
    }
    p = p.parentElement;
  }
  return locked;
};
const unlockScrollAncestors = (locked) => {
  locked.forEach(({ el, prev }) => {
    el.style.overflow = prev;
  });
};

// 提升到模块作用域的稳定回调/常量，避免每次 render 产生新引用传给 Moveable
const SNAP_DIST_FORMAT = (v) => `${v}px`;
const ZERO_SCROLL_POS = [0, 0];
const GET_SCROLL_POSITION = () => ZERO_SCROLL_POS;

/**
 * react-moveable 控制层。
 * 性能策略：手势过程中只写 DOM（零 React 重渲染），手势结束才一次性提交到 atoms。
 * - 顶层元素：拖拽（left/top）+ 缩放，落点即位置
 * - 容器内元素：拖拽时 transform 悬浮（占位保留），落地碰撞定归属 + 流式插入；缩放照旧
 */
function MoveableLayer({ elementRefs, moveableRef }) {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const beginChange = useSetAtom(beginChangeAtom);
  const dropElement = useSetAtom(dropElementAtom);
  const setDragOverId = useSetAtom(dragOverContainerIdAtom);
  const zoom = useAtomValue(zoomAtom);
  const canvasWidth = useAtomValue(canvasWidthAtom);
  const canvasHeight = useAtomValue(canvasHeightAtom);

  // id -> element 的 O(1) 索引，替换拖拽/缩放热路径中的 elements.find（每帧多次）
  const elementsById = useMemo(() => {
    const m = new Map();
    for (const el of elements) m.set(el.id, el);
    return m;
  }, [elements]);

  // 缩放变化 或 元素状态变化（undo/redo）后，让 moveable 重新计算控制框位置
  useEffect(() => {
    if (moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, elements, moveableRef]);

  const dirtyRef = useRef(false); // 本次手势是否产生过位移（用于延迟记历史）
  const pendingRef = useRef([]); // 待提交的 patches
  const dragCtxRef = useRef(null); // 拖拽上下文：{ mode: "top"|"container", id, parentId? }
  const scrollLockRef = useRef([]); // 拖拽期间锁定的可滚祖先(用于恢复)
  const dragOverRef = useRef(null); // 当前悬停的容器 id(去重用，避免每帧写 atom 触发重渲染)

  // 选中元素引用
  const targets = selectedIds
    .map((id) => elementRefs.current.get(id))
    .filter(Boolean);
  const isGroup = targets.length > 1;

  // undo/redo 后选中元素可能已不存在，过滤无效选中
  const select = useSetAtom(selectAtom);
  const hasInvalidSelection = useMemo(
    () => selectedIds.length > 0 && selectedIds.some((id) => !elementsById.has(id)),
    [selectedIds, elementsById],
  );
  useEffect(() => {
    if (hasInvalidSelection) {
      select(selectedIds.filter((id) => elementsById.has(id)));
    }
  }, [hasInvalidSelection, selectedIds, elementsById, select]);

  // 判断是否是容器内元素 + 吸附参考线（共用一次 idSet / firstSelected 计算）
  const idSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const firstSelected = useMemo(() => {
    for (const el of elements) {
      if (idSet.has(el.id)) return el;
    }
    return null;
  }, [elements, idSet]);
  const parentId = firstSelected?.parentId ?? null;
  const isInContainer = targets.length > 0 && parentId !== null;

  // 吸附参考线：用 elementGuidelines 传入其他元素的 DOM 节点，
  // moveable 会自动读取 getBoundingClientRect 计算 snap，无需手动换算坐标
  const elementGuidelines = useMemo(
    () =>
      elements
        .filter((el) => (el.parentId ?? null) === parentId && !idSet.has(el.id))
        .map((el) => elementRefs.current.get(el.id))
        .filter(Boolean),
    [elements, parentId, idSet, elementRefs],
  );

  // 单选均可拖；多选仅顶层（容器内多选仅 resize）
  const draggable = !(isGroup && isInContainer);
  const resizable = true;
  const snappable = !isInContainer;

  // 容器 id 列表（拖拽命中测试只遍历容器，不扫描全部元素）
  const containerIds = useMemo(
    () => elements.filter((e) => e.type === ELEMENT_TYPES.CONTAINER).map((e) => e.id),
    [elements],
  );

  if (!targets.length) return null;

  // 首次位移时才记录历史，避免空操作产生撤销项
  const begin = () => {
    if (!dirtyRef.current) {
      beginChange();
      dirtyRef.current = true;
    }
  };
  const commitSingle = () => {
    if (dirtyRef.current && pendingRef.current.length) {
      // 同步提交：moveable 在 dragEnd/resizeEnd 后会自动 updateRect，
      // 需保证此时新 left/top 已写入 DOM，否则控制框停在旧位置。
      flushSync(() => updateElement(pendingRef.current[0]));
    }
    dirtyRef.current = false;
    pendingRef.current = [];
  };
  const commitGroup = () => {
    if (dirtyRef.current && pendingRef.current.length) {
      flushSync(() => updateElements(pendingRef.current));
    }
    dirtyRef.current = false;
    pendingRef.current = [];
  };

  /**
   * 找与给定 rect 重叠的最内层容器（面积最小命中），与 pickInnermostDroppable 一致。
   * 供落地判定(resolveDrop)与拖拽中悬停高亮(updateDragOver)共用，确保「高亮即落地目标」。
   */
  const findDropContainer = (tRect, selfId) => {
    let best = null;
    for (const id of containerIds) {
      if (id === selfId) continue; // 容器不能拖入自身
      const node = elementRefs.current.get(id);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (rectOverlapArea(tRect, r) <= 0) continue;
      const area = r.width * r.height;
      if (!best || area < best.area) best = { id, area };
    }
    return best;
  };

  /**
   * 拖拽过程中更新悬停的容器高亮：命中容器则高亮，离开则清除。
   * 用 ref 去重，仅在悬停目标变化时写 atom，避免每帧触发容器重渲染。
   */
  const updateDragOver = (target, el) => {
    const tRect = target.getBoundingClientRect();
    const best = findDropContainer(tRect, el.id);
    const nextId = best ? best.id : null;
    if (dragOverRef.current !== nextId) {
      dragOverRef.current = nextId;
      setDragOverId(nextId);
    }
  };

  /**
   * 容器内拖拽落地：按拖拽元素 rect 与各容器 rect 的重叠判定归属。
   * - 命中容器（取最内层）-> 移入并按落点算流式插入索引
   * - 未命中容器 -> 移出为顶层，按落点中心换算绝对坐标
   */
  const resolveDrop = (target, el) => {
    const tRect = target.getBoundingClientRect();
    const cx = tRect.left + tRect.width / 2;
    const cy = tRect.top + tRect.height / 2;

    // 找所有重叠容器，取最内层（面积最小命中）——与 pickInnermostDroppable 一致
    const best = findDropContainer(tRect, el.id);

    if (best) {
      // 命中容器：按落点中心在流式兄弟序列中找插入索引
      const siblings = elements
        .filter((e) => (e.parentId ?? null) === best.id && e.id !== el.id)
        .toSorted((a, b) => (a.z || 0) - (b.z || 0))
        .map((s) => ({ id: s.id, rect: elementRefs.current.get(s.id)?.getBoundingClientRect() }))
        .filter((s) => s.rect);
      const insertIndex = findFlowInsertIndex(siblings, { x: cx, y: cy });
      return { targetParentId: best.id, insertIndex };
    }

    // 未命中容器：落画布顶层，按落点中心换算绝对坐标
    const board = document.getElementById("canvas-board-el");
    const br = board?.getBoundingClientRect();
    if (!br) return { targetParentId: null, x: el.x ?? 0, y: el.y ?? 0 };
    const x = Math.round((cx - br.left) / zoom - el.width / 2);
    const y = Math.round((cy - br.top) / zoom - el.height / 2);
    return { targetParentId: null, x, y };
  };

  return (
    <Moveable
      ref={moveableRef}
      target={isGroup ? targets : targets[0]}
      draggable={draggable}
      resizable={resizable}
      snappable={snappable}
      snapThreshold={SNAP_THRESHOLD}
      elementGuidelines={elementGuidelines}
      isDisplaySnapDigit
      snapDigit={0}
      snapDistFormat={SNAP_DIST_FORMAT}
      zoom={zoom}
      // moveable 的 Scrollable able 不检查 scrollable prop,拖拽时总会触发 @scena/dragscroll:
      // gesto.scrollBy 滚 getContainer()(= viewer,因 MoveableLayer 在 board 外),导致画布漂移;
      // 也会滚 .content。覆写 getScrollPosition 恒返回 0 -> DragScroll offset=0 不触发滚动。
      scrollContainer="#canvas-board-el"
      getScrollPosition={GET_SCROLL_POSITION}
      /* ---------- 单元素 ---------- */
      onDragStart={
        draggable
          ? (e) => {
              // 清除可能残留的悬停高亮（上次拖拽异常中断时）
              dragOverRef.current = null;
              setDragOverId(null);
              const id = e.target?.dataset?.id;
              const el = id ? elementsById.get(id) : undefined;
              if (!el) return;
              // dragCtx 在整个手势内不变，起手时设定一次即可（避免每帧重复分配）
              dragCtxRef.current = el.parentId
                ? { mode: "container", id, parentId: el.parentId }
                : { mode: "top", id };
              if (el.parentId) {
                // 容器内拖拽:锁定 .content 等可滚祖先,防止 moveable 自动滚动导致坐标错乱
                scrollLockRef.current = lockScrollAncestors(e.target);
              }
            }
          : undefined
      }
      onDrag={
        draggable
          ? (e) => {
              const id = e.target.dataset.id;
              const el = elementsById.get(id);
              if (!el) return;
              if (el.parentId) {
                // 容器内：transform 悬浮（占位保留，零重渲染），落地由 onDragEnd 碰撞定归属
                const [dx, dy] = e.dist;
                e.target.style.transform = `translate(${dx}px, ${dy}px)`;
                e.target.style.zIndex = "999";
                pendingRef.current = [];
                updateDragOver(e.target, el);
                return;
              }
              // 顶层：left/top
              begin();
              const unit = el.unit || "px";
              const isPercent = unit === "%";
              const gx = pxToUnit(e.dist[0], unit, canvasWidth);
              const gy = e.dist[1];
              const maxX = isPercent ? 100 - el.width : canvasWidth - el.width;
              const x = clamp(round(el.x + gx, isPercent ? 2 : 0), 0, maxX);
              const y = clamp(round(el.y + gy), 0, canvasHeight - el.height);
              applyToDom(e.target, { x, y }, unit);
              pendingRef.current = [{ id, patch: { x, y } }];
              updateDragOver(e.target, el);
            }
          : undefined
      }
      onDragEnd={
        draggable
          ? (e) => {
              const ctx = dragCtxRef.current;
              const restore = () => {
                unlockScrollAncestors(scrollLockRef.current);
                scrollLockRef.current = [];
              };
              if (ctx?.mode === "container") {
                const el = elementsById.get(ctx.id);
                if (el) {
                  const drop = resolveDrop(e.target, el);
                  flushSync(() => dropElement({ id: ctx.id, ...drop }));
                }
                if (e.target) {
                  e.target.style.transform = "";
                  e.target.style.zIndex = "";
                }
                restore();
                dragCtxRef.current = null;
                dirtyRef.current = false;
                pendingRef.current = [];
              } else if (ctx?.mode === "top") {
                // 顶层落地:落在容器内则移入,否则提交 x/y
                const el = elementsById.get(ctx.id);
                let movedToContainer = false;
                if (el) {
                  const drop = resolveDrop(e.target, el);
                  if (drop.targetParentId !== null) {
                    flushSync(() =>
                      dropElement({
                        id: ctx.id,
                        targetParentId: drop.targetParentId,
                        insertIndex: drop.insertIndex,
                      })
                    );
                    movedToContainer = true;
                  }
                }
                if (!movedToContainer) commitSingle();
                restore();
                dragCtxRef.current = null;
              } else {
                commitSingle();
                restore();
                dragCtxRef.current = null;
              }
              // 拖拽结束：清除容器悬停高亮
              dragOverRef.current = null;
              setDragOverId(null);
            }
          : undefined
      }
      onResize={(e) => {
        begin();
        const id = e.target.dataset.id;
        const el = elementsById.get(id);
        if (!el) return;
        const unit = el.unit || "px";
        const isPercent = unit === "%";
        // e.width/e.drag.left 均为逻辑像素；% 模式下换算为百分比
        const width = isPercent
          ? round(pxToUnit(e.width, unit, canvasWidth), 2)
          : round(e.width);
        const patch = {
          width,
          height: round(e.height),
        };
        if (!isInContainer) {
          const maxX = isPercent ? 100 - width : canvasWidth - width;
          patch.x = clamp(
            round(pxToUnit(e.drag.left, unit, canvasWidth), isPercent ? 2 : 0),
            0,
            maxX
          );
          patch.y = clamp(round(e.drag.top), 0, canvasHeight - patch.height);
        }
        applyToDom(e.target, patch, unit);
        pendingRef.current = [{ id, patch }];
      }}
      onResizeEnd={commitSingle}
      /* ---------- 分组 / 多选 ---------- */
      onDragGroup={
        draggable
          ? (e) => {
              begin();
              pendingRef.current = e.events.map((ev) => {
                const id = ev.target.dataset.id;
                const el = elementsById.get(id);
                if (!el) return { id, patch: {} };
                const unit = el.unit || "px";
                const isPercent = unit === "%";
                const gx = pxToUnit(ev.dist[0], unit, canvasWidth);
                const gy = ev.dist[1];
                const maxX = isPercent ? 100 - el.width : canvasWidth - el.width;
                const x = clamp(round(el.x + gx, isPercent ? 2 : 0), 0, maxX);
                const y = clamp(round(el.y + gy), 0, canvasHeight - el.height);
                applyToDom(ev.target, { x, y }, unit);
                return { id, patch: { x, y } };
              });
            }
          : undefined
      }
      onDragGroupEnd={draggable ? commitGroup : undefined}
      onResizeGroup={(e) => {
        begin();
        pendingRef.current = e.events.map((ev) => {
          const id = ev.target.dataset.id;
          const el = elementsById.get(id);
          if (!el) return { id, patch: {} };
          const unit = el.unit || "px";
          const isPercent = unit === "%";
          const width = isPercent
            ? round(pxToUnit(ev.width, unit, canvasWidth), 2)
            : round(ev.width);
          const patch = {
            width,
            height: round(ev.height),
          };
          if (!isInContainer) {
            const maxX = isPercent ? 100 - width : canvasWidth - width;
            patch.x = clamp(
              round(pxToUnit(ev.drag.left, unit, canvasWidth), isPercent ? 2 : 0),
              0,
              maxX
            );
            patch.y = clamp(round(ev.drag.top), 0, canvasHeight - patch.height);
          }
          applyToDom(ev.target, patch, unit);
          return { id, patch };
        });
      }}
      onResizeGroupEnd={commitGroup}
    />
  );
}

// props 均为稳定 ref(elementRefs/moveableRef)，memo 阻断父级 Canvas
// 重渲染(如鼠标移动)波及至此；自身仍随 elementsAtom/selectedIdsAtom 更新。
export default memo(MoveableLayer);
