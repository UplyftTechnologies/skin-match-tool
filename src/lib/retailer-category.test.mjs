import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalCategory } from './retailer-category.mjs';

const cases = [
  ['Hydrating Facial Oil', ['Serums & Oils'], 'Face Oil'],
  ['Nourishing Hydrating Oil', ['Serums'], 'Face Oil'],
  ['Daily Face Moisturizer', ['Serums & Essence'], 'Moisturizer'],
  ['Barrier Repair Cream', ['Serums'], 'Moisturizer'],
  ['Hydrating Gel Cream', ['Serums', 'Moisturizers'], 'Moisturizer'],
  ['Vitamin C Serum', ['Moisturizers'], 'Serum'],
  ['Oil-Free Hydrating Serum', ['Serums & Oils'], 'Serum'],
  ['Hydrating Essence', ['Skincare'], 'Serum'],
  ['Gentle Cleansing Oil', ['Serums & Oils'], 'Cleanser'],
  ['Repair Hair Serum', ['Serums'], 'Hair Care'],
  ['Under Eye Serum', ['Serums'], 'Eye Care'],
  ['Daily Body Lotion', ['Serums'], 'Body Care'],
  ['Daily Defense SPF 50', ['Sun Care'], 'Sunscreen'],
  ['Daily Moisturizer SPF 30', ['Moisturizers'], 'Moisturizer'],
  ['Daily Concentrate', ['Serums'], 'Serum'],
];

for (const [product_name, categories, expected] of cases) {
  test(`${product_name} is ${expected} despite retailer breadcrumbs`, () => {
    assert.equal(canonicalCategory({ product_name, categories }), expected);
  });
}

test('serum selection excludes oils and moisturizers with broad serum tags', () => {
  const names = cases
    .map(([product_name, categories]) => ({ product_name, categories }))
    .filter((row) => canonicalCategory(row) === 'Serum')
    .map((row) => row.product_name);
  assert.deepEqual(names, [
    'Vitamin C Serum', 'Oil-Free Hydrating Serum', 'Hydrating Essence', 'Daily Concentrate',
  ]);
});

test('SPF moisturizer keeps the category supplied by a sibling retailer', () => {
  assert.equal(canonicalCategory(
    { product_name: 'Moisture Surge SPF 25', categories: ['Personal Care'] },
    [{ categories: ['Moisturizers'] }],
  ), 'Moisturizer');
});
