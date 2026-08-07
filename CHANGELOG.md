# Changelog

本文件记录 react-drag-dva 的版本演进。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

- **框选(MarqueeSelect)**:长按空白画布拖拽拉出矩形选框,Shift 叠加选区,点击空白清空;与 moveable 手柄 / 空间平移手势互斥,多画板实例隔离
- **吸附距离显示**:拖拽 / 缩放时实时渲染与邻近元素的对齐辅助线及距离值
- **组件树全代理**:`ComponentTree` 内联编辑(单击重命名 / blur 提交)、展开折叠全部、拖拽移入容器 / 移出到画布;右键菜单预留
- **自定义左右面板 slot**:`Editor` 新增 `leftPanel` / `rightPanel` 插槽,可替换或扩展默认组件树 / 属性面板;内置 `DefaultLeftPanel` / `DefaultRightPanel` 组件供组合使用
- **命令式 getData API**:`useEditor()` 新增 `getData()` 方法,返回 `{ templates, elements }` 当前编辑器全量数据,不触发 React 重渲染
- **DraggableElement 组件库扩展**:新增 `DraggableElement` 公共导出,支持业务侧自定义可拖入组件类型与实时预览
- **Schema 驱动属性面板**:元素定义新增 `propsSchema`(字段类型、默认值、校验),`SchemaProps` 组件根据 schema 自动生成 antd 表单控件,代替手写 `PropsPanel`
- **元素编辑能力增强**:剪贴板(复制粘贴/剪切)、方向键微调(单步 1px / Shift 10px)、旋转手柄 + 角度吸附、网格吸附(移动 / 缩放)、锁定 / 隐藏元素、多画板(Template)实例隔离
- **缩放边界约束**:移动 / 缩放限定画布边界与最小宽高(`MOVEABLE_MIN_SIZE`),防止拖出画布或缩至负尺寸
- **Moveable 控制柄美化**:自定义 CSS 覆盖 `react-moveable` 默认控制柄样式(颜色 / 尺寸 / 圆角 / 阴影),匹配编辑器视觉系统

### 修复

- 画布拖拽开关未完全 / 彻底阻止平移的问题(多次修复覆盖三种触发路径)
- `selectedIds` 初始化顺序导致的闪烁与误选
- resize 抖动:拖拽热路径去每帧内存分配,移动停止时精确归位

### 重构

- **编辑器业务逻辑与组件展示分层分离**:Canvas 拆分为 `Board` / `CursorPos` / `RulerGuides` / `ZoomBar` / `BoardResizer` 子组件;Moveable 手势拆入 `useMoveableGestures` / `useSelectionCapture` / `useCanvasViewport` / `useGuidesSync` hook;画布缩放 / 平移逻辑进 `useCanvasViewport`;Editor 壳 hook 拆为 `useEditorShortcuts` / `usePaletteDnd`
- **尺寸标签重构**:`SizeLabel` 从 CanvasElement 移到 MoveableLayer,跟随 moveable 手柄渲染,避免 React 重渲染

### 工程

- 依赖新增 `react-selecto`(框选)与 `@moveable/helper`(辅助线)
- `CLAUDE.md` 架构文档同步更新,补充框选 / 容器 / 渲染路径 / 目录约定等新章节

---

## [0.1.0] - 2026-08-01

首个公开版本。

### 特性

- **可视化拖拽编辑器**:从顶部面板拖入组件到画布,`react-moveable` 手柄移动 / 缩放
- **容器嵌套**:容器可容纳子元素,递归嵌套
- **分组**:多选元素合并成块,点选任一成员即选中整组
- **撤销 / 重做**:历史栈(上限 50)
- **单位切换**:元素 x / 宽支持 `px` 与 `%`,切换自动换算,适配响应式
- **元素注册表**:类型元数据 + 渲染 + 属性面板集中管理,新增类型仅需一个文件
- **受控模式**:`value` / `onChange` / `initialElements`,可外部读写编辑器状态
- **顶部拖入画布高亮**:拖拽组件至画布时实时高亮放置区

### 打包 / 发布

- ESM + CJS 双格式 + 合并 `style.css`,运行时依赖以 `peerDependencies` 声明
- 附带 TypeScript 类型声明(`dist/index.d.ts`),覆盖全部公开 API
- `package.json` 完整元数据(`exports.types` / `license` / `repository` / `engines` / `publishConfig` 等)
- demo 与库源码分离(`examples/` vs `src/`)
- MIT 协议

### 性能优化

- `viewport` 派生聚焦 atom(`zoomAtom` / `canvasWidthAtom` / `canvasHeightAtom`),`Editor` / `MoveableLayer` 不再随平移滚动重渲染
- Canvas 标尺滚动解耦(`store.sub` 驱动,Canvas 不订阅 scroll),鼠标坐标抽取为独立叶子组件
- `MoveableLayer` `memo` 化 + `elementsById` O(1) 查找(替每帧 O(n) `find`)+ 拖拽热路径去每帧分配
- atoms:环检测 / 级联删除 O(n) 化,`dropElement` / `alignSelected` 优化
- `useEditor` 的 `canUndo` / `canRedo` 派生布尔,避免每次 `beginChange` 重渲染所有消费者
- `ComponentTree` 展开键按容器 id 签名去冗余重渲染
- 全量 `.sort()` -> `toSorted()`,静态对象 / 回调提升与稳定化
