# 深度重构 Spec：消除耦合 · 拆 barrel · 清重复

**日期**: 2026-08-07  
**范围**: `src/` 全量 — 目录结构、依赖方向、文件职责、重复代码  
**目标**: 目录清晰、耦合低、易维护，遵循 `react-best-practices` 规则

---

## 1. 新目录结构

单向依赖：`core → atoms → editor`。core 零 UI 依赖、零 Jotai 依赖。

```
src/
├── core/                         # 纯数据/模型层
│   ├── constants.js              # ↑ 从 editor/ 提升
│   ├── ElementTypes.js           # ↑ 从 editor/elements/types.js 提升
│   ├── utils/
│   │   ├── id.js                 # genId
│   │   ├── unit.js               # toPercent, pxToUnit, toCss
│   │   ├── geometry.js           # getBounds, rectOverlapArea, findSmallestHit
│   │   ├── model.js              # patchElement, createElement, cloneProps, buildGroupedIds
│   │   ├── tree.js               # buildChildrenMap, wouldCreateCycle, reorderChildren, getChildren
│   │   └── index.js
│   └── index.js
│
├── atoms/                        # Jotai 状态层 — 只依赖 core/ + jotai
│   ├── elements/
│   │   ├── crud.js               # add/update/set/delete/clear (~90行)
│   │   ├── clipboard.js          # copy/paste/duplicate/clone (~80行)
│   │   ├── reorder.js            # reorderZ/reorderContainer/move/drop (~130行)
│   │   ├── group.js              # group/ungroup (~30行)
│   │   ├── align.js              # alignSelected (~30行)
│   │   ├── nudge.js              # nudgeSelected (~30行)
│   │   └── properties.js         # toggleLock/rename/setUnit (~40行)
│   ├── base.js
│   ├── history.js
│   ├── preview.js
│   ├── selection.js
│   ├── templates.js
│   ├── viewport.js
│   └── index.js                  # src/index.js 使用的外部 API barrel
│
├── editor/                       # UI 层 — 依赖 core/ + atoms/
│   ├── Canvas/
│   │   ├── Canvas.jsx
│   │   ├── Canvas.module.less
│   │   ├── CanvasElement.jsx
│   │   ├── ContainerBox.jsx
│   │   ├── ContainerBox.module.less
│   │   ├── MoveableLayer.jsx
│   │   ├── BoardResizer.jsx
│   │   ├── canvasConstants.js
│   │   ├── dropLogic.js
│   │   ├── moveableHelpers.js
│   │   ├── components/
│   │   │   ├── Board.jsx
│   │   │   ├── CursorPos.jsx
│   │   │   ├── MarqueeSelect.jsx
│   │   │   ├── RulerGuides.jsx
│   │   │   └── ZoomBar.jsx
│   │   └── hooks/
│   │       ├── useMoveableGestures.js  # 组装层 (~200行)
│   │       ├── useMoveableSnap.js      # 吸附计算 (~170行)
│   │       ├── useMoveableTargets.js   # targets 派生 (~90行)
│   │       ├── useMoveableCommit.js    # 手势生命周期 (~60行)
│   │       ├── useMoveableSizeLabel.js # 尺寸标签 (~80行)
│   │       ├── useCanvasViewport.js
│   │       ├── useDndBoardHitTest.js
│   │       ├── useGuidesSync.js
│   │       └── useSelectionCapture.js
│   ├── ComponentTree/
│   ├── Palette/
│   ├── PropertiesPanel/
│   ├── elements/
│   ├── shared/
│   │   ├── ElementRenderer.jsx   # 统一元素渲染
│   │   └── pointerGuards.js      # 统一指针仲裁
│   ├── Editor.jsx
│   ├── useEditor.js              # 组合入口
│   ├── useEditorState.js         # 只读状态
│   ├── useElementActions.js      # 元素 CRUD actions
│   ├── useSelectionActions.js    # 选区 actions
│   ├── useTemplateActions.js     # 模板 actions
│   ├── useHistoryActions.js      # 撤销/重做
│   ├── useEditorShortcuts.js
│   ├── useEditorSync.js
│   ├── usePaletteDnd.js
│   └── ...
│
└── styles/
```

---

## 2. core/utils 拆分

`editor/utils.js`(315行) → `core/utils/*`(6文件)，每文件单一职责。

| 文件 | 内容 | 消除重复 |
|------|------|----------|
| `id.js` | `genId` | — |
| `unit.js` | `toPercent, pxToUnit, toCss` | CanvasElement + moveableHelpers 内联转换 |
| `geometry.js` | `getBounds, rectOverlapArea, findSmallestHit` | pickInnermostDroppable(Editor) → findSmallestHit |
| `model.js` | `patchElement, createElement, cloneProps, cloneElements, buildGroupedIds` | expandGroupSelection 合并入 buildGroupedIds |
| `tree.js` | `buildChildrenMap, wouldCreateCycle, reorderChildren, getChildren` | 6 处容器子元素过滤 → getChildren |
| `index.js` | barrel re-export | — |

DOM 相关函数(`isEditable`)不进 core，放在 `editor/shared/`。

---

## 3. atoms/elements 拆分

`atoms/elements.js`(442行) → 7 文件，每文件 ≤130行。

| 文件 | atom 列表 | 依赖 |
|------|----------|------|
| `crud.js` | addElement, updateElement, updateElements, setElements, deleteElements, deleteSelected, clearCanvas | model |
| `clipboard.js` | clipboard, copySelected, paste, duplicateSelected | crud, model |
| `reorder.js` | reorderZ, reorderContainer, moveToContainer, drop | tree, geometry |
| `group.js` | groupSelected, ungroupSelected | model |
| `align.js` | alignSelected | geometry |
| `nudge.js` | nudgeSelected | constants |
| `properties.js` | toggleLock, rename, setUnit | unit |

互依赖规则：`crud ← clipboard, crud ← reorder`。无循环。

---

## 4. useMoveableGestures 拆分

`useMoveableGestures.js`(669行) → 5 hook + 1 组装：

| Hook | 行数 | 职责 |
|------|------|------|
| `useMoveableSnap` | ~170 | elementGuidelines + rulerGuides 计算 |
| `useMoveableTargets` | ~90 | 选中 → targets 派生 + 无效清理 |
| `useMoveableCommit` | ~60 | pin/unpin + lazyBegin + commitSingle/Group |
| `useMoveableSizeLabel` | ~80 | label 的 create/update/hide 生命周期 |
| `useMoveableGestures` | ~200 | 组装以上 + 生成 moveableProps |

手势回调标准化为统一的 `pin → beginLazy → compute → applyToDom → label → commit → unpin` 流程，消除单/组版本的重复模板。

---

## 5. useEditor 拆分

`useEditor.js` → 5 子 hook + 1 组合入口：

| Hook | 导出 | 消费者示例 |
|------|------|------------|
| `useEditorState` | elements, selectedIds, selectedElements, canUndo, canRedo, templates, activeTemplateId, templateColumns | AppHeader, CustomLeftPanel |
| `useElementActions` | add/update/delete/lock/rename/copy/paste/duplicate/group/align/nudge/clear/reorderZ | useEditorShortcuts |
| `useSelectionActions` | select, toggleSelect, clearSelection | ComponentTree |
| `useTemplateActions` | add/duplicate/delete/rename/setSize/setActive/setColumns template | 模板面板 |
| `useHistoryActions` | undo, redo, beginChange | 手势 / 快捷键 |
| `useEditor` | 以上全部（向后兼容） | Editor.jsx 内部控制 |

---

## 6. 消除重复

### 6.1 容器子元素过滤（6 处 → 1）
`tree.js` 新增 `getChildren(parentId, elements)`，所有调用点统一使用。

### 6.2 元素渲染分发（2 处 → 1）
新增 `editor/shared/ElementRenderer.jsx`，CanvasElement 和 Preview 改用之。

### 6.3 指针仲裁（3 处 → 1）
`editor/shared/pointerGuards.js` 导出 `POINTER_TARGET_SELECTOR` + `isInteractiveTarget`。

### 6.4 拖放落点（2 处 → 1）
删除 `Editor.jsx` 的 `pickInnermostDroppable`，统一用 `findSmallestHit`。

### 6.5 顶层元素分组
`templates.js` 新增派生 atom `topLevelElementsAtom`，消除 Canvas/Preview 重复。

### 6.6 px/% 内联转换（3 处 → 1）
CanvasElement + moveableHelpers 改调 `core/utils/unit.js`。

### 6.7 其他小项
- `max z + 1` → `crud.js` 导出 `getNextZ(elements, parentId)`
- `TEMPLATE_NODE_PREFIX` → `core/constants.js`
- droppable id 前缀 → `containerDroppableId(id)` / `templateDroppableId(id)` 工厂函数
- `expandGroupSelection` / `buildGroupedIds` → 合并为后者

### 6.8 容器注册表统一
`Container.js` 的 `Content` 从 `null` 改为指向 `<ContainerBox>`，`ElementRenderer` 统一走 `def.Content`，消除 `if (el.type === CONTAINER)` 硬编码 bypass。

---

## 7. 导入规范

- **禁止** barrel import from `@/atoms`（`src/index.js` 自身除外）
- **必须** 从源文件直接导入：`import { elementsAtom } from "@/atoms/base"`
- **例外** `core/utils/index.js` barrel 允许（内容稳定、6 文件、导入路径短）

---

## 8. 实施顺序（6 阶段）

| 阶段 | 内容 | 可独立验证 |
|------|------|------------|
| 1 | 创建 `core/`，迁移 constants + utils + ElementTypes | `pnpm build` |
| 2 | 拆分 `atoms/elements/`，更新引用 | `pnpm build` |
| 3 | 拆分 `useMoveableGestures` | `pnpm build` |
| 4 | 拆分 `useEditor`，新增 shared | `pnpm build` |
| 5 | 消除 6.1-6.8 重复，统一容器渲染 | `pnpm build` |
| 6 | 面导入修正：barrel → 源文件 | `pnpm lint && pnpm build` |

每阶段 `pnpm build && pnpm lint` 必须 0 error。阶段间可提交 checkpoint。
