import type { TemporalSubstitutionEntry } from '@officium-novum/parser';

import type { TemporalSubstitutionTable } from '../types/model.js';

export interface NamedTemporalSubstitutionEntries {
  readonly name: string;
  readonly entries: readonly TemporalSubstitutionEntry[];
}

class InMemoryTemporalSubstitutionTable implements TemporalSubstitutionTable {
  constructor(
    private readonly tables: ReadonlyMap<string, ReadonlyMap<string, TemporalSubstitutionEntry>>
  ) {}

  get(kalendar: string): ReadonlyMap<string, TemporalSubstitutionEntry> | undefined {
    return this.tables.get(kalendar);
  }

  get size(): number {
    return this.tables.size;
  }
}

export function buildTemporalSubstitutionTable(
  input: readonly NamedTemporalSubstitutionEntries[]
): TemporalSubstitutionTable {
  const tables = new Map<string, ReadonlyMap<string, TemporalSubstitutionEntry>>();

  for (const table of input) {
    const bySource = new Map<string, TemporalSubstitutionEntry>();
    for (const entry of table.entries) {
      if (!bySource.has(entry.source)) {
        bySource.set(entry.source, entry);
      }
    }
    tables.set(table.name, bySource);
  }

  return new InMemoryTemporalSubstitutionTable(tables);
}
