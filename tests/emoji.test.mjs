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

// --- New rules ---

test('drinks win over desserts in multi-word phrases', () => {
  assert.equal(suggestEmoji('Ísť na kávu a koláč'), '☕', 'kávu a koláč');
  assert.equal(suggestEmoji('koláč ku káve'), '☕', 'koláč ku káve');
  assert.equal(suggestEmoji('koláč'), '🍰', 'koláč alone');
  assert.equal(suggestEmoji('čaj a sušienky'), '🍵', 'čaj a sušienky');
});

test('grilling is recognized', () => {
  assert.equal(suggestEmoji('Grilovať'), '🔥');
  assert.equal(suggestEmoji('ísť na opekačku'), '🔥');
  assert.equal(suggestEmoji('BBQ párty'), '🔥');
});

test('chess is recognized and not confused with gaming', () => {
  assert.equal(suggestEmoji('Hrať šach'), '♟️');
  assert.equal(suggestEmoji('šachový turnaj'), '♟️');
  assert.equal(suggestEmoji('Zahrať si PS5'), '🎮', 'PS5 is still gaming');
});

test('table tennis / ping-pong is recognized separately from tennis', () => {
  assert.equal(suggestEmoji('stolný tenis'), '🏓');
  assert.equal(suggestEmoji('ping-pong'), '🏓');
  assert.equal(suggestEmoji('pingpong'), '🏓');
  assert.equal(suggestEmoji('tenis'), '🎾', 'plain tennis stays 🎾');
});

test('sweets are recognized', () => {
  assert.equal(suggestEmoji('Niečo sladké'), '🍬');
  assert.equal(suggestEmoji('bonbóny'), '🍬');
  assert.equal(suggestEmoji('čokoláda'), '🍫', 'chocolate stays specific');
});

test('romance / date is recognized', () => {
  assert.equal(suggestEmoji('Ísť na rande'), '❤️');
  assert.equal(suggestEmoji('randík'), '❤️');
});

test('theater is recognized', () => {
  assert.equal(suggestEmoji('Ísť do divadla'), '🎭');
  assert.equal(suggestEmoji('muzikál'), '🎭');
  assert.equal(suggestEmoji('opera'), '🎭');
});

test('car / driving is recognized', () => {
  assert.equal(suggestEmoji('Umyť auto'), '🚗');
  assert.equal(suggestEmoji('šoférovať'), '🚗');
  assert.equal(suggestEmoji('jazda autom'), '🚗');
});

test('phone call is recognized', () => {
  assert.equal(suggestEmoji('Zavolať mame'), '📱');
  assert.equal(suggestEmoji('telefonovať'), '📱');
});

test('doctor / hospital is recognized', () => {
  assert.equal(suggestEmoji('K lekárovi'), '🏥');
  assert.equal(suggestEmoji('ísť k zubárovi'), '🏥');
  assert.equal(suggestEmoji('nemocnica'), '🏥');
});

test('shoes are recognized', () => {
  assert.equal(suggestEmoji('Kúpiť topánky'), '👟');
  assert.equal(suggestEmoji('nové tenisky'), '👟');
});

test('restaurant maps to cooking/food icon', () => {
  assert.equal(suggestEmoji('večera v reštaurácii'), '🍳');
  assert.equal(suggestEmoji('Ísť do restiky'), '🍳');
});

test('seriál maps to film/movie icon', () => {
  assert.equal(suggestEmoji('pozerať seriál'), '🍿');
});

test('nič nerobiť maps to relaxation', () => {
  assert.equal(suggestEmoji('Nič nerobiť'), '🛋️');
});

test('automat does not falsely match auto rule', () => {
  assert.equal(suggestEmoji('automat'), '✨', 'automat is not a car');
});
