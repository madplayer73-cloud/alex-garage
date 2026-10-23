import test from 'node:test';
import assert from 'node:assert/strict';
import {emojiOptions,suggestEmoji} from '../src/emoji.ts';
import {symbolLocation,symbol} from '../src/symbols.ts';

test('every suggested or manually offered icon has a real image',()=>{
 const locations=new Set();
 for(const emoji of emojiOptions){
  const loc=symbolLocation(emoji);
  assert.equal(loc.known,true,emoji);
  assert.ok(loc.sheet>=0 && loc.sheet<4);
  assert.ok(loc.index>=0 && loc.index<16);
  locations.add(`${loc.sheet}:${loc.index}`);
 }
 assert.equal(locations.size,emojiOptions.length);
});
test('PS5, work and coding variants select real supported images',()=>{
 for(const text of ['PS5','ps4','Zahrať si PS5','PlayStation','Xbox','Nintendo']){
  assert.equal(suggestEmoji(text),'🎮',text);
  assert.equal(symbolLocation(suggestEmoji(text)).sheet,3);
 }
 for(const text of ['Pracovat','Pracovať','Codovat','Codovať','Kódovať','programovať']){
  assert.equal(suggestEmoji(text),'💻',text);
  assert.equal(symbolLocation(suggestEmoji(text)).sheet,3);
 }
});
test('unknown labels retain neutral fallback; markup is escaped',()=>{
 assert.deepEqual(symbolLocation('neznáme'),{sheet:0,index:15,known:false});
 assert.ok(!symbol('<script>').includes('<script>'));
});
