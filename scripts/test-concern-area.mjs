import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concernAreaFor, matchesConcernArea, productConcernArea, allowsConcernScore } from '../src/lib/concern-area.js';
import { quizAnswersToScoringProfile, resultProfileToQuizAnswers } from '../src/lib/quiz-profile.js';
import { SCORED_DATASET } from '../src/lib/scoring/dataset.js';
import { scoreAll } from '../src/lib/scoring/engine.js';
// Importing the existing safety rules initializes the database client, but these
// tests never query it. Use inert configuration so no local credentials are needed.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-only';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only';
process.env.ROOPSEE_NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.ROOPSEE_SUPABASE_SERVICE_KEY = 'test-only';
const { attachScores } = await import('../src/lib/scoring/catalog-scores.js');

test('shared body concerns retain their selected area through profile storage', () => {
  for (const concern of ['Dryness', 'Uneven skin', 'None', 'Dark spots']) {
    const profile = quizAnswersToScoringProfile({ skinType: 'Dry', concernArea: 'body', concerns: [concern] });
    assert.equal(profile.concernArea, 'body');
    assert.equal(resultProfileToQuizAnswers(profile).concernArea, 'body');
  }
  assert.equal(concernAreaFor({ selectedFaceBodyConcerns: ['Body Acne'] }), 'body');
  assert.equal(concernAreaFor({ selectedFaceBodyConcerns: ['Dryness'] }), 'face');
});

test('dual-use products are eligible for either area; opposite area is not', () => {
  assert.equal(matchesConcernArea({ category: 'Body' }, 'face'), false);
  assert.equal(matchesConcernArea({ category: 'Face' }, 'body'), false);
  assert.equal(matchesConcernArea({ category: 'Face & Body' }, 'face'), true);
  assert.equal(matchesConcernArea({ category: 'Face & Body' }, 'body'), true);
});

const dataset = SCORED_DATASET().products;
const subset = ['face', 'body', 'both'].map(area => dataset.find(p => productConcernArea(p) === area && p.urlKey));
const base = { skinType: 'Dry', concern: 'Dryness', age: 'Adult', specialConditions: ['None'] };

test('the screenshot body lotions cannot inherit Face scores from incorrect dual-use tags', () => {
  const names = ['hyaluronic moisturizing sunscreen body', 'vaseline sun protect spf 30 body', 'nivea aloe protection body'];
  for (const name of names) {
    const source = dataset.find(p => p.name.toLowerCase().includes(name) && p.category === 'Face & Body');
    assert.ok(source, name);
    const card = { product_name: source.name, category: 'Body Care', product_url: `https://${source.urlKey}` };
    assert.equal(allowsConcernScore(card, 'face'), false);
    assert.equal(attachScores([card], { ...base, concernArea: 'face' }, [card])[0].scoring, null);
    assert.ok(attachScores([card], { ...base, concernArea: 'body' }, [card])[0].scoring);
  }
});

test('explicit body use beats broad tags without mistaking The Body Shop for body use', () => {
  assert.equal(productConcernArea({ name: 'SPF 50 Body Lotion', category: 'Face & Body' }), 'body');
  assert.equal(productConcernArea({ product_name: 'Daily lotion', category: 'Body Care' }), 'body');
  assert.equal(productConcernArea({ name: 'The Body Shop Vitamin C Facial Cleanser', category: 'Face' }), 'face');
  assert.equal(productConcernArea({ name: 'Moisturising Cream for Face & Body', category: 'Face & Body' }), 'both');
});

test('actual scoring engine excludes opposite-area products for shared concerns', () => {
  for (const concern of ['Dryness', 'Uneven Skin Tone', 'None']) {
    for (const concernArea of ['face', 'body']) {
      const rows = scoreAll({ ...base, concern, concernArea }, subset);
      assert.equal(rows.length, 2);
      assert.ok(rows.every(row => matchesConcernArea(row.product, concernArea)));
    }
  }
  assert.deepEqual(scoreAll({ ...base, concernArea: 'body' }, [subset[0]]), []);
  assert.deepEqual(scoreAll(base, []), []);
});

test('catalogue and detail score attachments remain isolated after switching areas', () => {
  const rows = subset.map(p => ({ product_url: `https://${p.urlKey}`, restricted: [] }));
  for (const area of ['face', 'body', 'face']) {
    const scored = attachScores(rows, { ...base, concernArea: area }, rows);
    assert.equal(scored[area === 'body' ? 0 : 1].scoring, null);
    assert.ok(scored[area === 'body' ? 1 : 0].scoring);
    assert.ok(scored[2].scoring);
  }
});

test('safety overrides cannot add an opposite-area or unknown-product score', () => {
  const rows = [{ product_url: `https://${subset[1].urlKey}`, restricted: ['retinoid'] },
    { product_url: 'https://example.com/unknown', restricted: ['retinoid'] }];
  assert.ok(attachScores(rows, { ...base, concernArea: 'face', specialConditions: ['Pregnant'] }, rows)
    .every(row => row.scoring === null));
});
