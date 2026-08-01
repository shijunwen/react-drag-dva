# react-drag-dva

可视化拖拽编辑器组件库:从面板拖入组件到画布,支持移动 / 缩放 / 旋转 / 分组 / 容器嵌套 / 撤销重做,可作为受控组件嵌入任意 React 应用。

React 18 + Vite,Ant Design 6,Jotai 状态,`@dnd-kit` 拖拽,`react-moveable` 操控。

## 特性

- 🎨 面板拖入 -> 画布自由布局,`react-moveable` 手柄移动/缩放
- 📦 容器嵌套:容器可容纳子元素,递归嵌套
- 🔗 分组:多选元素合并成块,点选任一成员即选中整组
- ↩️ 撤销 / 重做(历史栈,上限 50)
- 📐 单位切换:元素 x/宽 支持 `px` 与 `%`,切换自动换算,适配响应式
- 🧩 元素注册表:类型元数据 + 渲染 + 属性面板集中管理,新增类型仅需一个文件
- 🎛️ 受控模式:`value` / `onChange` / `initialElements`,可外部读写编辑器状态

## 安装

```bash
npm install react-drag-dva
# 或 pnpm add react-drag-dva
```

本库以 **peerDependencies** 声明运行时依赖,需在宿主项目自行安装:

```bash
npm install react react-dom antd @ant-design/icons jotai @dnd-kit/core @dnd-kit/utilities react-moveable react-infinite-viewer ahooks
```

## 快速开始

```jsx
import { Editor } from "react-drag-dva";
import "react-drag-dva/style.css"; // 设计 token + 组件样式
import { ConfigProvider } from "antd";

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#0d9488" } }}>
      <Editor />
    </ConfigProvider>
  );
}
```

> Editor 内部使用 antd 组件,宿主需用 antd 的 `ConfigProvider` 提供主题 / locale。

### 受控模式(外部读写状态)

```jsx
import { useState } from "react";
import { Editor } from "react-drag-dva";
import "react-drag-dva/style.css";

export default function App() {
  const [elements, setElements] = useState([]);
  return <Editor value={elements} onChange={setElements} />;
}
```

### 非受控模式(带初始数据 + 观察回调)

```jsx
<Editor initialElements={seedElements} onChange={(els) => console.log(els)} />
```

## Editor API

| Prop | 类型 | 说明 |
|------|------|------|
| `value` | `Element[]` | 受控元素列表。提供即进入受控模式,外部变更覆盖内部 |
| `onChange` | `(elements: Element[]) => void` | 元素发生**已提交**变更时回调(手势结束 / 增删 / 对齐 / 撤销 / 单位切换 / 属性编辑) |
| `initialElements` | `Element[]` | 非受控模式的挂载种子(仅一次,受控模式下忽略) |
| `children` | `ReactNode` | 顶部自定义 chrome(如工具栏),在 Editor 的 Jotai store 内渲染,可用 `useEditor()`/atoms 与本实例联动 |

**实例隔离**:每个 `<Editor />` 内部自带独立 Jotai store,多个实例互不串扰。自定义工具栏等 chrome 通过 `children` 传入(在 store 内渲染),即可用 `useEditor()` 操控所属实例。

**性能说明**:拖拽 / 缩放手势过程中只直接写 DOM、不触发 `onChange`,仅在手势结束等离散时机回调,因此受控模式不会影响操控流畅度。

**受控约定**:`value` 内容未变时应保持引用稳定(标准 React 受控约定),否则每次新引用都会触发整体替换并清空撤销栈。

**容错**:每个元素的渲染(Content)与属性面板(Props)都包裹了错误边界,单个自定义元素抛错只会显示占位,不会导致整个编辑器白屏。

## 元素数据结构

```js
{
  id: string,            // 唯一 id
  type: string,          // "text" | "rect" | "circle" | "image" | "button" | "container"
  x: number,             // 横向位置,单位由 unit 决定
  y: number,             // 纵向位置,始终 px
  width: number,         // 宽,单位由 unit 决定
  height: number,        // 高,始终 px
  unit: "px" | "%",      // 仅影响 x / width
  rotation: number,      // 旋转角度
  groupId: string | null,   // 分组标识,null 表示未分组
  parentId: string | null,  // null=画布顶层; containerId=容器内子元素
  z: number,             // 同级层叠顺序
  props: object,         // 类型专属属性(text/fill/src/label 等)
}
```

可用 `createElement(type, x, y)` 工具快速创建一个带默认值的新元素。

## 命名导出

```js
import { Editor, Preview, useEditor } from "react-drag-dva";
```

| 分类 | 导出 |
|------|------|
| 组件 | `Editor`、`Preview`(纯渲染预览态) |
| Hook | `useEditor()`(读取状态 + 调用动作) |
| 状态 atoms | `elementsAtom`、`selectedIdsAtom`、`selectedElementsAtom`、`viewportAtom`、`zoomAtom`、`canvasWidthAtom`、`canvasHeightAtom`、`previewModeAtom`、`setElementsAtom`、`addElementAtom`、`updateElementAtom`、`updateElementsAtom`、`setElementUnitAtom`、`deleteSelectedAtom`、`selectAtom`、`toggleSelectAtom`、`clearSelectionAtom`、`groupSelectedAtom`、`ungroupSelectedAtom`、`alignSelectedAtom`、`reorderZAtom`、`reorderContainerAtom`、`moveElementToContainerAtom`、`undoAtom`、`redoAtom`、`clearCanvasAtom`、`beginChangeAtom`、`setViewportAtom`、`setZoomAtom`、`setCanvasSizeAtom`、`setPreviewModeAtom` |
| 注册表 | `ELEMENT_DEFS`、`getDef(type)`、`ELEMENT_TYPES`、`PALETTE_ITEMS`、`PALETTE_ITEM_MAP`、`ELEMENT_ICONS` |
| 工具 | `createElement`、`getBounds`、`expandGroupSelection`、`toPercent`、`pxToUnit`、`toCss` |
| 常量 | `UNIT`、`CANVAS_WIDTH`、`CANVAS_HEIGHT` |

## 编程式操作

`useEditor()` 提供读取状态与调用动作的统一入口(内部以 `useSetAtom` 绑定,回调中读取最新状态,避免闭包陈旧):

```jsx
import { useEditor } from "react-drag-dva";

function Toolbar() {
  const { selectedElements, deleteSelected, undo, redo, canUndo, canRedo, alignSelected } = useEditor();
  return (
    <div>
      <button onClick={() => alignSelected("left")} disabled={selectedElements.length < 2}>左对齐</button>
      <button onClick={undo} disabled={!canUndo}>撤销</button>
      <button onClick={redo} disabled={!canRedo}>重做</button>
      <button onClick={deleteSelected} disabled={!selectedElements.length}>删除</button>
    </div>
  );
}
```

上面的 `Toolbar` 通过 `children` 传入 Editor,即在其 Jotai store 内渲染:

```jsx
<Editor>
  <Toolbar />
</Editor>
```

也可直接用 atoms(同样需在 `Editor` 渲染树内——即作为 `children` 传入,共享同一 Jotai store):

```jsx
import { useSetAtom, useAtomValue } from "jotai";
import { elementsAtom, addElementAtom, ELEMENT_TYPES } from "react-drag-dva";

function Inspector() {
  const elements = useAtomValue(elementsAtom);
  const addElement = useSetAtom(addElementAtom);
  return <button onClick={() => addElement({ type: ELEMENT_TYPES.RECT, x: 100, y: 100 })}>加矩形</button>;
}
```

> `addElement` 的 `x`/`y` 仅顶层元素使用(以落点为中心);容器内子元素由流式布局定位,可省略。

## 样式

- 视觉身份为「制图工坊(drafting instrument)」:冷纸色工作区 + 白色面板 + 单一 teal 信号色 + 工程制图网格(主/次刻度线)+ IBM Plex 等宽坐标。引入 `react-drag-dva/style.css` 即可获得设计 token(`:root` 上的 `--color-*` 变量)与全部组件样式。
- token 定义见 `src/editor/tokens.less`,如需自定义可覆盖对应 CSS 变量(主色 `--color-primary`、字体 `--font-display`/`--font-mono` 等)。
- **推荐对齐 antd 主色**(Editor 内部使用 antd 组件),完整观感建议加载 IBM Plex 字体:
  ```jsx
  import { ConfigProvider } from "antd";
  import "react-drag-dva/style.css";

  <ConfigProvider theme={{ token: { colorPrimary: "#0d9488" } }}>
    <Editor />
  </ConfigProvider>
  ```
  字体可自行引入 IBM Plex Sans/Mono,或覆盖 `--font-*` token 回退系统字体。

## 本地开发

仓库结构:库源码在 `src/`,demo 在 `examples/`(经 `@` 别名引用 `src/`)。

```bash
pnpm install
pnpm dev          # 启动 demo(http://localhost:5173,入口 examples/index.html)
pnpm build        # 构建 demo -> dist-demo/
pnpm build:lib    # 构建库 -> dist/(index.js / index.cjs / index.d.ts / style.css)
pnpm lint         # ESLint(--max-warnings 0)
```

## TypeScript

本库附带类型声明(`dist/index.d.ts`),`package.json` 已配置 `types` 与 `exports.types`。TypeScript 用户安装后可直接获得 `Editor`、`EditorElement`、`useEditor()`、各 atom 与工具函数的类型提示,无需额外 `@types` 包。

```ts
import { Editor, type EditorElement } from "react-drag-dva";
const seed: EditorElement[] = [];
```

### 新增元素类型

在 `src/editor/elements/` 新建一个定义文件并在 `index.js` 的 `DEFS` 数组登记即可,无需改动各消费组件:

```jsx
// src/editor/elements/Video.jsx
import { VideoCameraOutlined } from "@ant-design/icons";
import { ELEMENT_TYPES } from "./types";

function VideoContent({ el, styles }) {
  return <video className={styles.video} src={el.props.src} controls />;
}

export default {
  type: "video",
  label: "视频",
  icon: VideoCameraOutlined,
  defaults: { width: 320, height: 180, props: { src: "" } },
  Content: VideoContent,
  Props: null, // 可选:属性面板编辑器
};
```

`Content` / `Props` 为模块级组件,由调用方注入 `styles`(editor / preview 各自的 CSS module),因此编辑态与预览态共用同一渲染器。

## License

MIT
