import { useMemo, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import {
  elementsAtom,
  selectedIdsAtom,
  selectAtom,
  updateElementAtom,
  updateElementsAtom,
  beginChangeAtom,
  zoomAtom,
  viewportAtom,
  templatesAtom,
  dropElementAtom,
  dragOverContainerIdAtom,
  DEFAULT_TEMPLATE_ID,
} from "@/atoms";
import { SNAP_THRESHOLD } from "../../constants";
import { pxToUnit } from "../../utils";
import { ELEMENT_TYPES } from "../../elements";
import {
  round,
  clamp,
  applyToDom,
  lockScrollAncestors,
  unlockScrollAncestors,
  buildRotationTransform,
  SNAP_DIST_FORMAT,
  GET_SCROLL_POSITION,
  FALLBACK_SIZE,
  getViewerWrapper,
} from "../moveableHelpers";
import { findDropContainer, resolveDrop } from "../dropLogic";

/**
 * react-moveable 手势逻辑层(从 MoveableLayer 抽出)。
 * 性能策略不变:手势过程中只写 DOM(零 React 重渲染),手势结束才一次性提交到 atoms;
 * beginChange 延迟到首次位移。
 *
 * 订阅边界不变:直接订阅 elementsAtom/selectedIdsAtom/templatesAtom/zoomAtom,
 * 不走 useEditor(避免订 pastAtom/futureAtom 导致每手势一次的无谓重渲染)。
 *
 * 返回 { targets, isGroup, moveableProps }。targets 为空时 moveableProps 为 null
 * (MoveableLayer 据此不渲染 <Moveable>),与原 if(!targets.length) return null 等价。
 */
export function useMoveableGestures({ elementRefs, moveableRef, viewerRef, gridSnapEnabled, gridSnapSize }) {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const templates = useAtomValue(templatesAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const beginChange = useSetAtom(beginChangeAtom);
  const dropElement = useSetAtom(dropElementAtom);
  const setDragOverId = useSetAtom(dragOverContainerIdAtom);
  const zoom = useAtomValue(zoomAtom);

  // id -> element 的 O(1) 索引，替换拖拽/缩放热路径中的 elements.find（每帧多次）
  const elementsById = useMemo(() => {
    const m = new Map();
    for (const el of elements) m.set(el.id, el);
    return m;
  }, [elements]);

  // templateId -> {width,height} 的 O(1) 索引,供拖拽/缩放按元素所属模板尺寸 clamp/换算
  const templateSizeMap = useMemo(() => {
    const m = new Map();
    for (const t of templates) m.set(t.id, { width: t.width, height: t.height });
    return m;
  }, [templates]);

  const sizeFor = useCallback(
    (el) => templateSizeMap.get(el?.templateId ?? DEFAULT_TEMPLATE_ID) ?? FALLBACK_SIZE,
    [templateSizeMap],
  );

  // 所有 ref 声明放在前面
  const dirtyRef = useRef(false); // 本次手势是否产生过位移（用于延迟记历史）
  const pendingRef = useRef([]); // 待提交的 patches
  const dragCtxRef = useRef(null); // 拖拽上下文：{ mode: "top"|"container", id, parentId? }
  const scrollLockRef = useRef([]); // 拖拽期间锁定的可滚祖先(用于恢复)
  const dragOverRef = useRef(null); // 当前悬停的容器 id(去重用，避免每帧写 atom 触发重渲染)
  const scrollListenerRef = useRef(null);
  const scrollPinnedRef = useRef(false);
  const pinnedScrollRef = useRef({ left: 0, top: 0 });

  // 固定 InfiniteViewer 包装器的滚动位置（支持多手势并发）
  const pinViewerScroll = useCallback(() => {
    if (scrollPinnedRef.current) return;
    const wrapper = getViewerWrapper(viewerRef?.current);
    if (!wrapper) return;
    pinnedScrollRef.current = { left: wrapper.scrollLeft, top: wrapper.scrollTop };
    const resetScroll = () => {
      wrapper.scrollLeft = pinnedScrollRef.current.left;
      wrapper.scrollTop = pinnedScrollRef.current.top;
    };
    wrapper.addEventListener("scroll", resetScroll, { passive: false });
    scrollListenerRef.current = resetScroll;
    scrollPinnedRef.current = true;
  }, [viewerRef]);

  const unpinViewerScroll = useCallback(() => {
    if (!scrollPinnedRef.current) return;
    const wrapper = getViewerWrapper(viewerRef?.current);
    if (!wrapper || !scrollListenerRef.current) return;
    wrapper.removeEventListener("scroll", scrollListenerRef.current);
    scrollListenerRef.current = null;
    scrollPinnedRef.current = false;
  }, [viewerRef]);

  // 订阅 viewport 滚动变化(非 zoom)来更新控制框位置
  const { scrollLeft, scrollTop } = useAtomValue(viewportAtom);

  // 缩放 / 元素变化 / 滚动位置变化后重算控制框位置
  useEffect(() => {
    // 仅在非手势期间更新(手势期间 scroll 被锁定,不需要更新)
    if (!scrollPinnedRef.current && moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, elements, moveableRef, scrollLeft, scrollTop]);

  // 选中元素引用
  const targets = selectedIds
    .map((id) => elementRefs.current.get(id))
    .filter(Boolean);
  const isGroup = targets.length > 1;
  const hasLockedSelected = selectedIds.some((id) => elementsById.get(id)?.locked);
  const snapGridWidth = gridSnapEnabled ? gridSnapSize : 0;
  const snapGridHeight = gridSnapEnabled ? gridSnapSize : 0;

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
  const firstTemplateId = firstSelected?.templateId ?? DEFAULT_TEMPLATE_ID;
  const isInContainer = targets.length > 0 && parentId !== null;

  // 吸附参考线:用 elementGuidelines 传入其他元素的 DOM 节点,
  // moveable 自动读 getBoundingClientRect 算 snap。限定同模板同父级,避免跨板吸附。
  const elementGuidelines = useMemo(
    () =>
      elements
        .filter(
          (el) =>
            (el.parentId ?? null) === parentId &&
            (el.templateId ?? DEFAULT_TEMPLATE_ID) === firstTemplateId &&
            !idSet.has(el.id),
        )
        .map((el) => elementRefs.current.get(el.id))
        .filter(Boolean),
    [elements, parentId, firstTemplateId, idSet, elementRefs],
  );

  // 单选均可拖；多选仅顶层（容器内多选仅 resize）
  const draggable = !hasLockedSelected && !(isGroup && isInContainer);
  const resizable = !hasLockedSelected;
  const rotatable = !hasLockedSelected;
  const snappable = !isInContainer;

  // 容器 id 列表（拖拽命中测试只遍历容器，不扫描全部元素）
  const containerIds = useMemo(
    () => elements.filter((e) => e.type === ELEMENT_TYPES.CONTAINER).map((e) => e.id),
    [elements],
  );

  if (!targets.length) {
    return { targets, isGroup, moveableProps: null };
  }

  // 首次位移时才记录历史，避免空操作产生撤销项
  const begin = () => {
    if (!dirtyRef.current) {
      beginChange();
      dirtyRef.current = true;
    }
  };
  const commitSingle = () => {
    if (dirtyRef.current && pendingRef.current.length) {
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

  const updateDragOver = (target, el) => {
    const tRect = target.getBoundingClientRect();
    const best = findDropContainer(tRect, el.id, containerIds, elementRefs);
    const nextId = best ? best.id : null;
    if (dragOverRef.current !== nextId) {
      dragOverRef.current = nextId;
      setDragOverId(nextId);
    }
  };

  const moveableProps = {
    draggable,
    resizable,
    rotatable,
    snappable,
    snapGridWidth,
    snapGridHeight,
    snapGridAll: true,
    snapThreshold: SNAP_THRESHOLD,
    elementGuidelines,
    isDisplaySnapDigit: true,
    snapDigit: 0,
    snapDistFormat: SNAP_DIST_FORMAT,
    zoom,
    // 只显示四个角的手柄，更清爽美观
    renderDirections: ['nw', 'ne', 'sw', 'se'],
    // 不显示中心点
    origin: false,
    // 多板下 scrollContainer 用网格容器(Scrollable 已被 getScrollPosition 禁用滚动)
    scrollContainer: "[data-boards-grid]",
    getScrollPosition: GET_SCROLL_POSITION,
    /* ---------- 单元素 ---------- */
    onDragStart: draggable
      ? (e) => {
          pinViewerScroll();
          dragOverRef.current = null;
          setDragOverId(null);
          const id = e.target?.dataset?.id;
          const el = id ? elementsById.get(id) : undefined;
          if (!el) return;
          dragCtxRef.current = el.parentId
            ? { mode: "container", id, parentId: el.parentId }
            : { mode: "top", id };
          if (el.parentId) {
            scrollLockRef.current = lockScrollAncestors(e.target);
          }
        }
      : undefined,
    onDrag: draggable
      ? (e) => {
          const id = e.target.dataset.id;
          const el = elementsById.get(id);
          if (!el) return;
          if (el.parentId) {
            // 容器内：transform 悬浮（占位保留，零重渲染），落地由 onDragEnd 碰撞定归属
            const [dx, dy] = e.dist;
            e.target.style.transform = buildRotationTransform(
              `translate(${dx}px, ${dy}px)`,
              el.rotation,
            );
            e.target.style.zIndex = "999";
            pendingRef.current = [];
            updateDragOver(e.target, el);
            return;
          }
          // 顶层：left/top,按元素所属模板尺寸 clamp
          begin();
          const sz = sizeFor(el);
          const unit = el.unit || "px";
          const isPercent = unit === "%";
          const gx = pxToUnit(e.dist[0], unit, sz.width);
          const gy = e.dist[1];
          const maxX = isPercent ? 100 - el.width : sz.width - el.width;
          const x = clamp(round(el.x + gx, isPercent ? 2 : 0), 0, maxX);
          const y = clamp(round(el.y + gy), 0, sz.height - el.height);
          applyToDom(e.target, { x, y }, unit);
          pendingRef.current = [{ id, patch: { x, y } }];
          updateDragOver(e.target, el);
        }
      : undefined,
    onDragEnd: draggable
      ? (e) => {
          const ctx = dragCtxRef.current;
          const restore = () => {
            unlockScrollAncestors(scrollLockRef.current);
            scrollLockRef.current = [];
          };
          if (ctx?.mode === "container") {
            const el = elementsById.get(ctx.id);
            if (el) {
              const drop = resolveDrop(e.target, el, { containerIds, elementRefs, elements, zoom });
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
            // 顶层落地:命中容器则移入;跨板则迁移模板;否则提交 x/y
            const el = elementsById.get(ctx.id);
            let moved = false;
            if (el) {
              const drop = resolveDrop(e.target, el, { containerIds, elementRefs, elements, zoom });
              if (drop.targetParentId !== null) {
                flushSync(() =>
                  dropElement({
                    id: ctx.id,
                    targetParentId: drop.targetParentId,
                    insertIndex: drop.insertIndex,
                  }),
                );
                moved = true;
              } else if (
                drop.targetTemplateId &&
                drop.targetTemplateId !== (el.templateId ?? DEFAULT_TEMPLATE_ID)
              ) {
                // 跨模板顶层迁移
                flushSync(() =>
                  dropElement({
                    id: ctx.id,
                    targetParentId: null,
                    targetTemplateId: drop.targetTemplateId,
                    x: drop.x,
                    y: drop.y,
                  }),
                );
                moved = true;
              }
            }
            if (!moved) commitSingle();
            restore();
            dragCtxRef.current = null;
          } else {
            commitSingle();
            restore();
            dragCtxRef.current = null;
          }
          dragOverRef.current = null;
          setDragOverId(null);
          unpinViewerScroll();
        }
      : undefined,
    onResize: (e) => {
      pinViewerScroll();
      begin();
      const id = e.target.dataset.id;
      const el = elementsById.get(id);
      if (!el) return;
      const sz = sizeFor(el);
      const unit = el.unit || "px";
      const isPercent = unit === "%";

      const containerWidth = isPercent ? 100 : sz.width;
      const containerHeight = sz.height;

      // 获取原始值
      let width = isPercent ? round(pxToUnit(e.width, unit, sz.width), 2) : round(e.width);
      let height = round(e.height);
      let x = isPercent ? round(pxToUnit(e.drag.left, unit, sz.width), isPercent ? 2 : 0) : round(e.drag.left);
      let y = round(e.drag.top);

      if (!isInContainer) {
        const dir = e.direction || [];
        const isLeft = dir.includes("w");
        const isRight = dir.includes("e");
        const isTop = dir.includes("n");
        const isBottom = dir.includes("s");

        // 最小尺寸
        width = Math.max(20, width);
        height = Math.max(20, height);

        let right = x + width;
        let bottom = y + height;

        // 根据拖拽方向处理边界
        if (isLeft) {
          if (x < 0) {
            const overflow = 0 - x;
            width = width + overflow;
            x = 0;
          }
          if (x + width > containerWidth) {
            width = containerWidth - x;
          }
        } else if (isRight) {
          if (right > containerWidth) {
            right = containerWidth;
            width = right - x;
          }
          if (x < 0) x = 0;
        }

        if (isTop) {
          if (y < 0) {
            const overflow = 0 - y;
            height = height + overflow;
            y = 0;
          }
          if (y + height > containerHeight) {
            height = containerHeight - y;
          }
        } else if (isBottom) {
          if (bottom > containerHeight) {
            bottom = containerHeight;
            height = bottom - y;
          }
          if (y < 0) y = 0;
        }

        // 同时处理四个角的情况
        if (isLeft && isTop) {
          if (x < 0) { const overflow = 0 - x; width = width + overflow; x = 0; }
          if (y < 0) { const overflow = 0 - y; height = height + overflow; y = 0; }
          if (x + width > containerWidth) width = containerWidth - x;
          if (y + height > containerHeight) height = containerHeight - y;
        }
        if (isLeft && isBottom) {
          if (x < 0) { const overflow = 0 - x; width = width + overflow; x = 0; }
          if (y + height > containerHeight) height = containerHeight - y;
          if (x + width > containerWidth) width = containerWidth - x;
          if (y < 0) y = 0;
        }
        if (isRight && isTop) {
          if (x + width > containerWidth) width = containerWidth - x;
          if (y < 0) { const overflow = 0 - y; height = height + overflow; y = 0; }
          if (x < 0) x = 0;
          if (y + height > containerHeight) height = containerHeight - y;
        }
        if (isRight && isBottom) {
          if (x + width > containerWidth) width = containerWidth - x;
          if (y + height > containerHeight) height = containerHeight - y;
          if (x < 0) x = 0;
          if (y < 0) y = 0;
        }

        // 最终安全检查
        width = Math.max(20, Math.min(width, containerWidth));
        height = Math.max(20, Math.min(height, containerHeight));
        x = clamp(x, 0, containerWidth - width);
        y = clamp(y, 0, containerHeight - height);
      }

      const patch = {
        width,
        height,
      };

      if (!isInContainer) {
        patch.x = x;
        patch.y = y;
      }

      applyToDom(e.target, patch, unit);
      if (isInContainer) {
        e.target.style.transform = buildRotationTransform(
          `translate(${x}px, ${y}px)`,
          el.rotation,
        );
      }
      pendingRef.current = [{ id, patch }];
    },
    onResizeEnd: () => {
      commitSingle();
      unpinViewerScroll();
    },
    /* ---------- 分组 / 多选 ---------- */
    onDragGroup: draggable
      ? (e) => {
          pinViewerScroll();
          begin();
          pendingRef.current = e.events.map((ev) => {
            const id = ev.target.dataset.id;
            const el = elementsById.get(id);
            if (!el) return { id, patch: {} };
            const sz = sizeFor(el);
            const unit = el.unit || "px";
            const isPercent = unit === "%";
            const gx = pxToUnit(ev.dist[0], unit, sz.width);
            const gy = ev.dist[1];
            const maxX = isPercent ? 100 - el.width : sz.width - el.width;
            const x = clamp(round(el.x + gx, isPercent ? 2 : 0), 0, maxX);
            const y = clamp(round(el.y + gy), 0, sz.height - el.height);
            applyToDom(ev.target, { x, y }, unit);
            if (isInContainer) {
              ev.target.style.transform = buildRotationTransform(
                `translate(${round(ev.dist[0])}px, ${round(ev.dist[1])}px)`,
                el.rotation,
              );
            }
            return { id, patch: { x, y } };
          });
        }
      : undefined,
    onDragGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
    onResizeGroup: (e) => {
      pinViewerScroll();
      begin();
      pendingRef.current = e.events.map((ev) => {
        const id = ev.target.dataset.id;
        const el = elementsById.get(id);
        if (!el) return { id, patch: {} };
        const sz = sizeFor(el);
        const unit = el.unit || "px";
        const isPercent = unit === "%";

        const containerWidth = isPercent ? 100 : sz.width;
        const containerHeight = sz.height;

        let width = isPercent ? round(pxToUnit(ev.width, unit, sz.width), 2) : round(ev.width);
        let height = round(ev.height);
        let x = isPercent ? round(pxToUnit(ev.drag.left, unit, sz.width), isPercent ? 2 : 0) : round(ev.drag.left);
        let y = round(ev.drag.top);

        if (!isInContainer) {
          const dir = ev.direction || [];
          const isLeft = dir.includes("w");
          const isRight = dir.includes("e");
          const isTop = dir.includes("n");
          const isBottom = dir.includes("s");

          // 最小尺寸
          width = Math.max(20, width);
          height = Math.max(20, height);

          let right = x + width;
          let bottom = y + height;

          // 根据拖拽方向处理边界
          if (isLeft) {
            if (x < 0) {
              const overflow = 0 - x;
              width = width + overflow;
              x = 0;
            }
            if (x + width > containerWidth) {
              width = containerWidth - x;
            }
          } else if (isRight) {
            if (right > containerWidth) {
              right = containerWidth;
              width = right - x;
            }
            if (x < 0) x = 0;
          }

          if (isTop) {
            if (y < 0) {
              const overflow = 0 - y;
              height = height + overflow;
              y = 0;
            }
            if (y + height > containerHeight) {
              height = containerHeight - y;
            }
          } else if (isBottom) {
            if (bottom > containerHeight) {
              bottom = containerHeight;
              height = bottom - y;
            }
            if (y < 0) y = 0;
          }

          // 同时处理四个角的情况
          if (isLeft && isTop) {
            if (x < 0) { const overflow = 0 - x; width = width + overflow; x = 0; }
            if (y < 0) { const overflow = 0 - y; height = height + overflow; y = 0; }
            if (x + width > containerWidth) width = containerWidth - x;
            if (y + height > containerHeight) height = containerHeight - y;
          }
          if (isLeft && isBottom) {
            if (x < 0) { const overflow = 0 - x; width = width + overflow; x = 0; }
            if (y + height > containerHeight) height = containerHeight - y;
            if (x + width > containerWidth) width = containerWidth - x;
            if (y < 0) y = 0;
          }
          if (isRight && isTop) {
            if (x + width > containerWidth) width = containerWidth - x;
            if (y < 0) { const overflow = 0 - y; height = height + overflow; y = 0; }
            if (x < 0) x = 0;
            if (y + height > containerHeight) height = containerHeight - y;
          }
          if (isRight && isBottom) {
            if (x + width > containerWidth) width = containerWidth - x;
            if (y + height > containerHeight) height = containerHeight - y;
            if (x < 0) x = 0;
            if (y < 0) y = 0;
          }

          // 最终安全检查
          width = Math.max(20, Math.min(width, containerWidth));
          height = Math.max(20, Math.min(height, containerHeight));
          x = clamp(x, 0, containerWidth - width);
          y = clamp(y, 0, containerHeight - height);
        }

        const patch = { width, height };
        if (!isInContainer) { patch.x = x; patch.y = y; }
        applyToDom(ev.target, patch, unit);
        if (isInContainer) {
          ev.target.style.transform = buildRotationTransform(`translate(${x}px, ${y}px)`, el.rotation);
        }
        return { id, patch };
      });
    },
    onResizeGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
    onRotate: rotatable
      ? (e) => {
          pinViewerScroll();
          begin();
          const id = e.target.dataset.id;
          const el = elementsById.get(id);
          if (!el) return;
          const rotation = round(e.rotation);
          applyToDom(e.target, { rotation });
          pendingRef.current = [{ id, patch: { rotation } }];
        }
      : undefined,
    onRotateEnd: () => {
      commitSingle();
      unpinViewerScroll();
    },
    onRotateGroup: rotatable
      ? (e) => {
          pinViewerScroll();
          begin();
          pendingRef.current = e.events.map((ev) => {
            const id = ev.target.dataset.id;
            const el = elementsById.get(id);
            if (!el) return { id, patch: {} };
            const rotation = round(ev.rotation);
            ev.target.style.transform = buildRotationTransform(undefined, rotation);
            return { id, patch: { rotation } };
          });
        }
      : undefined,
    onRotateGroupEnd: () => {
      commitGroup();
      unpinViewerScroll();
    },
  };

  return { targets, isGroup, moveableProps };
}
