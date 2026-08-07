import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useSetAtom } from "jotai";
import { updateElementAtom, updateElementsAtom } from "../../../atoms/elements/crud";
import { beginChangeAtom } from "../../../atoms/history";
import { getViewerWrapper } from "../moveableHelpers";

/**
 * 手势生命周期(从 useMoveableGestures 抽出):
 * - pinViewerScroll / unpinViewerScroll:固定 InfiniteViewer 包装器滚动位置(支持多手势并发)
 * - begin:首次位移才记历史(beginChangeAtom),避免空操作产生撤销项
 * - commitSingle / commitGroup:手势结束时把 pending patches 一次性提交到 atoms(flushSync)
 * - pendingRef / dirtyRef / scrollPinnedRef:暴露给装配层的手势状态
 * - 缩放 / 元素变化 / 滚动位置变化后重算控制框位置的 effect(非手势期间才更新)
 */
export function useMoveableCommit({ viewerRef, moveableRef, zoom, elements, scrollLeft, scrollTop }) {
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const beginChange = useSetAtom(beginChangeAtom);

  // 本次手势是否产生过位移(用于延迟记历史)
  const dirtyRef = useRef(false);
  // 待提交的 patches
  const pendingRef = useRef([]);
  const scrollListenerRef = useRef(null);
  const scrollPinnedRef = useRef(false);
  const pinnedScrollRef = useRef({ left: 0, top: 0 });

  // 固定 InfiniteViewer 包装器的滚动位置(支持多手势并发)
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

  // 缩放 / 元素变化 / 滚动位置变化后重算控制框位置
  useEffect(() => {
    // 仅在非手势期间更新(手势期间 scroll 被锁定,不需要更新)
    if (!scrollPinnedRef.current && moveableRef.current) {
      requestAnimationFrame(() => moveableRef.current.updateRect());
    }
  }, [zoom, elements, moveableRef, scrollLeft, scrollTop]);

  // 首次位移时才记录历史,避免空操作产生撤销项
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

  return {
    pinViewerScroll,
    unpinViewerScroll,
    begin,
    commitSingle,
    commitGroup,
    pendingRef,
    dirtyRef,
    scrollPinnedRef,
  };
}
