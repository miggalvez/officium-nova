import {
  ensureTxtSuffix,
  extractSyntheticHeadingSections,
  languageFallbackChain,
  type ParsedSection,
  type TextContent,
  type TextSource,
  type TextIndex
} from '@officium-novum/parser';
import { conditionMatches, type ConditionEvalContext, type TextReference } from '@officium-novum/rubrical-engine';

import type { ComposeWarning } from '../types/composed-hour.js';
import {
  isKeyedPsalterSection,
  isWeekdayKey,
  selectKeyedTextContent
} from './keyed-content.js';
import {
  materializeInvitatoryContent,
  resolveInvitatoryAntiphonContent,
  resolveSeasonalInvitatorium
} from './invitatory.js';
import { expandPsalmTokenList, resolveMinorHourPsalmody } from './minor-hour-psalmody.js';
import { swapLanguageSegment } from './path.js';

export { materializeInvitatoryContent, resolveInvitatoryAntiphonContent } from './invitatory.js';
export { swapLanguageSegment } from './path.js';

export interface ResolvedSection {
  readonly language: string;
  readonly path: string;
  readonly section: ParsedSection;
  /**
   * When a `selector` is present on the {@link TextReference} and the
   * selector has a semantics the resolver understands, the original section
   * content is narrowed to the selected subset.
   */
  readonly content: readonly TextContent[];
  /**
   * `true` when a `selector` was present but the resolver did not apply any
   * narrowing — either because the selector had semantics the resolver does
   * not yet implement or because the selector was `'missing'`. Callers can
   * use this to surface a warning / placeholder rather than silently
   * returning the whole section.
   */
  readonly selectorUnhandled: boolean;
  /**
   * `true` when the selector was `'missing'` — Phase 2's sentinel for "this
   * slot is intentionally empty because the source section does not exist."
   */
  readonly selectorMissing: boolean;
}

export interface ResolveOptions {
  readonly languages: readonly string[];
  readonly langfb?: string;
  readonly dayOfWeek?: number;
  readonly date?: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
  };
  readonly season?: ConditionEvalContext['season'];
  readonly version?: ConditionEvalContext['version'];
  /**
   * Mirrors the Perl `monthday(..., $modernstyle, ...)` switch used by the
   * ordinary Sunday invitatory selector. `true` for the 1960 family, `false`
   * for older Roman families.
   */
  readonly modernStyleMonthday?: boolean;
  /**
   * Optional callback for compose-time warnings. Per Phase 3 §3f and
   * ADR-011 the resolver no longer silently returns `undefined` when a
   * reference fails to resolve or a selector is not understood — instead
   * it records a {@link ComposeWarning} via this sink and returns the
   * best-effort result. Callers (compose.ts, compose/matins.ts) collect
   * the warnings and surface them on {@link ComposedHour.warnings}.
   */
  readonly onWarning?: (warning: ComposeWarning) => void;
}

/**
 * Resolve a {@link TextReference} (Latin-rooted, as emitted by Phase 2) to a
 * {@link ParsedSection} per requested language. Walks the parser's standard
 * language-fallback chain when the requested language lacks the file.
 *
 * When `reference.selector` is present, the resolver narrows the section
 * content according to the selector's semantics:
 *
 *   - **Integer selector** (`"1"`, `"2"`, …) — picks the Nth content node
 *     (1-based) from the section. When a section is composed entirely of
 *     conditional alternatives, the selector descends through the wrappers and
 *     preserves the condition tree while narrowing each branch to its Nth
 *     child. Emitted by Phase 2 when Matins line-picks antiphons, versicles,
 *     and benedictions from the psalterium (`matins-plan.ts`
 *     lines 265, 351).
 *   - **`'missing'` sentinel** — Phase 2's placeholder for "section not
 *     found." The resolver preserves the full section content but sets
 *     {@link ResolvedSection.selectorMissing} so callers can surface a
 *     rubric warning instead of rendering stale text.
 *   - **Psalm-selector lists** (`"62,66"`, `"116"`) on
 *     `Psalterium/Psalmorum/PsalmN` — expand to the referenced psalm file(s),
 *     including verse-range tokens like `118(1-16)`.
 *   - **Weekday keys** (`Dominica`, `Feria II`, ...) on
 *     `Psalterium/Psalmi/Psalmi minor` — select the keyed entry for the
 *     requested weekday and expand its psalm list.
 *   - **Season keys** (`Adventus`, `Pascha`, ...) on `Invitatorium.txt` —
 *     inject the season's invitatory antiphon into the fixed Psalm 94
 *     skeleton using the current day of week where the special file is
 *     weekday-keyed.
 *   - **Heading-backed synthetic sections** on files such as
 *     `horas/Ordinarium/*.txt` — when a named section is absent but the file
 *     exposes a `__preamble` with `#Heading` markers, the resolver slices the
 *     content between matching headings and returns it as a synthetic section.
 *
 * Returns `undefined` for a language when no file in its fallback chain
 * contains the referenced section.
 */
export function resolveReference(
  index: TextIndex,
  reference: TextReference,
  options: ResolveOptions
): Readonly<Record<string, ResolvedSection>> {
  const out: Record<string, ResolvedSection> = {};
  for (const language of options.languages) {
    const resolved = resolveForLanguage(index, reference, language, options);
    if (resolved) {
      out[language] = resolved;
    } else if (options.onWarning) {
      options.onWarning({
        code: 'resolve-missing-section',
        message: `Reference did not resolve in language '${language}' after fallback chain exhausted.`,
        severity: 'warn',
        context: {
          path: reference.path,
          section: reference.section,
          language,
          ...(reference.selector ? { selector: reference.selector } : {})
        }
      });
    }
  }
  return Object.freeze(out);
}

function resolveForLanguage(
  index: TextIndex,
  reference: TextReference,
  language: string,
  options: Pick<
    ResolveOptions,
    'langfb' | 'dayOfWeek' | 'date' | 'season' | 'version' | 'modernStyleMonthday' | 'onWarning'
  >,
  sourceFallbackDepth = 0
): ResolvedSection | undefined {
  const { langfb, dayOfWeek, date, season, version, modernStyleMonthday, onWarning } = options;
  const synthesized = synthesizeSection(index, reference, language, options);
  if (synthesized) {
    return synthesized;
  }

  const chain = languageFallbackChain(language, { langfb });
  for (const candidate of chain) {
    const candidatePath = swapLanguageSegment(reference.path, candidate);
    const section = resolveSectionByName(index, candidatePath, reference.section);
    if (section) {
      const selected = applySelector(index, {
        language: candidate,
        path: candidatePath,
        section,
        selector: reference.selector,
        langfb,
        dayOfWeek,
        date,
        season,
        version,
        modernStyleMonthday,
        onWarning
      });
      if (candidate !== language) {
        const sourceLocalized = resolveLocalizedSourceFallback(
          index,
          selected,
          language,
          candidate,
          options,
          sourceFallbackDepth
        );
        if (sourceLocalized) {
          return sourceLocalized;
        }
      }
      return selected;
    }
  }
  return undefined;
}

function synthesizeSection(
  index: TextIndex,
  reference: TextReference,
  language: string,
  options: Pick<ResolveOptions, 'season'>
): ResolvedSection | undefined {
  const commonPrayer = synthesizeLocalizedCommonPrayerSection(index, reference, language);
  if (commonPrayer) {
    return commonPrayer;
  }

  const primaChapter = synthesizePrimaSpecialChapter(index, reference, language);
  if (primaChapter) {
    return primaChapter;
  }

  if (isPaschalSeason(options.season)) {
    const special = synthesizePaschalSpecialResponsory(index, reference, language);
    if (special) {
      return special;
    }
  }

  return synthesizeLocalizedCommonSection(index, reference, language);
}

function synthesizeLocalizedCommonPrayerSection(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  if (
    language === 'Latin' ||
    reference.section !== 'benedictio Completorium' ||
    !reference.path.endsWith('/Psalterium/Common/Prayers')
  ) {
    return undefined;
  }

  const localizedPath = swapLanguageSegment(reference.path, language);
  const jube = firstSection(index, [localizedPath], 'Jube domne');
  const benediction = firstSection(index, [localizedPath], 'Benedictio Completorium_');
  if (!jube || !benediction) {
    return undefined;
  }

  return Object.freeze({
    language,
    path: jube.path,
    section: {
      header: reference.section,
      condition: undefined,
      startLine: jube.section.startLine,
      endLine: benediction.section.endLine,
      content: []
    },
    content: Object.freeze([...jube.section.content, ...benediction.section.content]),
    selectorUnhandled: false,
    selectorMissing: false
  });
}

function synthesizePrimaSpecialChapter(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  if (
    !PRIMA_SPECIAL_CHAPTER_SECTIONS.has(reference.section) ||
    !reference.path.endsWith('/Psalterium/Special/Prima Special')
  ) {
    return undefined;
  }

  const localizedPath = swapLanguageSegment(reference.path, language);
  const source = firstSection(index, [localizedPath], reference.section);
  if (!source || source.section.content.some(isDeoGratiasFormula)) {
    return undefined;
  }

  const content = reference.selector === 'without-deo-gratias'
    ? source.section.content
    : ([...source.section.content, { type: 'formulaRef', name: 'Deo gratias' }] satisfies TextContent[]);

  return Object.freeze({
    language: source.language,
    path: source.path,
    section: source.section,
    content: Object.freeze(content),
    selectorUnhandled: false,
    selectorMissing: false
  });
}

const PRIMA_SPECIAL_CHAPTER_SECTIONS = new Set([
  'Dominica',
  'Feria',
  'Per Annum',
  'Adv',
  'Nat',
  'Epi',
  'Asc',
  'Quad',
  'Quad5',
  'Pasch',
  'Pent'
]);

function isDeoGratiasFormula(node: TextContent): boolean {
  return node.type === 'formulaRef' && /^deo gratias$/iu.test(node.name.trim());
}

function synthesizeLocalizedCommonSection(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  if (!reference.path.includes('/Commune/')) {
    return undefined;
  }

  const section = reference.section;
  const commonPaths = [
    swapLanguageSegment(reference.path, language),
    `horas/${language}/Commune/C1p`
  ];

  if (section === 'Responsory Breve Tertia') {
    return synthesizePaschalCommonShortResponsory(index, commonPaths, section, 'Versum 1');
  }
  if (section === 'Responsory Breve Sexta') {
    return synthesizePaschalCommonShortResponsory(index, commonPaths, section, 'Nocturn 2 Versum');
  }
  if (section === 'Responsory Breve Nona') {
    return synthesizePaschalCommonShortResponsory(index, commonPaths, section, 'Nocturn 3 Versum');
  }
  if (section === 'Capitulum Nona') {
    return synthesizePaschalCommonNonaChapter(index, commonPaths, section);
  }

  return undefined;
}

function synthesizePaschalSpecialResponsory(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  if (
    reference.section === 'Responsory' &&
    reference.path.endsWith('/Psalterium/Special/Prima Special')
  ) {
    return synthesizePrimePaschalResponsory(index, reference, language);
  }

  if (
    reference.section === 'Responsory Completorium' &&
    reference.path.endsWith('/Psalterium/Special/Minor Special')
  ) {
    return synthesizeComplinePaschalResponsory(index, reference, language);
  }

  return undefined;
}

function synthesizePrimePaschalResponsory(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  const localizedPath = swapLanguageSegment(reference.path, language);
  const responsory = firstSection(index, [localizedPath], 'Responsory');
  const paschal = firstSection(index, [localizedPath], 'Responsory Pasch');
  const firstResponse = firstResponsoryResponse(responsory?.section.content);
  const paschalVersicle = firstTextContent(paschal?.section.content);
  if (!responsory || !firstResponse || !paschalVersicle) {
    return undefined;
  }

  return buildPaschalShortResponsorySection({
    source: responsory,
    header: reference.section,
    responseBase: normalizeStarredShortResponsoryBase(firstResponse.text),
    versicle: paschalVersicle,
    language
  });
}

function synthesizeComplinePaschalResponsory(
  index: TextIndex,
  reference: TextReference,
  language: string
): ResolvedSection | undefined {
  const localizedPath = swapLanguageSegment(reference.path, language);
  const responsory = firstSection(index, [localizedPath], 'Responsory Completorium');
  const firstResponse = firstResponsoryResponse(responsory?.section.content);
  const versicle = firstVerseMarker(responsory?.section.content, /^v\.?$/iu);
  if (!responsory || !firstResponse) {
    return undefined;
  }

  return buildPaschalShortResponsorySection({
    source: responsory,
    header: reference.section,
    responseBase: normalizeStarredShortResponsoryBase(firstResponse.text),
    language,
    ...(versicle ? { versicle: versicle.text } : {})
  });
}

function synthesizePaschalCommonShortResponsory(
  index: TextIndex,
  candidatePaths: readonly string[],
  sectionName: string,
  versicleSectionName: string
): ResolvedSection | undefined {
  const source = firstSection(index, candidatePaths, versicleSectionName);
  const first = source?.section.content.find(
    (node): node is Extract<TextContent, { type: 'verseMarker' }> =>
      node.type === 'verseMarker' && /^v\.?$/iu.test(node.marker.trim())
  );
  const second = source?.section.content.find(
    (node): node is Extract<TextContent, { type: 'verseMarker' }> =>
      node.type === 'verseMarker' && /^r\.?$/iu.test(node.marker.trim())
  );
  if (!source || !first || !second) {
    return undefined;
  }
  if (!hasAlleluiaTail(first.text) && !hasAlleluiaTail(second.text)) {
    return undefined;
  }

  const response = stripAlleluiaTail(first.text);
  const versicle = stripAlleluiaTail(second.text);
  return buildPaschalShortResponsorySection({
    source,
    header: sectionName,
    responseBase: response,
    versicle,
    language: source.language
  });
}

function synthesizePaschalCommonNonaChapter(
  index: TextIndex,
  candidatePaths: readonly string[],
  sectionName: string
): ResolvedSection | undefined {
  const source = firstSection(index, candidatePaths, 'Lectio Prima');
  if (!source) {
    return undefined;
  }

  return Object.freeze({
    language: source.language,
    path: source.path,
    section: {
      header: sectionName,
      condition: undefined,
      startLine: source.section.startLine,
      endLine: source.section.endLine,
      content: []
    },
    content: Object.freeze([
      ...source.section.content,
      { type: 'formulaRef', name: 'Deo gratias' }
    ] satisfies TextContent[]),
    selectorUnhandled: false,
    selectorMissing: false
  });
}

function firstSection(
  index: TextIndex,
  candidatePaths: readonly string[],
  sectionName: string
): { readonly language: string; readonly path: string; readonly section: ParsedSection } | undefined {
  for (const path of candidatePaths) {
    const section = resolveSectionByName(index, path, sectionName);
    if (section) {
      const language = path.match(/^horas\/([^/]+)\//u)?.[1] ?? 'Latin';
      return {
        language,
        path: ensureTxtSuffix(path),
        section
      };
    }
  }
  return undefined;
}

function stripAlleluiaTail(value: string): string {
  return value.replace(/,?\s*allel(?:u|ú)(?:ia|ja)(?:,?\s*allel(?:u|ú)(?:ia|ja))*\.?\s*$/iu, '').trimEnd();
}

function hasAlleluiaTail(value: string): boolean {
  return /allel(?:u|ú)(?:ia|ja)(?:,?\s*allel(?:u|ú)(?:ia|ja))*\.?\s*$/iu.test(value.trim());
}

function isPaschalSeason(season: ResolveOptions['season']): boolean {
  return season === 'eastertide' || season === 'ascensiontide';
}

function firstResponsoryResponse(
  content: readonly TextContent[] | undefined
): Extract<TextContent, { type: 'verseMarker' }> | undefined {
  return firstVerseMarker(content, /^r\.?\s*br\.?$/iu);
}

function firstTextContent(content: readonly TextContent[] | undefined): string | undefined {
  const node = firstTextLike(content);
  if (!node) {
    return undefined;
  }
  return node.type === 'text' ? node.value : node.text;
}

function firstVerseMarker(
  content: readonly TextContent[] | undefined,
  marker: RegExp
): Extract<TextContent, { type: 'verseMarker' }> | undefined {
  for (const node of content ?? []) {
    if (node.type === 'verseMarker' && marker.test(node.marker.trim())) {
      return node;
    }
    if (node.type === 'conditional') {
      const nested = firstVerseMarker(node.content, marker);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function firstTextLike(
  content: readonly TextContent[] | undefined
): Extract<TextContent, { type: 'text' | 'verseMarker' }> | undefined {
  for (const node of content ?? []) {
    if (node.type === 'text' || node.type === 'verseMarker') {
      return node;
    }
    if (node.type === 'conditional') {
      const nested = firstTextLike(node.content);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function normalizeStarredShortResponsoryBase(value: string): string {
  const withoutAlleluia = stripAlleluiaTail(value).replace(/\s+/gu, ' ').trim();
  const match = /^(?<left>.*?)(?<comma>,?)\s*\*\s*(?<right>.+?)\.?$/u.exec(withoutAlleluia);
  if (!match?.groups) {
    return withoutAlleluia.replace(/\.?$/u, '');
  }

  const rawLeft = (match.groups.left ?? '').trim();
  const hasSourceComma = Boolean(match.groups.comma) || rawLeft.endsWith(',');
  const left = rawLeft.replace(/[,.]?$/u, '');
  const right = lowerInitial((match.groups.right ?? '').trim().replace(/\.?$/u, ''));
  return `${left}${hasSourceComma ? ', ' : ' '}${right}`;
}

function lowerInitial(value: string): string {
  const first = value[0];
  if (!first) {
    return value;
  }
  return `${first.toLocaleLowerCase()}${value.slice(1)}`;
}

function buildPaschalShortResponsorySection(args: {
  readonly source: { readonly language: string; readonly path: string; readonly section: ParsedSection };
  readonly header: string;
  readonly responseBase: string;
  readonly language: string;
  readonly versicle?: string;
}): ResolvedSection {
  const alleluia = alleluiaWords(args.language);
  const response = `${args.responseBase.replace(/\.?$/u, '')}, * ${alleluia.capitalized}, ${alleluia.lowercase}.`;
  const content: TextContent[] = [];
  if (args.header === 'Responsory Completorium') content.push({ type: 'separator' });
  content.push({ type: 'verseMarker', marker: 'R.br.', text: response }, { type: 'verseMarker', marker: 'R.', text: response });
  if (args.versicle) content.push({ type: 'verseMarker', marker: 'V.', text: stripAlleluiaTail(args.versicle).replace(/\.?$/u, '.') });
  content.push(
    { type: 'verseMarker', marker: 'R.', text: `${alleluia.capitalized}, ${alleluia.lowercase}.` },
    { type: 'macroRef', name: 'Gloria1' },
    { type: 'verseMarker', marker: 'R.', text: response }
  );
  if (args.header === 'Responsory Completorium') content.push({ type: 'separator' });

  return Object.freeze({
    language: args.source.language,
    path: args.source.path,
    section: {
      header: args.header,
      condition: undefined,
      startLine: args.source.section.startLine,
      endLine: args.source.section.endLine,
      content: []
    },
    content: Object.freeze(content),
    selectorUnhandled: false,
    selectorMissing: false
  });
}

function alleluiaWords(language: string): { readonly capitalized: string; readonly lowercase: string } {
  return language === 'English'
    ? { capitalized: 'Alleluia', lowercase: 'alleluia' }
    : { capitalized: 'Allelúia', lowercase: 'allelúia' };
}

function resolveLocalizedSourceFallback(
  index: TextIndex,
  fallback: ResolvedSection,
  requestedLanguage: string,
  fallbackLanguage: string,
  options: Pick<
    ResolveOptions,
    'langfb' | 'dayOfWeek' | 'date' | 'season' | 'version' | 'modernStyleMonthday' | 'onWarning'
  >,
  sourceFallbackDepth: number
): ResolvedSection | undefined {
  if (sourceFallbackDepth >= 4) {
    return undefined;
  }

  const sources = collectContentSources(fallback.content);
  if (sources.length === 0) {
    return undefined;
  }

  const content: TextContent[] = [];
  let localizedPath: string | undefined;
  let localizedSection: ParsedSection | undefined;
  for (const source of sources) {
    if (sameSource(source, { path: fallback.path, section: fallback.section.header })) {
      return undefined;
    }

    const localized = resolveForLanguage(
      index,
      { path: source.path, section: source.section },
      requestedLanguage,
      options,
      sourceFallbackDepth + 1
    );
    if (!localized || localized.language === fallbackLanguage) {
      return undefined;
    }

    localizedPath ??= localized.path;
    localizedSection ??= localized.section;
    content.push(
      ...(
        projectLocalizedSourceContent({
          index,
          source,
          fallbackContent: fallback.content,
          fallbackLanguage,
          localizedContent: localized.content
        }) ?? localized.content
      )
    );
  }

  if (!localizedPath || !localizedSection || content.length === 0) {
    return undefined;
  }

  return Object.freeze({
    language: requestedLanguage,
    path: localizedPath,
    section: localizedSection,
    content: Object.freeze(content),
    selectorUnhandled: false,
    selectorMissing: false
  });
}

function projectLocalizedSourceContent(args: {
  readonly index: TextIndex;
  readonly source: TextSource;
  readonly fallbackContent: readonly TextContent[];
  readonly fallbackLanguage: string;
  readonly localizedContent: readonly TextContent[];
}): readonly TextContent[] | undefined {
  const fallbackSourcePath = swapLanguageSegment(args.source.path, args.fallbackLanguage);
  const fallbackSourceSection = resolveSectionByName(
    args.index,
    fallbackSourcePath,
    args.source.section
  );
  if (!fallbackSourceSection) {
    return undefined;
  }

  const projectedFallback = args.fallbackContent.filter((node) =>
    nodeBelongsToSource(node, args.source)
  );
  if (projectedFallback.length === 0) {
    return undefined;
  }

  const range = findContiguousContentRange(fallbackSourceSection.content, projectedFallback);
  if (!range || args.localizedContent.length < range.end) {
    return undefined;
  }

  return Object.freeze(args.localizedContent.slice(range.start, range.end));
}

function nodeBelongsToSource(node: TextContent, source: TextSource): boolean {
  if (node.source && sameSource(node.source, source)) {
    return true;
  }
  if (node.type !== 'conditional') {
    return false;
  }
  return node.content.some((child) => nodeBelongsToSource(child, source));
}

function findContiguousContentRange(
  sourceContent: readonly TextContent[],
  projectedContent: readonly TextContent[]
): { readonly start: number; readonly end: number } | undefined {
  if (projectedContent.length > sourceContent.length) {
    return undefined;
  }

  for (let start = 0; start <= sourceContent.length - projectedContent.length; start += 1) {
    const end = start + projectedContent.length;
    const matches = projectedContent.every((node, offset) =>
      contentNodesEquivalent(sourceContent[start + offset]!, node)
    );
    if (matches) {
      return { start, end };
    }
  }

  return undefined;
}

function contentNodesEquivalent(left: TextContent, right: TextContent): boolean {
  const leftComparable = contentNodeComparable(left);
  const rightComparable = contentNodeComparable(right);
  return JSON.stringify(leftComparable) === JSON.stringify(rightComparable);
}

function contentNodeComparable(node: TextContent): unknown {
  if (node.type === 'conditional') {
    return {
      type: node.type,
      condition: node.condition,
      content: node.content.map((child) => contentNodeComparable(child))
    };
  }

  const { source: _source, ...comparable } = node;
  return comparable;
}

function collectContentSources(content: readonly TextContent[]): readonly TextSource[] {
  const sources: TextSource[] = [];
  const seen = new Set<string>();
  for (const node of content) {
    collectNodeSources(node, sources, seen);
  }
  return sources;
}

function collectNodeSources(
  node: TextContent,
  sources: TextSource[],
  seen: Set<string>
): void {
  const source = node.source;
  if (source) {
    const key = sourceKey(source);
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(source);
    }
  }

  if (node.type === 'conditional') {
    for (const child of node.content) {
      collectNodeSources(child, sources, seen);
    }
  }
}

function sameSource(left: TextSource, right: TextSource): boolean {
  return sourceKey(left) === sourceKey(right);
}

function sourceKey(source: TextSource): string {
  return `${ensureTxtSuffix(source.path)}#${source.section}`.toLowerCase();
}

function resolveSectionByName(
  index: TextIndex,
  path: string,
  sectionName: string
): ParsedSection | undefined {
  const normalizedPath = ensureTxtSuffix(path);
  for (const candidate of sectionNameCandidates(sectionName)) {
    const direct = index.getSection(normalizedPath, candidate);
    if (direct) {
      return direct;
    }
  }

  const file = index.getFile(normalizedPath);
  if (!file) {
    return undefined;
  }

  const preamble = file.sections.find((section) => section.header === '__preamble');
  if (!preamble) {
    return undefined;
  }

  for (const candidate of sectionNameCandidates(sectionName)) {
    const headingContent = extractHeadingSection(preamble, candidate);
    if (headingContent) {
      return {
        header: candidate,
        condition: undefined,
        content: [...headingContent],
        startLine: preamble.startLine,
        endLine: preamble.endLine
      };
    }
  }

  return undefined;
}

function sectionNameCandidates(sectionName: string): readonly string[] {
  const trimmed = sectionName.trim();
  const withoutTrailingUnderscore = trimmed.replace(/_+$/u, '');
  const capitalized =
    withoutTrailingUnderscore.length > 0
      ? `${withoutTrailingUnderscore[0]!.toUpperCase()}${withoutTrailingUnderscore.slice(1)}`
      : withoutTrailingUnderscore;
  const canUseUnderscoreAliases = /^(?:[A-Z0-9]|.*_$)/u.test(trimmed);
  const candidates = [
    sectionName,
    trimmed,
    withoutTrailingUnderscore,
    capitalized
  ];
  if (canUseUnderscoreAliases) {
    candidates.push(`${withoutTrailingUnderscore}_`, `${capitalized}_`);
  }
  return Array.from(new Set(candidates.filter((value) => value.length > 0)));
}

function extractHeadingSection(
  preamble: ParsedSection,
  sectionName: string
): readonly TextContent[] | undefined {
  const wanted = normalizeHeading(sectionName);
  return extractSyntheticHeadingSections(preamble.content).find(
    (section) => normalizeHeading(section.header) === wanted
  )?.content;
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

interface SelectorContext {
  readonly language: string;
  readonly path: string;
  readonly section: ParsedSection;
  readonly selector?: string;
  readonly langfb?: string;
  readonly dayOfWeek?: number;
  readonly date?: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
  };
  readonly season?: ConditionEvalContext['season'];
  readonly version?: ConditionEvalContext['version'];
  readonly modernStyleMonthday?: boolean;
  readonly onWarning?: (warning: ComposeWarning) => void;
}

const INVITATORIUM_SUFFIX = '/Psalterium/Invitatorium';
const PSALMI_MINOR_SUFFIX = '/Psalterium/Psalmi/Psalmi minor';
const PSALMORUM_SEGMENT = '/Psalterium/Psalmorum/Psalm';

function applySelector(
  index: TextIndex,
  context: SelectorContext
): ResolvedSection {
  const { language, path, section, selector } = context;
  if (!selector) {
    return Object.freeze({
      language,
      path,
      section,
      content: section.content,
      selectorUnhandled: false,
      selectorMissing: false
    });
  }

  if (selector === 'missing') {
    return Object.freeze({
      language,
      path,
      section,
      content: section.content,
      selectorUnhandled: true,
      selectorMissing: true
    });
  }

  const structured = resolveStructuredSelector(index, context);
  if (structured) {
    return Object.freeze({
      language,
      path,
      section,
      content: structured,
      selectorUnhandled: false,
      selectorMissing: false
    });
  }

  const integerIndex = parseIntegerSelector(selector);
  if (integerIndex !== undefined) {
    const conditionContext = selectorConditionContext(context);
    return Object.freeze({
      language,
      path,
      section,
      content:
        conditionContext
          ? selectNthVisibleContentNode(section.content, integerIndex, conditionContext)
          : selectNthContentNode(section.content, integerIndex),
      selectorUnhandled: false,
      selectorMissing: false
    });
  }

  const integerRange = parseIntegerRangeSelector(selector);
  if (integerRange) {
    const conditionContext = selectorConditionContext(context);
    return Object.freeze({
      language,
      path,
      section,
      content:
        conditionContext
          ? selectVisibleContentNodeRange(section.content, integerRange.start, integerRange.end, conditionContext)
          : selectContentNodeRange(section.content, integerRange.start, integerRange.end),
      selectorUnhandled: false,
      selectorMissing: false
    });
  }

  if (context.onWarning) {
    context.onWarning({
      code: 'resolve-unhandled-selector',
      message: `Selector '${selector}' has no resolver narrowing — returning the full section.`,
      severity: 'info',
      context: {
        path,
        section: section.header,
        language,
        selector
      }
    });
  }
  return Object.freeze({
    language,
    path,
    section,
    content: section.content,
    selectorUnhandled: true,
    selectorMissing: false
  });
}

function parseIntegerSelector(selector: string): number | undefined {
  const trimmed = selector.trim();
  if (!/^[0-9]+$/u.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 ? value : undefined;
}

function parseIntegerRangeSelector(
  selector: string
): { readonly start: number; readonly end: number } | undefined {
  const match = /^\s*([0-9]+)\s*-\s*([0-9]+)\s*$/u.exec(selector);
  if (!match) return undefined;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start <= 0 || end < start) return undefined;
  return { start, end };
}

function selectNthContentNode(
  content: readonly TextContent[],
  index: number
): readonly TextContent[] {
  if (content.every((node) => node.type === 'conditional')) {
    const narrowed: TextContent[] = [];
    for (const node of content) {
      const selectedChildren = selectNthContentNode(node.content, index);
      if (selectedChildren.length === 0) {
        continue;
      }
      narrowed.push({
        ...node,
        content: [...selectedChildren]
      });
    }
    return Object.freeze(narrowed);
  }

  const pick = content[index - 1];
  return pick ? Object.freeze([pick]) : Object.freeze([]);
}

function selectContentNodeRange(
  content: readonly TextContent[],
  start: number,
  end: number
): readonly TextContent[] {
  if (content.every((node) => node.type === 'conditional')) {
    const narrowed: TextContent[] = [];
    for (const node of content) {
      const selectedChildren = selectContentNodeRange(node.content, start, end);
      if (selectedChildren.length === 0) {
        continue;
      }
      narrowed.push({
        ...node,
        content: [...selectedChildren]
      });
    }
    return Object.freeze(narrowed);
  }

  return Object.freeze(content.slice(start - 1, end));
}

function selectorConditionContext(
  context: SelectorContext
): ConditionEvalContext | undefined {
  if (!context.date || context.dayOfWeek === undefined || !context.season || !context.version) {
    return undefined;
  }

  return {
    date: context.date,
    dayOfWeek: context.dayOfWeek,
    season: context.season,
    version: context.version
  };
}

function selectNthVisibleContentNode(
  content: readonly TextContent[],
  index: number,
  context: ConditionEvalContext
): readonly TextContent[] {
  const flattened = flattenVisibleContent(content, context);
  const pick = flattened[index - 1];
  return pick ? Object.freeze([pick]) : Object.freeze([]);
}

function selectVisibleContentNodeRange(
  content: readonly TextContent[],
  start: number,
  end: number,
  context: ConditionEvalContext
): readonly TextContent[] {
  return Object.freeze(flattenVisibleContent(content, context).slice(start - 1, end));
}

function flattenVisibleContent(
  content: readonly TextContent[],
  context: ConditionEvalContext
): readonly TextContent[] {
  const out: TextContent[] = [];
  let lastProducedRange: { readonly start: number; readonly end: number } | undefined;

  for (const node of content) {
    const start = out.length;

    if (node.type !== 'conditional') {
      out.push(node);
      lastProducedRange = { start, end: out.length };
      continue;
    }

    if (!conditionMatches(node.condition, context)) {
      lastProducedRange = undefined;
      continue;
    }

    const visibleChildren = flattenVisibleContent(node.content, context);
    if (node.condition.stopword === 'sed' && visibleChildren.length > 0) {
      if (lastProducedRange) {
        out.splice(lastProducedRange.start, lastProducedRange.end - lastProducedRange.start);
      }
      const sedStart = out.length;
      out.push(...visibleChildren);
      lastProducedRange = { start: sedStart, end: out.length };
      continue;
    }

    out.push(...visibleChildren);
    lastProducedRange =
      visibleChildren.length > 0 ? { start, end: out.length } : undefined;
  }

  return Object.freeze(out);
}

function resolveStructuredSelector(
  index: TextIndex,
  context: SelectorContext
): readonly TextContent[] | undefined {
  const selector = context.selector?.trim();
  if (!selector) {
    return undefined;
  }

  const antiphonSelector = parseAntiphonSelector(selector);
  if (
    antiphonSelector &&
    context.path.endsWith(PSALMI_MINOR_SUFFIX) &&
    isPsalmiMinorAntiphonSection(context.section.header)
  ) {
    return resolvePsalmiMinorAntiphon(index, context.path, context.section, antiphonSelector);
  }

  if (
    context.path.includes(PSALMORUM_SEGMENT) &&
    context.section.header === '__preamble'
  ) {
    const expanded = expandPsalmTokenList(index, context.language, context.langfb, selector);
    if (expanded.length > 0) {
      return expanded;
    }
  }

  if (
    context.path.endsWith(PSALMI_MINOR_SUFFIX) &&
    isKeyedPsalterSection(context.section.header) &&
    isWeekdayKey(selector)
  ) {
    return resolveMinorHourPsalmody(index, context.language, context.langfb, context.section, selector);
  }

  if (
    context.path.endsWith(INVITATORIUM_SUFFIX) &&
    context.section.header === '__preamble' &&
    context.dayOfWeek !== undefined
  ) {
    return resolveSeasonalInvitatorium(
      index,
      context.language,
      context.langfb,
      context.section,
      selector,
      context.dayOfWeek,
      context.date,
      context.modernStyleMonthday
    );
  }

  return undefined;
}

function isPsalmiMinorAntiphonSection(sectionName: string): boolean {
  return (
    sectionName === 'Tridentinum' ||
    sectionName === 'Quad' ||
    sectionName === 'Quad5_' ||
    isKeyedPsalterSection(sectionName)
  );
}

function parseAntiphonSelector(selector: string): string | undefined {
  const match = selector.match(/^(.*)#antiphon$/u);
  const key = match?.[1]?.trim();
  return key && key.length > 0 ? key : undefined;
}

function resolvePsalmiMinorAntiphon(
  index: TextIndex,
  path: string,
  section: ParsedSection,
  wantedKey: string
): readonly TextContent[] | undefined {
  const dominical =
    section.header === 'Tridentinum'
      ? resolveDominicalTridentinumAntiphon(index, path, wantedKey)
      : undefined;
  const keyed = dominical ?? selectKeyedTextContent(section.content, wantedKey);
  const firstText = firstTextValue(keyed);
  if (firstText === undefined) {
    return undefined;
  }
  const antiphon = section.header === 'Tridentinum'
    ? firstText.split(';;', 1)[0]?.trim()
    : firstText.trim();
  if (!antiphon || antiphon === '_') {
    return undefined;
  }
  return Object.freeze([{ type: 'text', value: antiphon }]);
}

function firstTextValue(content: readonly TextContent[] | undefined): string | undefined {
  if (!content) {
    return undefined;
  }

  for (const node of content) {
    if (node.type === 'text') {
      return node.value;
    }
    if (node.type === 'conditional') {
      const nested = firstTextValue(node.content);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
}

function resolveDominicalTridentinumAntiphon(
  index: TextIndex,
  path: string,
  wantedKey: string
): readonly TextContent[] | undefined {
  const match = wantedKey.match(/^(Prima|Tertia|Sexta|Nona)\s+(Dominica(?:\s+SQP)?)$/u);
  if (!match) {
    return undefined;
  }

  const sectionHeader = match[1];
  const matchedKey = match[2];
  const keyedHeader = matchedKey?.startsWith('Dominica') ? 'Dominica' : matchedKey;
  if (!sectionHeader || !keyedHeader) {
    return undefined;
  }

  const file = index.getFile(ensureTxtSuffix(path));
  const psalterSection = file?.sections.find((candidate) => candidate.header === sectionHeader);
  if (!psalterSection) {
    return undefined;
  }

  return selectKeyedTextContent(psalterSection.content, keyedHeader);
}
