import { useEffect, useRef } from "react";
import { useSetAtom, useStore } from "jotai";
import { elementsAtom, setElementsAtom, templatesAtom, DEFAULT_TEMPLATE_ID } from "@/atoms";

/** 为历史/受控元素回填 templateId(缺省归到默认模板),保证多模板模型一致 */
const backfillTemplateId = (elements) =>
  Array.isArray(elements)
    ? elements.map((el) => (el.templateId ? el : { ...el, templateId: DEFAULT_TEMPLATE_ID }))
    : elements;

/**
 * 受控同步:把外部 props 与内部 elementsAtom/templatesAtom 双向绑定。
 *
 * - value === undefined(非受控):Editor 自管状态;可选 initialElements 作挂载种子;
 *   onChange 仅作外部观察回调。
 * - value 提供(受控):外部变更覆盖内部;内部变更经 onChange 回流。
 * - initialTemplates(可选):挂载时种子模板列表;onTemplatesChange(可选):模板变化回流。
 *
 * 防环:外部 set 前记录 lastExternalRef,内部订阅收到「与刚写入相同引用」时视作回声跳过。
 * 拖拽/缩放手势中只写 DOM 不写 atom(见 MoveableLayer),故 onChange 仅在手势结束 /
 * 离散操作(增删/对齐/撤销/单位切换/属性面板编辑)时触发,不影响手势性能。
 */
export function useEditorSync({ value, initialElements, onChange, initialTemplates, onTemplatesChange }) {
  const setElements = useSetAtom(setElementsAtom);
  const setTemplates = useSetAtom(templatesAtom);
  const store = useStore();

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTemplatesChangeRef = useRef(onTemplatesChange);
  onTemplatesChangeRef.current = onTemplatesChange;
  const lastExternalRef = useRef(undefined);
  const lastExternalTemplatesRef = useRef(undefined);
  const templatesSeededRef = useRef(false);

  // 挂载种子(仅非受控,且仅一次)
  useEffect(() => {
    if (value !== undefined) return; // 受控:由 value 接管初始化
    if (initialElements && initialElements.length) {
      setElements(backfillTemplateId(initialElements));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 模板种子(可选,仅一次)
  useEffect(() => {
    if (templatesSeededRef.current) return;
    if (initialTemplates && initialTemplates.length) {
      templatesSeededRef.current = true;
      lastExternalTemplatesRef.current = initialTemplates;
      setTemplates(initialTemplates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 -> 内部(受控元素):value 变化时整体替换
  useEffect(() => {
    if (value === undefined) return;
    if (value === store.get(elementsAtom)) return; // 引用相同,无需替换
    lastExternalRef.current = value;
    setElements(backfillTemplateId(value));
  }, [value, store, setElements]);

  // 内部 -> 外部:元素
  useEffect(() => {
    const unsub = store.sub(elementsAtom, () => {
      const current = store.get(elementsAtom);
      if (current === lastExternalRef.current) return;
      onChangeRef.current?.(current);
    });
    return unsub;
  }, [store]);

  // 内部 -> 外部:模板(可选)
  useEffect(() => {
    const unsub = store.sub(templatesAtom, () => {
      const current = store.get(templatesAtom);
      if (current === lastExternalTemplatesRef.current) return;
      onTemplatesChangeRef.current?.(current);
    });
    return unsub;
  }, [store]);
}
