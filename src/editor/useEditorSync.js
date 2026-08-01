import { useEffect, useRef } from "react";
import { useSetAtom, useStore } from "jotai";
import { elementsAtom, setElementsAtom } from "@/atoms";

/**
 * 受控同步:把外部 props 与内部 elementsAtom 双向绑定。
 *
 * - value === undefined(非受控):Editor 自管状态;可选 initialElements 作挂载种子;
 *   onChange 仅作外部观察回调。
 * - value 提供(受控):外部变更覆盖内部;内部变更经 onChange 回流。
 *
 * 防环:外部 set 前记录 lastExternalRef,内部订阅收到「与刚写入相同引用」时视作回声跳过。
 * 拖拽/缩放手势中只写 DOM 不写 atom(见 MoveableLayer),故 onChange 仅在手势结束 /
 * 离散操作(增删/对齐/撤销/单位切换/属性面板编辑)时触发,不影响手势性能。
 *
 * 注:value 为受控源,内容未变时应保持引用稳定(标准 React 受控约定),
 * 否则每次新引用都会触发 setElementsAtom 并清空撤销栈。
 */
export function useEditorSync({ value, initialElements, onChange }) {
  const setElements = useSetAtom(setElementsAtom);
  const store = useStore();

  // 持有最新 onChange,避免其身份变化导致反复重订阅
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // 最近一次由外部写入的引用,用于识别回声
  const lastExternalRef = useRef(undefined);

  // 挂载种子(仅非受控,且仅一次)
  useEffect(() => {
    if (value !== undefined) return; // 受控:由 value 接管初始化
    if (initialElements && initialElements.length) {
      setElements(initialElements);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 -> 内部(受控):value 变化时整体替换
  useEffect(() => {
    if (value === undefined) return;
    if (value === store.get(elementsAtom)) return; // 引用相同,无需替换
    lastExternalRef.current = value;
    setElements(value);
  }, [value, store, setElements]);

  // 内部 -> 外部:订阅 atom 变化,跳过外部回声
  useEffect(() => {
    const unsub = store.sub(elementsAtom, () => {
      const current = store.get(elementsAtom);
      if (current === lastExternalRef.current) return;
      onChangeRef.current?.(current);
    });
    return unsub;
  }, [store]);
}
