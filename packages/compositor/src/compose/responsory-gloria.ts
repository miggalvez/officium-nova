import type { TextContent } from '@officium-novum/parser';

/**
 * Long responsories use the short Gloria Patri doxology form: the versicle is
 * followed by the responsory repeat, not by the full Sicut erat response.
 */
export function normalizeResponsoryGloria(content: readonly TextContent[]): readonly TextContent[] {
  let changed = false;
  const out: TextContent[] = [];
  for (let index = 0; index < content.length; index += 1) {
    const node = content[index]!;
    if (node.type === 'conditional') {
      const normalizedContent = normalizeResponsoryGloria(node.content);
      if (normalizedContent !== node.content) {
        changed = true;
        out.push({
          ...node,
          content: [...normalizedContent]
        });
      } else {
        out.push(node);
      }
      continue;
    }
    if (isResponsorySicutEratNode(node)) {
      changed = true;
      continue;
    }
    out.push(node);
  }
  return changed ? Object.freeze(out) : content;
}

function isResponsorySicutEratNode(node: TextContent): boolean {
  if (node.type === 'verseMarker') {
    return /^r\.?$/iu.test(node.marker.trim()) && /^sicut erat\b/iu.test(node.text.trim());
  }
  if (node.type === 'text') {
    return /^r\.\s*sicut erat\b/iu.test(node.value.trim());
  }
  return false;
}
