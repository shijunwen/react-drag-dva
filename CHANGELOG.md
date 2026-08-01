# Changelog

本文件记录 react-drag-dva 的版本演进。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
