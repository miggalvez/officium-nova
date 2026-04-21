import {
  PHASE3_UNADJUDICATED_THRESHOLD,
  loadPhase3LedgerSummaries,
  rowsToClearForThreshold
} from './phase-3-ledgers.mjs';

const summaries = loadPhase3LedgerSummaries().map((summary) => ({
  policy: summary.policy,
  unadjudicated: summary.adjudicationBreakdown.unadjudicated,
  rowsToClear: rowsToClearForThreshold(summary.adjudicationBreakdown.unadjudicated),
  perlBug: summary.adjudicationBreakdown.perlBug,
  renderingDifference: summary.adjudicationBreakdown.renderingDifference,
  engineBug: summary.adjudicationBreakdown.engineBug,
  bestPrefix: summary.bestMatchingPrefix,
  avgPrefix: summary.averageMatchingPrefix
}));

const totals = summaries.reduce(
  (acc, summary) => ({
    unadjudicated: acc.unadjudicated + summary.unadjudicated,
    rowsToClear: acc.rowsToClear + summary.rowsToClear,
    perlBug: acc.perlBug + summary.perlBug,
    renderingDifference: acc.renderingDifference + summary.renderingDifference,
    engineBug: acc.engineBug + summary.engineBug
  }),
  {
    unadjudicated: 0,
    rowsToClear: 0,
    perlBug: 0,
    renderingDifference: 0,
    engineBug: 0
  }
);

const policiesAtThreshold = summaries.filter((summary) => summary.rowsToClear === 0).length;
const rows = [
  ['Policy', 'Unadj', 'Rows To Clear', 'Perl Bug', 'Rendering', 'Engine Bug', 'Best Prefix', 'Avg Prefix'],
  ...summaries.map((summary) => [
    summary.policy,
    String(summary.unadjudicated),
    String(summary.rowsToClear),
    String(summary.perlBug),
    String(summary.renderingDifference),
    String(summary.engineBug),
    formatMetric(summary.bestPrefix),
    formatMetric(summary.avgPrefix)
  ]),
  [
    'Total',
    String(totals.unadjudicated),
    String(totals.rowsToClear),
    String(totals.perlBug),
    String(totals.renderingDifference),
    String(totals.engineBug),
    '-',
    '-'
  ]
];

console.log(`Phase 3 progress (sign-off requires <${PHASE3_UNADJUDICATED_THRESHOLD} unadjudicated per policy)`);
console.log('');
console.log(renderTable(rows));
console.log('');
console.log(`Policies already at threshold: ${policiesAtThreshold}/${summaries.length}`);

function renderTable(rows) {
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => row[index].length))
  );

  return [formatRow(rows[0], widths), separator(widths), ...rows.slice(1).map((row) => formatRow(row, widths))].join('\n');
}

function formatRow(row, widths) {
  return row
    .map((cell, index) => cell.padEnd(widths[index], ' '))
    .join('  ');
}

function separator(widths) {
  return widths.map((width) => '-'.repeat(width)).join('  ');
}

function formatMetric(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
