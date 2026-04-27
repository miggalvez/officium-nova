import type { TextContent, TextIndex } from '@officium-novum/parser';
import type {
  ConditionEvalContext,
  DayOfficeSummary,
  HourName,
  HourStructure,
  TextReference
} from '@officium-novum/rubrical-engine';

import { applyDirectives } from '../directives/index.js';
import { emitConfiguredSection } from '../emit/sections.js';
import { flattenConditionals } from '../flatten/index.js';
import { expandDeferredNodes } from '../resolve/expand-deferred-nodes.js';
import { resolveReference } from '../resolve/reference-resolver.js';
import type { ComposeOptions, ComposeWarning, Section } from '../types/composed-hour.js';
import { appendContentWithBoundary } from './content-boundary.js';
import { resolveGloriaOmittiturReplacement } from './gloria-omittitur.js';
import { MAX_DEFERRED_DEPTH, referenceKey } from './shared.js';

interface ComposeTriduumSuppressedVespersArgs {
  readonly hour: HourName;
  readonly summary: DayOfficeSummary;
  readonly corpus: TextIndex;
  readonly options: ComposeOptions;
  readonly context: ConditionEvalContext;
  readonly onWarning?: (warning: ComposeWarning) => void;
}

export function composeTriduumSuppressedVespersSection(
  args: ComposeTriduumSuppressedVespersArgs
): Section | undefined {
  if (
    args.hour !== 'vespers' ||
    !args.context.version.handle.match(/(?:1955|1960)/u) ||
    !/^Tempora\/Quad6-[45]r?$/u.test(args.summary.celebration.feastRef.path)
  ) {
    return undefined;
  }

  const ref: TextReference = {
    path: `horas/Latin/${args.summary.celebration.feastRef.path}`,
    section: 'Prelude Vespera'
  };
  const perLanguage = resolveFlatSection(ref, args);
  if (perLanguage.size === 0) {
    return undefined;
  }

  return emitConfiguredSection(
    {
      slot: 'psalmody',
      sectionSlot: 'vespers-suppression',
      sectionType: 'rubric'
    },
    perLanguage,
    referenceKey(ref)
  );
}

interface ComposeEasterSundayPreludeArgs {
  readonly hour: HourName;
  readonly summary: DayOfficeSummary;
  readonly corpus: TextIndex;
  readonly options: ComposeOptions;
  readonly context: ConditionEvalContext;
  readonly onWarning?: (warning: ComposeWarning) => void;
}

/**
 * Easter Sunday Matins / Lauds carry a `[Prelude Matutinum]` /
 * `[Prelude Laudes]` rubric block under 1955 and 1960 rubrics. The block
 * notes that Matins of the Resurrection is omitted in favor of the
 * solemn Paschal Vigil for those who attended, and that those who did
 * not attend are still bound to recite Matins and Lauds. The legacy
 * Perl renderer prepends this rubric before the regular Hour content.
 */
export function composeEasterSundayPreludeSection(
  args: ComposeEasterSundayPreludeArgs
): Section | undefined {
  if (args.hour !== 'matins' && args.hour !== 'lauds') {
    return undefined;
  }
  if (!args.context.version.handle.match(/(?:1955|1960)/u)) {
    return undefined;
  }
  if (args.summary.celebration.feastRef.path !== 'Tempora/Pasc0-0') {
    return undefined;
  }

  const sectionName = args.hour === 'matins' ? 'Prelude Matutinum' : 'Prelude Laudes';
  const ref: TextReference = {
    path: `horas/Latin/${args.summary.celebration.feastRef.path}`,
    section: sectionName
  };
  const perLanguage = resolveFlatSection(ref, args);
  if (perLanguage.size === 0) {
    return undefined;
  }

  return emitConfiguredSection(
    {
      slot: 'psalmody',
      sectionSlot: 'paschal-vigil-prelude',
      sectionType: 'rubric'
    },
    perLanguage,
    referenceKey(ref)
  );
}

interface ComposeTriduumSpecialComplineArgs {
  readonly hour: HourName;
  readonly structure: HourStructure;
  readonly summary: DayOfficeSummary;
  readonly corpus: TextIndex;
  readonly options: ComposeOptions;
  readonly context: ConditionEvalContext;
  readonly onWarning?: (warning: ComposeWarning) => void;
}

export function composeTriduumSpecialComplineSection(
  args: ComposeTriduumSpecialComplineArgs
): Section | undefined {
  if (args.hour !== 'compline' || args.structure.source?.kind !== 'triduum-special') {
    return undefined;
  }

  const ref: TextReference = {
    path: `horas/Latin/${args.summary.celebration.feastRef.path}`,
    section: 'Special Completorium'
  };
  const resolved = resolveReference(args.corpus, ref, {
    languages: args.options.languages,
    langfb: args.options.langfb,
    dayOfWeek: args.context.dayOfWeek,
    date: args.context.date,
    season: args.context.season,
    version: args.context.version,
    modernStyleMonthday: args.context.version.handle.includes('1960'),
    ...(args.onWarning ? { onWarning: args.onWarning } : {})
  });

  const perLanguage = new Map<string, readonly TextContent[]>();
  for (const lang of args.options.languages) {
    const section = resolved[lang];
    if (!section) {
      continue;
    }
    if (section.selectorMissing) {
      perLanguage.set(
        lang,
        Object.freeze([
          {
            type: 'rubric',
            value: `(Section missing: ${ref.section})`
          } satisfies TextContent
        ])
      );
      continue;
    }
    const bucket: TextContent[] = [];
    const gloriaOmittiturReplacement = resolveGloriaOmittiturReplacement({
      directives: args.structure.directives,
      corpus: args.corpus,
      language: lang,
      langfb: args.options.langfb,
      context: args.context,
      maxDepth: MAX_DEFERRED_DEPTH,
      ...(args.onWarning ? { onWarning: args.onWarning } : {})
    });
    const sourceNodes = flattenConditionals(section.content, args.context);
    for (const node of sourceNodes) {
      if (node.type === 'separator') {
        bucket.push({
          type: 'gabcNotation',
          notation: {
            kind: 'header',
            notation: '',
            text: '_'
          }
        });
        continue;
      }

      if (node.type === 'psalmInclude') {
        appendContentWithBoundary(bucket, [
          {
            type: 'gabcNotation',
            notation: {
              kind: 'header',
              notation: '',
              text: `Psalmus ${node.psalmNumber} [${node.psalmNumber}]`
            }
          }
        ]);
      }

      const expanded = expandDeferredNodes([node], {
        index: args.corpus,
        language: lang,
        langfb: args.options.langfb,
        season: args.context.season,
        seen: new Set(),
        maxDepth: MAX_DEFERRED_DEPTH,
        ...(args.onWarning ? { onWarning: args.onWarning } : {})
      });
      const flattened = flattenConditionals(expanded, args.context);
      // The Triduum uses a single `Special Completorium` source block rather
      // than the ordinary slot lattice. We still run the psalmody-style
      // normalizer/directive pass so inline psalm text canonicalizes the same
      // way as ordinary Compline while bypassing the ordinary short reading.
      const transformed = applyDirectives('psalmody', flattened, {
        hour: args.hour,
        directives: args.structure.directives,
        gloriaOmittiturReplacement
      });
      appendContentWithBoundary(bucket, transformed);
    }
    if (bucket.length > 0) {
      perLanguage.set(lang, Object.freeze(bucket));
    }
  }

  if (perLanguage.size === 0) {
    return undefined;
  }

  return emitConfiguredSection(
    {
      slot: 'psalmody',
      sectionSlot: 'special-compline',
      sectionType: 'other'
    },
    perLanguage,
    referenceKey(ref)
  );
}

function resolveFlatSection(
  ref: TextReference,
  args: ComposeTriduumSuppressedVespersArgs | ComposeEasterSundayPreludeArgs
): Map<string, readonly TextContent[]> {
  const resolved = resolveReference(args.corpus, ref, {
    languages: args.options.languages,
    langfb: args.options.langfb,
    dayOfWeek: args.context.dayOfWeek,
    date: args.context.date,
    season: args.context.season,
    version: args.context.version,
    modernStyleMonthday: args.context.version.handle.includes('1960'),
    ...(args.onWarning ? { onWarning: args.onWarning } : {})
  });

  const perLanguage = new Map<string, readonly TextContent[]>();
  for (const lang of args.options.languages) {
    const section = resolved[lang];
    if (!section || section.selectorMissing) {
      continue;
    }
    const expanded = expandDeferredNodes(flattenConditionals(section.content, args.context), {
      index: args.corpus,
      language: lang,
      langfb: args.options.langfb,
      season: args.context.season,
      seen: new Set(),
      maxDepth: MAX_DEFERRED_DEPTH,
      ...(args.onWarning ? { onWarning: args.onWarning } : {})
    });
    const flattened = flattenConditionals(expanded, args.context);
    // The `psalmody` emit slot used by these rubric prelude sections does
    // not surface raw `separator` nodes as `_` lines. Convert them to the
    // gabc-notation header form used elsewhere in this file so the
    // Easter Sunday `[Prelude Matutinum]` / `[Prelude Laudes]` blank
    // separator between the two rubric sentences renders as `_`.
    const normalized: TextContent[] = [];
    for (const node of flattened) {
      if (node.type === 'separator') {
        normalized.push({
          type: 'gabcNotation',
          notation: {
            kind: 'header',
            notation: '',
            text: '_'
          }
        });
        continue;
      }
      normalized.push(node);
    }
    if (normalized.length > 0) {
      perLanguage.set(lang, Object.freeze(normalized));
    }
  }

  return perLanguage;
}
