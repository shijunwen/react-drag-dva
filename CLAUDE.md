# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A `CODEBUDDY.md` also exists with similar guidance, but its **Container** section is stale (it describes flow-sortable `items`/`direction`/`gap`). The current container model is free-positioned children — see below. Trust this file for the container architecture.

## Commands

- **Dev**: `pnpm dev` — Vite at `http://localhost:5173` (`host 0.0.0.0`, `strictPort` true, port is fixed). If 5173 is occupied, kill the stale process first.
- **Build**: `pnpm build` — production build; `vite.config.js` `manualChunks` splits `react`, `antd`, `react-moveable`, `@dnd-kit` into separate bundles.
- **Lint**: `pnpm lint` — ESLint on `src/**/*.{js,jsx}` with `--max-warnings 0` (a single warning fails CI). `pnpm lint:fix` to auto-fix.
- **No test runner is configured.** Verify changes via `pnpm lint && pnpm build` and manual browser testing at :5173.
- Package manager is **pnpm** (`pnpm-lock.yaml`). Do not commit `package-lock.json`.

## Architecture

A **visual drag-and-drop editor**: drag component types from a top palette onto a canvas, then move/resize/group them with `react-moveable` handles. React 18 + Vite, Ant Design 6, Jotai state, `@dnd-kit/core` for palette→canvas & container drops, `react-moveable` for in-canvas manipulation.

> React/frontend code follows the global `react-best-practices` skill (eliminate waterfalls, compress bundle, reduce re-renders). Project-specific constraints below.

### State (Jotai) — the single source of truth

All editor state lives in `src/atoms/editor.js` (re-exported via `src/atoms/index.js`). **All mutations go through write-atoms here — never mutate `elementsAtom` directly elsewhere.**

- `elementsAtom` — flat array of **all** elements (top-level + container children, distinguished by `parentId`).
- Element shape: `{ id, type, x, y, width, height, rotation, groupId, parentId, z, props }`.
  - `parentId: null` → canvas top-level; `parentId = <containerId>` → child positioned relative to that container.
  - `z` → stacking order among siblings (same `parentId`); rendering sorts by `z`.
  - `groupId` → flat grouping tag (not nesting); selecting a member auto-expands to all members via `expandGroupSelection`.
- `selectedIdsAtom`, derived `selectedElementsAtom`, `pastAtom`/`futureAtom` (undo/redo, capped 50).
- Action atoms: `addElementAtom` (takes `parentId`, assigns next sibling `z`), `updateElementAtom`/`updateElementsAtom` (live, no history), `deleteSelectedAtom` (**cascades** to descendant children of deleted containers), `groupSelectedAtom`/`ungroupSelectedAtom`, `alignSelectedAtom`, `reorderZAtom` (`front/back/forward/backward`), `undoAtom`/`redoAtom`, `clearCanvasAtom`, `beginChangeAtom` (pushes undo snapshot).

`src/editor/useEditor.js` is the **unified hook** components use to read state + invoke actions. It binds write-atoms via `useSetAtom`, whose `get` reads fresh state — this avoids stale closures in gesture callbacks. Prefer `useEditor()` over importing atoms directly in components.

### Editor layout (`src/editor/Editor.jsx`)

A top-level `DndContext` wraps three regions:
1. **Palette** (`Palette/`) — `useDraggable` buttons, `data: { type }`. On drag, a `pointermove` listener on `document` tracks the cursor; `DragOverlay` has `dropAnimation={null}` (the default 250ms drop animation causes a visible "bounce back" — keep it disabled). Source items use opacity only, **not** `transform` (transform on the source ghosts and snaps back).
2. **Canvas** (`Canvas/`) — `useDroppable({ id: "canvas-board" })` + rendering surface + `MoveableLayer`.
3. **PropertiesPanel** (`PropertiesPanel/`) — position/size/type props for single selection; group bounds + group/ungroup for multi; **z-order buttons** (置顶/上移/下移/置底) for single selection.

`Editor.jsx` uses a custom `pickInnermostDroppable` collision detector: among droppables containing the pointer, it picks the **smallest area** (innermost) — so dropping on a container hits the container, not the canvas board. `onDragEnd` branches on `over.id`: `container-<id>` → `addElement({ parentId })` (coords relative to container); `canvas-board` → top-level `addElement`.

### Canvas + moveable (performance-critical)

`Canvas.jsx` owns `elementRefs` (id→DOM node Map, shared down to containers) and `moveableRef`. It renders only **top-level** elements (`!parentId`, sorted by `z`); container children are rendered by their `ContainerBox`.

**Selection is handled in `onPointerDownCapture`** (capture phase, before moveable's gesto): for an unselected element it calls `flushSync(() => select([id]))` so moveable re-binds its gesto in the same event tick and the still-propagating pointerdown is naturally caught — enabling direct click-drag of unselected elements. Elements marked `data-no-drag` (container header buttons) are skipped. This capture-phase + flushSync approach is used **instead of** moveable's `dragStart()` API (programmatic `dragStart` leaves gesto unable to release → stuck drag).

`MoveableLayer.jsx` performance strategy: **during a drag/resize it writes directly to the DOM via `applyToDom()` (zero React re-renders) and only commits the final patch to atoms on gesture end** (`onDragEnd`/`onResizeEnd`). `beginChangeAtom` (undo snapshot) is called lazily on first actual movement, not on gesture start, to avoid empty undo entries. Single selection → `onDrag`/`onResize`; multi/group → `onDragGroup`/`onResizeGroup`. Snapping guidelines are computed from **siblings** (same `parentId`) so nested coordinate spaces stay correct. `targets` are read directly from `elementRefs` at render (pressed elements are always already registered).

`MoveableLayer` subscribes only to `elementsAtom`/`selectedIdsAtom` (not `pastAtom`/`futureAtom`) to avoid re-rendering on undo-stack changes.

### Containers (`ContainerBox.jsx`)

A container is an element `type: container` with `props: {}`. `ContainerBox`:
- Is a `useDroppable({ id: 'container-<id>' })` target (registered with the **outer** DndContext, because its own content has no inner DndContext) — receives palette drops.
- Renders its children (`parentId === el.id`, sorted by `z`) as **absolute-positioned `CanvasElement`s** — fully selectable/resizable/movable via the shared `MoveableLayer`, just like top-level canvas elements. This is recursive: a container child may itself be a container.
- Has a header (drag handle for moveable) with a `+` button (`data-no-drag`) to add a child at center.
- Children's coordinate space is the container (offsetParent = `ContainerBox` root, which is borderless/zero-offset so drop coords match).

**There is no `@dnd-kit/sortable` and no flow sorting** — "排序" inside a container is z-order via the PropertiesPanel buttons (`reorderZAtom`), not drag-reorder of cards.

### Styling & config

- CSS Modules via co-located `.module.less`; global tokens as CSS custom properties in `src/styles/index.less` (light/dark via `prefers-color-scheme`). antd theme token set in `main.jsx` (primary `#58a6ff`, zh_CN locale).
- Path alias `@` → `src/` (in `vite.config.js` and `.eslintrc.cjs`).
- `src/editor/elements/`: element-type **registry** (component-library style). Each type is a self-contained definition `{ type, label, icon, defaults, Content, Props }` (one file per type: `Text.jsx`, `Rect.jsx`, ...; `Container.js` has `Content: null`/`Props: null` since it's rendered specially). `index.js` aggregates them and derives `ELEMENT_TYPES`, `PALETTE_ITEMS`, `PALETTE_ITEM_MAP`, `ELEMENT_ICONS`, `getDef(type)`. `Content`/`Props` are module-level components that receive `styles` from the caller (CanvasElement/Preview inject their own CSS module; PropertiesPanel injects panel styles), so editor and preview share one renderer per type. **Adding a type = one new file + one line in `index.js`** — no switch statements to touch.
- `src/editor/constants.js`: canvas/zoom/snap config only (`UNIT`, `CANVAS_WIDTH/HEIGHT`, `MIN_ZOOM`/`MAX_ZOOM`/`ZOOM_STEP`, `SNAP_THRESHOLD`). Element-type metadata lives in `elements/`, not here.
- `src/editor/utils.js`: pure helpers (`createElement`, `getBounds`, `expandGroupSelection`, `patchElement`/`patchElements`, `toPercent`/`pxToUnit`, `genId`).

## Gotchas

- **Do not remove `@dnd-kit/utilities`** — it's unused in `src/` but is a transitive dependency of `@dnd-kit/core`; removing it breaks the build. (`@dnd-kit/sortable` was removed — containers no longer use it.)
- **`react-hooks/set-state-in-effect`**: reading DOM refs in `useLayoutEffect` then `setState` is sometimes necessary (post-commit ref measurement). The rule is disabled inline where genuinely required, with a comment.
- antd v6 icon `CircleOutlined` does not exist; `AimOutlined` is used for the circle type.
- `react-moveable`'s `dragStart(e, node)` programmatic initiation causes stuck drags — use the capture-phase `flushSync(select)` pattern instead (see above).
