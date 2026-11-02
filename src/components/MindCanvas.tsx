import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  useReactFlow,
  type Edge,
  type FitViewOptions,
  type NodeChange,
} from '@xyflow/react';
import { getPath, useStore } from '../store';
import { expandNode } from '../actions';
import { layoutMap, structureSignature, type Placed } from '../layout';
import { subtreeHealth } from '../srs';
import { paintOf } from '../theme';
import type { KMap } from '../types';
import { MindNodeView, type MindFlowNode } from './MindNode';
import { CanvasTopBar } from './CanvasTopBar';
import { DetailPanel } from './DetailPanel';

const nodeTypes = { mind: MindNodeView };
const DURATION = 520;

/** 视野留白：给顶栏、底部提示和右侧详情面板让出位置 */
function viewPadding(panelOpen: boolean, single: boolean): FitViewOptions['padding'] {
  const base = single ? '22%' : '48px';
  return { top: '96px', bottom: '72px', left: base, right: panelOpen ? '460px' : base };
}

/** 布局变化时，节点从旧位置（新节点从父节点位置）平滑滑到新位置 */
function useAnimatedLayout(target: Record<string, Placed>, mapRef: React.RefObject<KMap>) {
  const [positions, setPositions] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from: Record<string, Placed> = {};
    for (const id of Object.keys(target)) {
      let origin = current.current[id];
      let cursor = mapRef.current?.nodes[id]?.parentId ?? null;
      while (!origin && cursor) {
        origin = current.current[cursor];
        cursor = mapRef.current?.nodes[cursor]?.parentId ?? null;
      }
      from[id] = origin ?? target[id];
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / DURATION);
      const e = 1 - Math.pow(1 - k, 4);
      const next: Record<string, Placed> = {};
      for (const [id, t] of Object.entries(target)) {
        const f = from[id];
        next[id] = { side: t.side, x: f.x + (t.x - f.x) * e, y: f.y + (t.y - f.y) * e };
      }
      current.current = next;
      setPositions(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, mapRef]);

  return positions;
}

export function MindCanvas({ mapId }: { mapId: string }) {
  const map = useStore((s) => s.maps[mapId]);
  const selectedId = useStore((s) => s.selectedId);
  const focus = useStore((s) => s.focus);
  const selectNode = useStore((s) => s.selectNode);
  const theme = useStore((s) => s.settings.theme);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const rf = useReactFlow();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const mapRef = useRef(map);
  mapRef.current = map;

  const signature = structureSignature(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => layoutMap(map), [signature]);
  const positions = useAnimatedLayout(target, mapRef);

  const pathIds = useMemo(() => {
    const id = hoverId ?? selectedId;
    if (!id || !map.nodes[id]) return new Set<string>();
    return new Set(getPath(map, id).map((n) => n.id));
  }, [hoverId, selectedId, map]);

  const onToggle = useCallback((id: string) => toggleCollapse(mapId, id), [mapId, toggleCollapse]);
  const onPeek = useCallback((id: string) => selectNode(id), [selectNode]);
  const onExpand = useCallback(
    (id: string) => {
      const node = mapRef.current.nodes[id];
      if (!node || node.status === 'loading') return;
      selectNode(id);
      if (!node.expanded || node.status === 'error') void expandNode(mapId, id);
    },
    [mapId, selectNode],
  );

  // 受控模式下 React Flow 从节点对象上读取尺寸，必须把测量结果回写，否则节点会被隐藏
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback((changes: NodeChange<MindFlowNode>[]) => {
    setMeasured((prev) => {
      let next = prev;
      for (const c of changes) {
        if (c.type !== 'dimensions' || !c.dimensions) continue;
        const old = prev[c.id];
        if (old && old.width === c.dimensions.width && old.height === c.dimensions.height) continue;
        if (next === prev) next = { ...prev };
        next[c.id] = { width: c.dimensions.width, height: c.dimensions.height };
      }
      return next;
    });
  }, []);

  const nodes: MindFlowNode[] = useMemo(
    () =>
      Object.entries(positions)
        .filter(([id]) => map.nodes[id])
        .map(([id, p]) => ({
          id,
          type: 'mind' as const,
          position: { x: p.x, y: p.y },
          measured: measured[id],
          draggable: false,
          data: {
            node: map.nodes[id],
            side: p.side,
            selected: id === selectedId,
            onPath: pathIds.has(id),
            hiddenCount: map.nodes[id].childIds.filter((cid) => map.nodes[cid]?.hidden).length,
            onToggle,
            onPeek,
            onExpand,
          },
        })),
    [positions, map, selectedId, pathIds, onToggle, onPeek, onExpand, measured],
  );

  const edges: Edge[] = useMemo(() => {
    const list: Edge[] = [];
    const highlighting = pathIds.size > 1;
    for (const [id, p] of Object.entries(target)) {
      const n = map.nodes[id];
      if (!n?.parentId || !target[n.parentId]) continue;
      const health = subtreeHealth(map, id);
      const stroke = health === 'lost' ? '#e11d48' : health === 'fuzzy' ? '#d97706' : paintOf(n).stroke;
      const onPath = pathIds.has(id) && pathIds.has(n.parentId);
      const width = Math.max(1.6, 3.4 - (n.depth - 1) * 0.6);
      list.push({
        id: `${n.parentId}->${id}`,
        source: n.parentId,
        target: id,
        sourceHandle: p.side === 'left' ? 'l' : 'r',
        targetHandle: p.side === 'left' ? 'tr' : 'tl',
        type: 'default',
        animated: map.nodes[n.parentId]?.status === 'loading',
        style: {
          stroke,
          strokeWidth: onPath ? width + 1.2 : width,
          strokeOpacity: highlighting ? (onPath ? 0.95 : 0.22) : 0.55,
        },
      });
    }
    return list;
  }, [target, map, pathIds]);

  const rfRef = useRef(rf);
  rfRef.current = rf;
  const panelOpen = Boolean(selectedId && map.nodes[selectedId]);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  useEffect(() => {
    if (!focus || focus.mapId !== mapId) return;
    const t = setTimeout(() => {
      rfRef.current.fitView({
        nodes: focus.ids.map((id) => ({ id })),
        duration: 700,
        padding: viewPadding(panelOpenRef.current, focus.ids.length === 1),
        maxZoom: 1.05,
      });
    }, DURATION - 80);
    return () => clearTimeout(t);
  }, [focus, mapId]);

  useEffect(() => {
    const t = setTimeout(() => rfRef.current.fitView({ padding: viewPadding(false, false), maxZoom: 1, duration: 0 }), 30);
    return () => clearTimeout(t);
  }, []);

  const comparePick = useStore((s) => s.comparePick);
  const cancelCompare = useStore((s) => s.cancelCompare);

  const handleNodeClick = useCallback(
    (id: string) => {
      const node = mapRef.current.nodes[id];
      if (!node) return;
      const pick = useStore.getState().comparePick;
      if (pick) {
        if (pick !== id) useStore.getState().finishCompare(id);
        return;
      }
      selectNode(id);
    },
    [selectNode],
  );

  return (
    <div className="relative h-full w-full bg-paper">
      {comparePick && (
        <div className="absolute top-[78px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-card px-4 py-2 text-[13px] shadow-lg">
          <span className="text-ink">再点一个节点，并排看相同和不同</span>
          <button type="button" onClick={cancelCompare} className="text-faint hover:text-ink">
            取消
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodeOrigin={[0.5, 0.5]}
        onNodeClick={(_, n) => handleNodeClick(n.id)}
        onNodeMouseEnter={(_, n) => setHoverId(n.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onPaneClick={() => selectNode(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.12}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.1}
          color={theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(28,31,38,0.16)'}
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!m-4 overflow-hidden rounded-2xl border border-line bg-card/85 backdrop-blur"
        />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          className="!mb-4 !ml-[68px] border border-line !bg-card/85 backdrop-blur"
          style={{ width: 168, height: 112 }}
          maskColor={theme === 'dark' ? 'rgba(14,14,16,0.72)' : 'rgba(246,245,241,0.7)'}
          nodeBorderRadius={8}
          nodeColor={(n) => paintOf((n.data as MindFlowNode['data']).node).stroke}
        />
      </ReactFlow>

      <CanvasTopBar mapId={mapId} />
      <DetailPanel mapId={mapId} />

      {Object.keys(map.nodes).length <= 8 && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-line bg-card/70 px-4 py-1.5 text-[12px] text-muted backdrop-blur">
          点加号散开 · Enter 也可以 · N 自己写 · ? 快捷键
        </div>
      )}
    </div>
  );
}
