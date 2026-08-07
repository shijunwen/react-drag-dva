/**
 * 元素类型字符串常量。
 * 独立模块，供注册表与各消费者引用，避免循环依赖。
 */
export const ELEMENT_TYPES = {
  TEXT: "text",
  RECT: "rect",
  CIRCLE: "circle",
  IMAGE: "image",
  BUTTON: "button",
  CONTAINER: "container",
};
