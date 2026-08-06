import { BlockOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";

/**
 * 容器元素定义。
 * 渲染不经过注册表 Content:容器结构(嵌套子元素 / dnd 排序 / 递归)与基础类型差异大,
 * 由 CanvasElement(ContainerBox)与 Preview(PreviewContainer)各自特判渲染。
 * 故 Content/Props 留空。
 */
export default {
  type: ELEMENT_TYPES.CONTAINER,
  label: "容器",
  icon: BlockOutlined,
  defaults: { width: 200, height: 200, props: {} },
  Content: null,
  Props: null,
};
