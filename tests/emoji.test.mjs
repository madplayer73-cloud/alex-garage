import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestEmoji } from '../src/emoji.ts';

test('recognizes Slovak dishes with accents, without accents and in phrases', () => {
  for (const [text, emoji] of [
    ['ŠPAGETY s paradajkovou omáčkou', '🍝'],
    ['cestoviny so syrom', '🍝'],
    ['palacinky s džemom', '🥞'],
    ['Kuracie kari s ryžou', '🍛'],
    ['kuracie prsia', '🍗'],
    ['zeleninový šalát', '🥗'],
    ['bryndzové halušky', '🥟'],
    ['smažený syr', '🧀'],
    ['hovädzí guláš', '🍲'],
    ['losos so zemiakmi', '🐟'],
    ['chcem varit doma', '🍳'],
  ]) assert.equal(suggestEmoji(text), emoji, text);
});

test('recognizes everyday activities and drinks', () => {
  for (const [text, emoji] of [
    ['Ísť si zacvičiť', '🏋️'], ['Dať si víno', '🍷'],
    ['Pozrieť si film', '🍿'], ['čítať knihu', '📚'],
    ['ísť behať', '🏃'], ['káva v meste', '☕'],
    ['zostať doma', '🛋️'], ['prechádzka', '🚶'],
  ]) assert.equal(suggestEmoji(text), emoji, text);
});

test('does not recognize unrelated word fragments as food or drink', () => {
  for (const text of ['vinoteka neznama', 'pivonka', 'arteterapia', 'Sobotný večer']) {
    assert.equal(suggestEmoji(text), '✨', text);
  }
});

test('unknown and empty choices use a neutral icon', () => {
  for (const text of ['', '   ', 'Moja vlastná neznáma možnosť']) assert.equal(suggestEmoji(text), '✨');
});

test('an explicit emoji wins and combined emoji sequences stay together', () => {
  assert.equal(suggestEmoji('🎉 pizza'), '🎉');
  assert.equal(suggestEmoji('👩‍🍳 variť'), '👩‍🍳');
  assert.equal(suggestEmoji('👍🏽 moja možnosť'), '👍🏽');
});
