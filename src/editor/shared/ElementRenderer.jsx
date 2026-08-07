import { ELEMENT_TYPES, getDef } from "../elements";
import ElementErrorBoundary from "../ElementErrorBoundary";

/**
 * 统一元素内容渲染：容器/基础类型走同一注册表逻辑。
 * @param {Object} el - 元素数据
 * @param {Object} styles - CSS Module (Canvas/Preview 注入各自的)
 * @param {Function} onContainerRender - 当 el.type === CONTAINER 时的自定义渲染器
 * @param {Object} extra - 透传给容器渲染器的额外 props
 */
export function renderElementContent(el, styles, onContainerRender, extra) {
  if (el.type === ELEMENT_TYPES.CONTAINER && onContainerRender) {
    return (
      <ElementErrorBoundary resetKey={el.id}>
        {onContainerRender(el, extra)}
      </ElementErrorBoundary>
    );
  }
  const Content = getDef(el.type)?.Content;
  if (!Content) return null;
  return (
    <ElementErrorBoundary resetKey={el.id}>
      <Content el={el} styles={styles} />
    </ElementErrorBoundary>
  );
}
