'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'dv360_check.html'), 'utf8');

function position(id) {
  const index = html.indexOf(`id="${id}"`);
  assert.notEqual(index, -1, `#${id} exists`);
  return index;
}

test('formal comparison result precedes stats and issue summary', () => {
  const orderedIds = [
    'dv-result-header',
    'dv-file-info-bar',
    'dv-legend-bar',
    'dv-row-height-bar',
    'level-tab-bar',
    'result-table-wrap',
    'stats-bar',
    'filter-bar',
    'result-issues',
    'result-summary',
  ];
  const positions = orderedIds.map(position);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('moved result containers retain unique ids', () => {
  for (const id of ['stats-bar', 'dv-result-header', 'result-table-wrap', 'level-tab-bar', 'result-issues']) {
    const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
    assert.equal(matches.length, 1, `#${id} appears once`);
  }
});
