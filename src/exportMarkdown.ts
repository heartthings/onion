import type { Highlight, KMap } from './types';

export function mapToMarkdown(map: KMap): string {
  const lines: string[] = [];
  const root = map.nodes[map.rootId];
  lines.push(`# ${root.title}`, '');
  if (root.summary) lines.push(`> ${root.summary}`, '');

  const walk = (id: string, level: number) => {
    const n = map.nodes[id];
    if (!n) return;
    const indent = '  '.repeat(level);
    lines.push(`${indent}- **${n.title}**${n.summary ? `：${n.summary}` : ''}`);
    if (n.note?.trim()) lines.push(`${indent}  - 📝 ${n.note.trim().replace(/\n+/g, ' ')}`);
    n.childIds.forEach((c) => walk(c, level + 1));
  };
  root.childIds.forEach((c) => walk(c, 0));

  const explained = Object.values(map.nodes).filter((n) => n.detail?.trim());
  if (explained.length) {
    lines.push('', '---', '', '## 深度讲解', '');
    explained.forEach((n) => {
      lines.push(`### ${n.title}`, '', n.detail!.replace(/^## /gm, '#### '), '');
    });
  }
  return lines.join('\n');
}

function cell(value: string) {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

export function studyToMarkdown(maps: KMap[], highlights: Highlight[]): string {
  const lines = ['# 复习材料', ''];
  for (const map of maps) {
    const marks = highlights.filter((item) => item.mapId === map.id);
    const notes = Object.values(map.nodes).filter((node) => node.note?.trim() || node.favorite);
    if (!marks.length && !notes.length) continue;
    lines.push(`## ${map.title}`, '');
    if (marks.length) {
      lines.push('### 划线', '');
      for (const mark of marks) {
        const title = map.nodes[mark.nodeId]?.title ?? '已删除的节点';
        lines.push(`- 「${mark.quote}」—— ${title}`);
      }
      lines.push('');
    }
    const written = Object.values(map.nodes).filter((node) => node.note?.trim());
    if (written.length) {
      lines.push('### 笔记', '');
      for (const node of written) lines.push(`#### ${node.title}`, '', node.note!.trim(), '');
    }
  }
  return lines.join('\n');
}

export function studyToAnki(maps: KMap[], highlights: Highlight[]): string {
  const rows = ['#separator:tab', '#html:false', '#columns:Front\tBack\tTags'];
  for (const map of maps) {
    const tag = cell(map.title) || 'onion';
    for (const mark of highlights.filter((item) => item.mapId === map.id)) {
      const node = map.nodes[mark.nodeId];
      rows.push([cell(mark.quote), cell(`${node?.title ?? ''}\n${node?.summary ?? ''}`), tag].join('\t'));
    }
    for (const node of Object.values(map.nodes)) {
      if (!node.note?.trim() && !node.favorite) continue;
      const back = [node.summary, node.note].filter((text) => text?.trim()).join('\n');
      rows.push([cell(node.title), cell(back || node.title), tag].join('\t'));
    }
  }
  return rows.join('\n');
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
