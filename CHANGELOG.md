# Changelog

本文件记录 react-drag-dva 的版本演进。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-08-07

### 🎯 新增特性

- **框选 (MarqueeSelect)**: 长按空白画布拖拽拉出矩形选框，Shift 叠加选区，点击空白清空；与 moveable 手柄 / 空间平移手势互斥，多画板实例隔离
- **吸附距离显示**: 拖拽 / 缩放时实时渲染与邻近元素的对齐辅助线及距离值
- **组件树全代理**: `ComponentTree` 内联编辑（单击重命名 / blur 提交）、展开折叠全部、拖拽移入容器 / 移出到画布
- **自定义左右面板 slot**: `Editor` 新增 `leftPanel` / `rightPanel` 插槽，可替换或扩展默认组件树 / 属性面板
- **命令式 getData API**: `Editor` ref 暴露 `getData()` 方法，返回 `{ templates, elements }` 当前编辑器全量数据快照，不触发 React 重渲染
- **DraggableElement 组件库扩展**: 新增 `DraggableElement` 导出，支持业务侧自定义可拖入组件类型、inspector 配置与实时预览
- **Schema 驱动属性面板 (Inspector)**: 元素定义新增 `inspector` 字段（字段类型 / 默认值 / 自定义 render），`SchemaProps` 自动生成 antd 表单控件
- **元素编辑能力增强**: 剪贴板（复制 / 粘贴 Ctrl+C/V）、方向键微调（单步 1px / Shift 10px）、旋转手柄 + 角度吸附、网格吸附、锁定 / 隐藏元素、多画板 (Template) 实例隔离
- **缩放边界约束**: 移动 / 缩放限定画布边界与最小宽高，防止拖出画布或缩至负尺寸
- **Moveable 控制柄美化**: 自定义 CSS 覆盖 `react-moveable` 默认控制柄样式（颜色 / 尺寸 / 圆角 / 阴影），匹配编辑器视觉系统
- **Demo 完善**: 新增默认开箱即用 Demo + 全定制 Demo，右上角 Segmented 热切换

### 📦 架构重构

- **依赖方向修正**: 新增 `core/` 纯数据层（constants / utils / ElementTypes），依赖方向从 `atoms → editor` 倒置修正为 `core → atoms → editor` 单向依赖
- **atoms 拆分**: `atoms/elements.js`（442 行）按职责拆为 7 个子模块（crud / clipboard / reorder / group / align / nudge / properties），每文件 ≤ 130 行
- **useMoveableGestures 拆分**: 669 行拆为 5 个独立 hook（snap / targets / commit / sizeLabel + 组装层），手势回调标准化为统一生命周期
- **useEditor 拆分**: God Hook 拆为 `useEditorState` / `useElementActions` / `useSelectionActions` / `useTemplateActions` / `useHistoryActions` 五个子 hook，消费者按需订阅
- **消除重复代码**: 元素渲染分发统一到 `editor/shared/ElementRenderer`；容器子元素过滤 6 处重复统一到 `core/utils/tree.getChildren`；px/% 转换 3 处内联统一到 `core/utils/unit`
- **Barrel import 清零**: 18 个文件从 `@/atoms` barrel 导入全部替换为直接源文件导入，压缩 bundle 体积

### 🪲 修复

- 画布拖拽开关未完全 / 彻底阻止平移的问题（多次修复覆盖三种触发路径）
- `selectedIds` 初始化顺序导致的闪烁与误选
- resize 抖动：拖拽热路径去每帧内存分配，移动停止时精确归位

### 📐 工程

- 依赖新增 `react-selecto`（框选）、`@moveable/helper`（辅助线）
- 演示区由单文件重构为 DefaultDemo / CustomDemo 双入口
- `CLAUDE.md` 同步更新目录约定、框选、渲染路径等新章节

---

## [0.1.0] - 2026-08-01

首个公开版本。`react-drag-dva` 是一个基于 React 18 + Jotai + react-moveable 的可视化拖拽编辑器组件库。

### 安装

```bash
npm install react-drag-dva
# 或
pnpm add react-drag-dva
```

peerDependencies 需自行安装：`react` `react-dom` `antd` `@ant-design/icons` `@dnd-kit/core` `jotai` `react-moveable` `ahooks` 等（详见 `package.json`）。

### 基础用法

```jsx
import { Editor } from "react-drag-dva";
import "react-drag-dva/style.css";

function App() {
  return <Editor />;
}
```

### 🎯 核心特性

- **可视化拖拽编辑器**: 从顶部 Palette 面板拖入组件（Text / Rect / Circle / Image / Button / Container）到画布，`react-moveable` 手柄移动 / 缩放 / 旋转
- **容器嵌套**: Container 类型可容纳子元素，支持递归嵌套与 z 层叠排序
- **分组**: 多选元素合并成块（group），点选任一成员即选中整组
- **撤销 / 重做**: Jotai 历史栈（上限 50），支持 Ctrl+Z / Ctrl+Shift+Z
- **单位切换**: 元素 x / width 支持 `px` ↔ `%`，按模板画布尺寸自动换算，适配响应式布局
- **元素注册表**: 类型定义、渲染组件、属性面板元数据集中管理，新增类型仅需一个文件 + 一行注册
- **受控模式**: `value` / `onChange` / `initialElements` / `initialTemplates` / `onTemplatesChange`，外部可完整读写编辑器状态
- **多模板 (Template)** : 独立多画板，各自尺寸与元素集合，支持新增 / 复制 / 删除 / 重命名

### 📦 公共 API

| 导出 | 类型 | 说明 |
|------|------|------|
| `Editor` | React 组件 | 主编辑器组件，支持 ref 获取 `getData()` |
| `Preview` | React 组件 | 纯渲染预览态（读 atoms，无编辑能力） |
| `ComponentTree` | React 组件 | 默认左侧组件树面板 |
| `PropertiesPanel` | React 组件 | 默认右侧属性面板 |
| `useEditor` | Hook | 统一 action 入口（读状态 + 调 action） |
| `registerElement` | 函数 | 运行时注册自定义元素类型 |
| `createElement` / `getBounds` / `toPercent` / `pxToUnit` / `toCss` | 工具函数 | 元素创建、几何计算、单位转换 |
| `ELEMENT_DEFS` / `PALETTE_ITEMS` / `ELEMENT_TYPES` | 常量 | 元素注册表与类型枚举 |
| `elementsAtom` / `selectedIdsAtom` / `viewportAtom` 等 | Jotai Atom | 高级：外部直接读写编辑器状态 |

### 📦 打包 / 发布

- ESM + CJS 双格式入口（`dist/index.js` + `dist/index.cjs`），附带合并 `dist/style.css`
- TypeScript 类型声明（`dist/index.d.ts`），覆盖全部公开 API
- `package.json` 完整 npm 元数据：`exports.types` / `license: MIT` / `repository` / `engines: node >=18` / `publishConfig: public` / `sideEffects` / `keywords`
- 运行时依赖以 `peerDependencies` 声明（react / antd / jotai / react-moveable 等），不与消费方版本冲突
- `prepublishOnly` 钩子：自动 lint + `build:lib` 保证发布质量
- demo 与库源码物理分离（`examples/` vs `src/`），发布时仅包含 `dist/`

### ⚡ 性能优化

- `viewport` 派生聚焦 atom（`zoomAtom` / `canvasWidthAtom` / `canvasHeightAtom`），`Editor` / `MoveableLayer` 不再随平移滚动重渲染
- Canvas 标尺滚动解耦（`store.sub` 驱动），鼠标坐标抽取为独立叶子组件，减少重渲染面
- `MoveableLayer` `memo` 化 + `elementsById` O(1) 查找替代每帧 O(n) `find`；拖拽热路径去每帧内存分配
- atoms：环检测 / 级联删除 O(n) 化，`dropElement` / `alignSelected` 批量优化
- `useEditor` 的 `canUndo` / `canRedo` 派生布尔值，避免每次 `beginChange` 重渲染所有消费者
- `ComponentTree` 展开键按容器 id 签名去冗余重渲染
- 全量 `.sort()` → `toSorted()` 不可变排序；静态对象 / 回调提升到组件外稳定性

### 🎨 设计系统

- 代号「精密制图工坊」(Precision Drafting Atelier)
- 冷调灰蓝工作区 + 纯白面板 + 发丝线分割
- 唯一信号色 teal/blue 仅用于选中 / 聚焦
- IBM Plex 家族字体，数字等宽 tabular-nums
- CSS 自定义属性 token 体系（`--color-*` / `--font-*` / `--radius-*` / `--shadow-*` / `--space-*` / `--transition-*`）
