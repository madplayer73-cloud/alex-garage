import assert from 'node:assert/strict';
import test from 'node:test';
import { newRound, spinRound, winningChoice, toggleHold, uniformIndex, MAX_SPINS } from '../src/round.ts';

// Exact enumeration: replay the real spinRound with every possible sequence of draws.
// A game uses at most 3 + 3 + 1 = 7 draws, so N**7 is a common denominator for all leaves.
const MAX_DRAWS = 7;
class NeedMore extends Error {}

function exactDistribution(N, mode, holdPolicy = () => null) {
  const wins = Array(N).fill(0n);
  const byAttempt = [0n, 0n, 0n, 0n];
  let total = 0n;
  const run = path => {
    let k = 0;
    const pick = n => { assert.equal(n, N); if (k >= path.length) throw new NeedMore(); return path[k++]; };
    let round = newRound(mode);
    while (!round.done) {
      round = spinRound(round, N, pick);
      if (!round.done && mode === 'hold') {
        const reel = holdPolicy(round);
        if (reel !== null) round = toggleHold(round, reel);
      }
    }
    return { round, used: k };
  };
  const walk = path => {
    try {
      const { round, used } = run(path);
      assert.equal(used, path.length, 'every draw of a leaf must be consumed');
      const weight = BigInt(N) ** BigInt(MAX_DRAWS - path.length);
      wins[winningChoice(round)] += weight; byAttempt[round.attempts] += weight; total += weight;
    } catch (e) {
      if (!(e instanceof NeedMore)) throw e;
      for (let v = 0; v < N; v++) walk([...path, v]);
    }
  };
  walk([]);
  assert.equal(total, BigInt(N) ** BigInt(MAX_DRAWS), 'probabilities must sum to exactly 1');
  return { wins, byAttempt, total };
}

for (const N of [2, 3, 4, 5]) {
  test(`pure chance, ${N} options: every verdict has EXACT probability 1/${N}`, () => {
    const { wins, total } = exactDistribution(N, 'chance');
    for (const w of wins) assert.equal(w * BigInt(N), total);
  });

  test(`pure chance, ${N} options: game length distribution matches theory`, () => {
    const { byAttempt, total } = exactDistribution(N, 'chance');
    const p1 = BigInt(N) ** 2n;                       // P(triple on spin 1) = N^-2
    assert.equal(byAttempt[1] * p1, total);
    assert.equal(byAttempt[2] * p1 * p1, total * (p1 - 1n)); // P(finish on 2) = (1-p)*p
    assert.equal(byAttempt[3] * p1 * p1, total * (p1 - 1n) ** 2n); // remainder is forced
    assert.equal(byAttempt[0], 0n);
    assert.ok(MAX_SPINS === 3);
  });
}

test('hold mode: a policy that ignores which option is shown stays symmetric (no option favoured)', () => {
  // Holds the first pair found, regardless of which option it is.
  const policy = r => { for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) if (a < b && r.reels[a] === r.reels[b]) return a; return null; };
  // toggleHold only holds one reel per call, so policy holds the first reel of the pair.
  const { wins, total } = exactDistribution(4, 'hold', policy);
  for (const w of wins) assert.equal(w * 4n, total);
});

test('hold mode: choosing to hold a favourite DOES skew the odds (documented, not pure chance)', () => {
  const N = 3;
  const favourite = r => (r.reels.includes(0) ? r.reels.indexOf(0) : null);
  const { wins, total } = exactDistribution(N, 'hold', favourite);
  assert.ok(wins[0] * 3n > total, 'favourite is more likely than 1/3');
  assert.ok(wins[1] * 3n < total && wins[2] * 3n < total);
});

test('uniformIndex: rejection sampling removes modulo bias (boundary values, stubbed generator)', () => {
  const original = crypto.getRandomValues;
  try {
    for (const n of [3, 5, 7]) { // 2**32 is not divisible by these, so a biased tail exists
      const limit = Math.floor(2 ** 32 / n) * n;
      const seq = [limit, 2 ** 32 - 1, limit - 1];   // first two must be rejected
      let calls = 0;
      crypto.getRandomValues = a => { a[0] = seq[calls++]; return a; };
      assert.equal(uniformIndex(n), (limit - 1) % n);
      assert.equal(calls, 3, 'the two out-of-range values must have been rejected');
    }
  } finally { crypto.getRandomValues = original; }
});

test('uniformIndex: real generator is uniform (chi-square, 500k draws per size)', () => {
  // Critical values for p = 1e-7 (false-failure chance negligible): df=1..4.
  const critical = { 2: 28.4, 3: 32.1, 4: 35.0, 5: 37.6 };
  for (const n of [2, 3, 4, 5]) {
    const draws = 500_000, counts = Array(n).fill(0);
    for (let i = 0; i < draws; i++) counts[uniformIndex(n)]++;
    const expected = draws / n;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    assert.ok(chi < critical[n], `n=${n} chi2=${chi.toFixed(2)} counts=${counts}`);
  }
});

test('end-to-end Monte Carlo of real spinRound in pure chance (300k games, 4 options)', () => {
  const N = 4, games = 300_000, wins = Array(N).fill(0), lens = [0, 0, 0, 0];
  for (let g = 0; g < games; g++) {
    let r = newRound('chance');
    while (!r.done) r = spinRound(r, N);
    wins[winningChoice(r)]++; lens[r.attempts]++;
  }
  const exp = games / N;
  const chi = wins.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  assert.ok(chi < 35.0, `chi2=${chi.toFixed(2)} wins=${wins}`);
  // P(finish on spin 1) = 1/16
  assert.ok(Math.abs(lens[1] / games - 1 / 16) < 0.004, `p1=${lens[1] / games}`);
});
