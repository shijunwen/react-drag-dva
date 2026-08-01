import { useMemo, useRef, useEffect } from "react";
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
  viewportAtom,
} from "@/atoms";
import { SNAP_THRESHOLD } from "../constants";
import { pxToUnit } from "../utils";

const round = (v, decimals = 0) => {
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
};
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** 直接写 DOM，拖拽/缩放过程中不触发 React 重渲染（高性能）
 *  根据 unit 决定 x/width 用 % 还是 px，y/height 始终用 px
 */
const applyToDom = (target, patch, unit = "px") => {
  const xIsPercent = unit === "%";
  if (patch.x !== undefined) target.style.left = xIsPercent ? `${patch.x}%` : `${patch.x}px`;
  if (patch.y !== undefined) target.style.top = `${patch.y}px`;
  if (patch.width !== undefined) target.style.width = xIsPercent ? `${patch.width}%` : `${patch.width}px`;
  if (patch.height !== undefined) target.style.height = `${patch.height}px`;
};

/**
 * react-moveable 控制层。
 * 性能策略：手势过程中只写 DOM（零 React 重渲染），手势结束才一次性提交到 atoms。
 * - 顶层元素：可拖拽 + 可缩放
 * - 容器内元素：只能缩放（位置由 flex 布局管理）
 */
export default function MoveableLayer({ elementRefs, moveableRef }) {
  const elements = useAtomValue(elementsAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const beginChange = useSetAtom(beginChangeAtom);
  const zoom = useAtomValue(viewportAtom).zoom;
  const canvasWidth = useAtomValue(viewportAtom).canvasWidth;
  const canvasHeight = useAtomValue(viewportAtom).canvasHeight;

  // 缩放变化 或 元素状态变化（undo/redo）后，让 moveable 重新计算控制框位置
  useEffect(() => {
    if (moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, elements, moveableRef]);

  const dirtyRef = useRef(false); // 本次手势是否产生过位移（用于延迟记历史）
  const pendingRef = useRef([]); // 待提交的 patches

  // 选中元素引用
  const targets = selectedIds
    .map((id) => elementRefs.current.get(id))
    .filter(Boolean);
  const isGroup = targets.length > 1;

  // undo/redo 后选中元素可能已不存在，过滤无效选中
  const validSelectedIds = selectedIds.filter((id) =>
    elements.some((el) => el.id === id),
  );
  const select = useSetAtom(selectAtom);
  useEffect(() => {
    if (validSelectedIds.length !== selectedIds.length) {
      select(validSelectedIds);
    }
  }, [validSelectedIds, selectedIds, select]);

  // 判断是否是容器内元素
  const isInContainer = useMemo(() => {
    if (!targets.length) return false;
    const idSet = new Set(selectedIds);
    const firstSelected = elements.find((el) => idSet.has(el.id));
    return firstSelected?.parentId !== null;
  }, [elements, selectedIds, targets.length]);

  // 吸附参考线：用 elementGuidelines 传入其他元素的 DOM 节点，
  // moveable 会自动读取 getBoundingClientRect 计算 snap，无需手动换算坐标
  const idSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const firstSelected = elements.find((el) => idSet.has(el.id));
  const parentId = firstSelected?.parentId ?? null;
  const elementGuidelines = elements
    .filter((el) => (el.parentId ?? null) === parentId && !idSet.has(el.id))
    .map((el) => elementRefs.current.get(el.id))
    .filter(Boolean);

  // 容器内元素只允许 resize，不允许 drag
  const draggable = !isInContainer;
  const resizable = true;
  const snappable = !isInContainer;

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
      snapDistFormat={(v) => `${v}px`}
      zoom={zoom}
      /* ---------- 单元素 ---------- */
      onDrag={
        draggable
          ? (e) => {
              begin();
              const id = e.target.dataset.id;
              const el = elements.find((item) => item.id === id);
              if (!el) return;
              const unit = el.unit || "px";
              const isPercent = unit === "%";
              // e.dist 是逻辑像素位移；% 模式下换算为百分比增量再累加
              const gx = pxToUnit(e.dist[0], unit, canvasWidth);
              const gy = e.dist[1];
              const maxX = isPercent ? 100 - el.width : canvasWidth - el.width;
              const x = clamp(round(el.x + gx, isPercent ? 2 : 0), 0, maxX);
              const y = clamp(round(el.y + gy), 0, canvasHeight - el.height);
              applyToDom(e.target, { x, y }, unit);
              pendingRef.current = [{ id, patch: { x, y } }];
            }
          : undefined
      }
      onDragEnd={draggable ? commitSingle : undefined}
      onResize={(e) => {
        begin();
        const id = e.target.dataset.id;
        const el = elements.find((item) => item.id === id);
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
                const el = elements.find((item) => item.id === id);
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
          const el = elements.find((item) => item.id === id);
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
