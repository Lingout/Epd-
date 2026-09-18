import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = name => readFileSync(join(root, name), 'utf8');
const index = read('index.html');
const app = read('app.js');
const epd = read('epd14.js');
const language = read('epd14-language.js');
const grammar = read('epd14-grammar-followup.js');
const fixes = read('epd14-audit-fixes.js');
const seed = read('epd14-wortschatz-seed.js');

const allSource = [index, app, epd, language, grammar, fixes, seed].join('\n');

test('EPD scripts load in dependency-safe order', () => {
  const order = [
    'epd14-language.js',
    'app.js',
    'epd14-wortschatz-seed.js',
    'epd14.js',
    'epd14-grammar-followup.js',
    'epd14-audit-fixes.js',
  ].map(name => index.indexOf(name));
  assert.ok(order.every(position => position >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('all static desktop controls have application handlers', () => {
  for (const id of ['newEntryBtn', 'historyBtn', 'closeHistory', 'cancelDelete', 'confirmDelete', 'exportBtn', 'importInput']) {
    assert.match(app, new RegExp(`['\"]#${id}['\"]`));
  }
  for (const id of ['timerStart', 'timerPause', 'timerReset', 'timerApply']) {
    assert.match(epd, new RegExp(id));
  }
});

test('custom timer duration is applied automatically before Start', () => {
  assert.match(fixes, /#timerStart/);
  assert.match(fixes, /#timerMinutes/);
  assert.match(fixes, /#timerApply/);
  assert.match(fixes, /typed !== configured/);
  assert.match(fixes, /apply\.click\(\)/);
});

test('desktop Wortschatz controls are wired', () => {
  for (const id of [
    'newDeckBtn', 'saveDeck', 'showBulkImport', 'applyBulkImport', 'addTermRow',
    'flashBack', 'editCurrentDeck', 'openLearnMode', 'flashFullscreen',
    'unknownBtn', 'knownBtn', 'summaryBack', 'repeatAll', 'repeatUnknown',
    'learnSetupBack', 'startLearn', 'learnToCards', 'learnAgain'
  ]) {
    assert.match(epd, new RegExp(id));
  }
  assert.match(fixes, /data-open-deck/);
  assert.match(fixes, /event\.key !== 'Enter'/);
});

test('learning mode has German naming and DE/EN language support', () => {
  assert.match(language, /Deutsch ↔ Русский/);
  assert.match(language, /English ↔ Русский/);
  assert.match(language, /Lernmodus/);
  assert.match(fixes, /ZAUBIANIE/g);
  assert.match(fixes, /LERNMODUS/);
});

test('grammar reader controls, sticky toolbar and notebook pages are present', () => {
  assert.match(epd, /grammarAddInput/);
  assert.match(epd, /data-open-grammar/);
  assert.match(epd, /data-attach-grammar/);
  assert.match(epd, /data-grammar-mode/);
  assert.match(grammar, /epd14-fixed-grammar-toolbar/);
  assert.match(grammar, /data-grammar-page-prev/);
  assert.match(grammar, /data-grammar-page-next/);
  assert.match(grammar, /data-grammar-page-add/);
  assert.match(grammar, /data-grammar-page-delete/);
});

test('backup covers German, English, Wortschatz, timers and grammar-note localStorage', () => {
  assert.match(fixes, /epd-heft-/);
  assert.match(fixes, /epd14-/);
  assert.match(fixes, /epd14-backup-v2/);
  assert.match(fixes, /parsed\.entries && parsed\.ui/);
});

test('EPD source has no MOST/Supabase/portal integration', () => {
  assert.doesNotMatch(allSource, /most-austria/i);
  assert.doesNotMatch(allSource, /supabase/i);
  assert.doesNotMatch(allSource, /portal_(clients|crm|stage)|\/api\/portal/i);
});


test('German and English Wortschatz decks are isolated in the UI', () => {
  assert.match(language, /tileLang === lang/);
  assert.match(language, /epd14-lang-hidden/);
  assert.match(language, /No English vocabulary lists yet/);
  assert.match(language, /German lists stay only in the German section/);
  assert.match(language, /Vocabulary/);
});

test('Bedtime Procrastination decks are additive and do not replace existing decks', () => {
  for (const title of [
    'Bedtime Procrastination — Substantive',
    'Bedtime Procrastination — Verben',
    'Bedtime Procrastination — Adjektive & Konnektoren',
    'Bedtime Procrastination — Sätze & Strukturen',
  ]) assert.ok(seed.includes(title));
  assert.match(seed, /hadExistingWortschatz/);
  assert.ok(seed.includes("new Set(['seed-deck-13', 'seed-deck-14', 'seed-deck-15', 'seed-deck-16'])"));
  assert.match(seed, /data\.decks = currentDecks/);
  assert.doesNotMatch(seed, /data\.decks = decks;/);
});
