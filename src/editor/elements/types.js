/**
 * 元素类型字符串常量(集中定义,供注册表与各消费者引用)。
 * 独立成模块以避免 elements/index 与各元素定义间的循环依赖。
 */
export const ELEMENT_TYPES = {
  TEXT: "text",
  RECT: "rect",
  CIRCLE: "circle",
  IMAGE: "image",
  BUTTON: "button",
  CONTAINER: "container",
};
