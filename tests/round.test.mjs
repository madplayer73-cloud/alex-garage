import assert from 'node:assert/strict';
import test from 'node:test';
import { newRound, spinRound, winningChoice, toggleHold, canHold, restoreRound } from '../src/round.ts';

function sequence(...values) {
  return () => {
    assert.ok(values.length, 'unexpected extra random draw');
    return values.shift();
  };
}

test('the first spin rolls independently and can finish without a winner', () => {
  const round = spinRound(newRound('hold'), 3, sequence(0, 1, 2));
  assert.deepEqual(round.reels, [0, 1, 2]);
  assert.equal(round.attempts, 1);
  assert.equal(round.done, false);
  assert.equal(winningChoice(round), null);
});

test('a natural triple ends the dilemma immediately and blocks another spin', () => {
  const round = spinRound(newRound('hold'), 3, sequence(2, 2, 2));
  assert.equal(winningChoice(round), 2);
  assert.equal(round.done, true);
  assert.throws(() => spinRound(round, 3), /verdikt/);
  assert.equal(canHold(round, 0), false);
});

test('held reels keep their exact choices and only other reels draw', () => {
  const first = spinRound(newRound('hold'), 3, sequence(1, 0, 1));
  const held = toggleHold(toggleHold(first, 0), 2);
  assert.deepEqual(first.held, [false, false, false], 'state is immutable');
  const second = spinRound(held, 3, sequence(2));
  assert.deepEqual(second.reels, [1, 2, 1]);
  assert.deepEqual(second.held, [true, false, true]);
  assert.equal(second.done, false);
});

test('holds can be released, and incompatible choices cannot be held together', () => {
  const round = toggleHold(spinRound(newRound('hold'), 3, sequence(0, 1, 2)), 0);
  assert.equal(canHold(round, 1), false);
  assert.deepEqual(toggleHold(round, 1), round);
  const released = toggleHold(round, 0);
  assert.equal(canHold(released, 1), true);
  assert.equal(canHold(newRound('hold'), 0), false);
});

test('the third spin completes the held choice without drawing a different winner', () => {
  const first = toggleHold(spinRound(newRound('hold'), 3, sequence(2, 0, 1)), 0);
  const second = spinRound(first, 3, sequence(0, 0));
  const final = spinRound(second, 3, () => { throw new Error('held winner should not need a draw'); });
  assert.deepEqual(final.reels, [2, 2, 2]);
  assert.equal(final.attempts, 3);
  assert.equal(final.done, true);
  assert.throws(() => spinRound(final, 3), /verdikt/);
});

test('without holds the third spin draws one final choice', () => {
  const first = spinRound(newRound('hold'), 3, sequence(0, 1, 2));
  const second = spinRound(first, 3, sequence(2, 0, 1));
  const final = spinRound(second, 3, sequence(1));
  assert.deepEqual(final.reels, [1, 1, 1]);
  assert.equal(final.done, true);
});

test('restoring a round preserves attempts, holds and final lock', () => {
  const first = toggleHold(spinRound(newRound('hold'), 3, sequence(0, 1, 2)), 1);
  assert.deepEqual(restoreRound(JSON.parse(JSON.stringify(first)), 3), first);
  const final = spinRound(spinRound(first, 3, sequence(0, 2)), 3);
  assert.deepEqual(restoreRound(final, 3), final);
  assert.equal(restoreRound(final, 3).done, true);
});

test('corrupt or incompatible saved rounds reset safely', () => {
  for (const value of [null, {}, { attempts: 4 },
    { attempts: 1, reels: [0, 1, 2], held: [true, true, false], done: false },
    { attempts: 3, reels: [0, 1, 2], held: [false, false, false], done: false },
    { attempts: 1, reels: [0, 8, 2], held: [false, false, false], done: false }]) {
    assert.deepEqual(restoreRound(value, 3), newRound());
  }
});

test('every first-spin combination can finish by the third spin for 2–5 choices', () => {
  for (let count = 2; count <= 5; count++) {
    for (let a = 0; a < count; a++) for (let b = 0; b < count; b++) for (let c = 0; c < count; c++) {
      const first = spinRound(newRound('hold'), count, sequence(a, b, c));
      if (first.done) continue;
      const second = spinRound(first, count, sequence(c, a, b));
      if (second.done) continue;
      for (let winner = 0; winner < count; winner++) {
        const final = spinRound(second, count, sequence(winner));
        assert.equal(final.done, true);
        assert.equal(final.attempts, 3);
        assert.equal(winningChoice(final), winner);
      }
    }
  }
});

test('pure chance is the default, holds are unavailable and injected holds are ignored', () => {
  const first=spinRound(newRound(),3,sequence(0,1,2));
  assert.equal(first.mode,'chance');
  assert.equal(canHold(first,0),false);
  assert.deepEqual(toggleHold(first,0),first);
  const second=spinRound({...first,held:[true,false,false]},3,sequence(2,1,0));
  assert.deepEqual(second.reels,[2,1,0]);
  assert.deepEqual(second.held,[false,false,false]);
  const final=spinRound(second,3,sequence(1));
  assert.deepEqual(final.reels,[1,1,1]);
  assert.equal(final.done,true);
});

test('restore preserves both modes and migrates legacy hold games without rerolling', () => {
  for(const mode of ['chance','hold']) {
    assert.deepEqual(restoreRound(newRound(mode),3),newRound(mode));
    const round=spinRound(newRound(mode),3,sequence(0,1,2));
    assert.deepEqual(restoreRound(round,3),round);
  }
  const legacy=toggleHold(spinRound(newRound('hold'),3,sequence(0,1,2)),0);
  delete legacy.mode;
  assert.deepEqual(restoreRound(legacy,3),{...legacy,mode:'hold'});
  assert.deepEqual(restoreRound({...legacy,mode:'chance'},3),newRound());
  assert.deepEqual(restoreRound({...legacy,mode:'invalid'},3),newRound());
});

test('every first/second outcome and final draw gives identical total winner weights', () => {
  // Exact integer counts, not a flaky random sampling test. Denominator N^7.
  for(let n=2;n<=5;n++) {
    const counts=Array(n).fill(0);
    for(let a=0;a<n;a++) for(let b=0;b<n;b++) for(let c=0;c<n;c++) {
      const first=spinRound(newRound(),n,sequence(a,b,c));
      if(first.done) { counts[winningChoice(first)]+=n**4; continue; }
      for(let d=0;d<n;d++) for(let e=0;e<n;e++) for(let f=0;f<n;f++) {
        const second=spinRound(first,n,sequence(d,e,f));
        if(second.done) { counts[winningChoice(second)]+=n; continue; }
        for(let g=0;g<n;g++) {
          const final=spinRound(second,n,sequence(g));
          counts[winningChoice(final)]++;
        }
      }
    }
    assert.deepEqual(counts,Array(n).fill(n**6));
  }
});

test('random sampling rejects the biased tail before using the remainder', () => {
  const original=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  const values=[4294967295,4,2,0];
  Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:a=>{a[0]=values.shift();return a;}});
  try {
    assert.deepEqual(spinRound(newRound(),3).reels,[1,2,0]);
    assert.equal(values.length,0);
  } finally {
    if(original) Object.defineProperty(crypto,'getRandomValues',original);
    else delete crypto.getRandomValues;
  }
});
