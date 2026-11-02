import type { KMap } from '../types';
import { branchColor } from '../theme';

/** 历史卡片上的小地图：根在中间，分支向两侧伸出色条。 */
export function MapThumb({ map }: { map: KMap }) {
  const root = map.nodes[map.rootId];
  const kids = (root?.childIds ?? []).map((id) => map.nodes[id]).filter(Boolean).slice(0, 8);
  const right = kids.filter((n) => n.side !== 'left');
  const left = kids.filter((n) => n.side === 'left');
  const cx = 120;
  const cy = 52;

  const lane = (group: typeof kids, dir: 1 | -1) =>
    group.map((n, i) => {
      const y = cy + (i - (group.length - 1) / 2) * 11;
      const color = branchColor(n.color).stroke;
      const x = cx + dir * 86;
      return (
        <g key={n.id}>
          <path
            d={`M ${cx + dir * 18} ${cy} C ${cx + dir * 46} ${cy}, ${cx + dir * 46} ${y}, ${x - dir * 22} ${y}`}
            stroke={color}
            strokeWidth="1.6"
            fill="none"
          />
          <rect x={dir > 0 ? x - 22 : x - 30} y={y - 3.5} width="52" height="7" rx="3.5" fill={color} opacity="0.9" />
        </g>
      );
    });

  return (
    <svg viewBox="0 0 240 104" className="h-[76px] w-full" aria-hidden>
      {lane(right, 1)}
      {lane(left, -1)}
      <rect x={cx - 20} y={cy - 7} width="40" height="14" rx="4" className="fill-ink" />
    </svg>
  );
}
