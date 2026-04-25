import type { TextReference } from '@officium-novum/rubrical-engine';

export const MAX_DEFERRED_DEPTH = 8;

export function referenceKey(ref: TextReference): string {
  return `${ref.path}#${ref.section}${ref.selector ? `:${ref.selector}` : ''}`;
}
