import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreDilemmas,validateChoices,MAX_DILEMMAS} from '../src/dilemmas.ts';
const choices=[{label:'PS5',emoji:'🎮',manualEmoji:true},{label:'Kódovať',emoji:'💻'}];
test('restores saved dilemmas with independent sanitized copies',()=>{
 const input=[{id:'a',question:'Čo dnes?',choices}];
 const restored=restoreDilemmas(input);
 assert.equal(restored.length,1);assert.equal(restored[0].choices[0].manualEmoji,true);
 restored[0].choices[0].label='zmena';assert.equal(input[0].choices[0].label,'PS5');
});
test('rejects invalid saved content, duplicate IDs and oversized libraries',()=>{
 for(const v of [null,{},'bad',[],[{id:'a',question:'',choices}], [{id:'a',question:'q',choices:[{}]}]])assert.deepEqual(restoreDilemmas(v),[]);
 const good={id:'a',question:'Čo dnes?',choices};
 assert.equal(restoreDilemmas([good,good]).length,1);
 assert.equal(restoreDilemmas(Array.from({length:50},(_,i)=>({...good,id:String(i)}))).length,MAX_DILEMMAS);
 assert.equal(validateChoices([{label:'PS5',emoji:'🎮'},{label:'ps5',emoji:'🎮'}]),false);
 assert.equal(validateChoices([{label:' ',emoji:'🎮'},{label:'x',emoji:'🎮'}]),false);
});
