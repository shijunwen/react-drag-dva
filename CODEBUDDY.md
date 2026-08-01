# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Commands

- **Dev server**: `pnpm dev` (or `npm run dev`) — starts Vite dev server at `http://localhost:5173` (host `0.0.0.0`, `strictPort` enabled so the port is fixed).
- **Build**: `pnpm build` — production build via Vite; manual chunks split `react`, `antd`, `react-moveable`, and `@dnd-kit` into separate bundles.
- **Preview**: `pnpm preview` — serves the production build on port 5173.
- **Lint**: `pnpm lint` — runs ESLint on `src/**/*.{js,jsx}` with `--max-warnings 0` (any warning fails). Use `pnpm lint:fix` to auto-fix.
- **No test runner is configured.**

## Architecture

This is a **visual drag-and-drop editor** (拖拽编辑器): users drag component types from a palette onto a canvas, then move/resize them with manipulation handles. The app is built with React 18 + Vite, Ant Design 6 (antd v6), Jotai for state, `@dnd-kit` for palette→canvas and container-internal drag, and `react-moveable` for element manipulation (drag/resize/snap).

### Entry & layout

`examples/main.jsx` renders `<App />` inside antd's `ConfigProvider` (zh_CN locale, primary color `#58a6ff`). `examples/App.jsx` mounts an antd `Layout` with `AppHeader` (toolbar: undo/redo, group/ungroup, align, delete, clear) and the `Editor` component filling the content area.

### State management (Jotai atoms)

All editor state lives in `src/atoms/` (split by concern: `base`/`elements`/`history`/`selection`/`viewport`/`preview`) and is re-exported from `src/atoms/index.js`. Key atoms:

- `elementsAtom` — flat array of all canvas elements (each has `id`, `type`, `x/y/width/height/rotation`, `groupId`, `props`).
- `selectedIdsAtom` — array of selected element IDs (multi-select supported).
- `selectedElementsAtom` — derived atom filtering `elementsAtom` by `selectedIdsAtom`.
- `pastAtom` / `futureAtom` — undo/redo snapshot stacks (capped at 50 entries).
- `viewportAtom` — canvas viewport state (`{ zoom, scrollLeft, scrollTop }`), driven by `InfiniteViewer`. `setViewportAtom`/`setZoomAtom` are write atoms for updates.
- Write-only action atoms (`addElementAtom`, `updateElementAtom`, `deleteSelectedAtom`, `groupSelectedAtom`, `alignSelectedAtom`, `undoAtom`, `redoAtom`, container-item atoms, etc.) encapsulate all mutations. **All state changes must go through these atoms** — do not mutate `elementsAtom` directly outside of `editor.js`.

`src/editor/useEditor.js` is the **single unified hook** that components use to read state and invoke actions. It binds each write atom via `useSetAtom`, which reads the latest state inside the atom's `get` — this avoids stale closures in gesture callbacks. New components should consume editor functionality through `useEditor()` rather than importing atoms directly.

### Editor component structure

`src/editor/Editor.jsx` sets up a top-level `DndContext` (from `@dnd-kit/core`) and renders three regions:

1. **Palette** (`src/editor/Palette/`) — draggable component buttons. Each uses `useDraggable` with `data: { type }`.
2. **Canvas** (`src/editor/Canvas/`) — the drop target (`id: "canvas-board"`) and rendering surface. Wrapped in `react-infinite-viewer` (`InfiniteViewer`) which provides infinite panning (mouse drag) and zoom (ctrl+wheel pinch, trackpad gesture, or zoom buttons bottom-right). `viewportAtom` stores `{ zoom, scrollLeft, scrollTop }` and is synced via `onScroll`/`onPinch`. The `.board` div has fixed logical dimensions (1200×720) and hosts `CanvasElement` instances + `MoveableLayer`.
3. **PropertiesPanel** (`src/editor/PropertiesPanel/`) — right sidebar. Shows position/size fields and type-specific props for a single selection; shows group bounds and group/ungroup buttons for multi-selection.

`src/editor/constants.js` defines `ELEMENT_TYPES`, `PALETTE_ITEMS` (default size + props per type), canvas dimensions (1200×720), and snap threshold (6px). `src/editor/utils.js` holds pure helpers: `createElement`, `getBounds`, `expandGroupSelection`, `patchElement`/`patchElements`, `genId`. `src/editor/icons.jsx` maps element types to antd icons.

### Canvas & moveable interaction (performance-critical)

`Canvas.jsx` maintains an `elementRefs` Map (element id → DOM node) and a `moveableRef`. Selection is handled in `onPointerDownCapture` (capture phase, before moveable's gesto): for an unselected element it calls `flushSync(() => select([id]))` so moveable re-binds in the same event tick and can continue the drag seamlessly. Elements marked `data-item` (container children) or `data-no-drag` (container header buttons) are excluded from canvas selection/drag.

`MoveableLayer.jsx` implements the core performance strategy: **during a drag/resize gesture, it writes directly to the DOM via `applyToDom()` (zero React re-renders), and only commits the final patch to `updateElementAtom`/`updateElementsAtom` on gesture end (via `flushSync` so moveable's auto-`updateRect` sees the new position).** `beginChangeAtom` (which pushes an undo snapshot) is called lazily on first actual movement, not on gesture start, to avoid empty undo entries. Multi-select and grouped elements use `onDragGroup`/`onResizeGroup`. Snapping guidelines are computed from all non-selected elements' edges. The `zoom` from `viewportAtom` is passed to `<Moveable zoom={zoom}>` so drag/resize distances scale correctly. Boundary clamping uses the logical `CANVAS_WIDTH`/`CANVAS_HEIGHT` constants.

### Container elements

Container is a special element type whose `props` include `direction` (row/column), `gap`, and `items` (array of `{ id, type }`). `ContainerBox.jsx` renders each container as a nested `DndContext` + `SortableContext` (using `@dnd-kit/sortable`) for internal item reordering. It is also a `useDroppable` target with id `container-{el.id}`, so palette items can be dropped in. The top-level `Editor.jsx` uses a custom `pickInnermostDroppable` collision detector that picks the smallest-area droppable containing the pointer, so drops onto containers hit the container (not the canvas board).

### Grouping & alignment

Grouping assigns the same `groupId` to selected elements (no nesting — it's a flat tag). `expandGroupSelection` (in `utils.js`) ensures that selecting any member of a group auto-selects all members. Alignment (`alignSelectedAtom`) computes the bounding box of the selection and applies left/right/center/top/bottom/centerV alignment.

### Styling

CSS Modules via `.module.less` files co-located with components. Global design tokens (colors, fonts, transitions) are defined as CSS custom properties in `src/styles/index.less` with light/dark variants via `prefers-color-scheme`. Antd's theme token is set in `examples/main.jsx`. Path alias `@` maps to `src/` (configured in `vite.config.js`).

### ESLint conventions

`.eslintrc.cjs` extends `eslint:recommended` + `plugin:react/recommended` + `plugin:react-hooks/recommended`. Notable rules: `react/react-in-jsx-scope` off (React 17+ JSX transform), `react/prop-types` off, `eqeqeq` always, `prefer-const` error, `no-var` error, `no-console` warn, `no-unused-vars` warn (args prefixed with `_` are ignored).
