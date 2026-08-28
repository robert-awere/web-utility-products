(function (root) {
  'use strict';

  const SQ_FT_PER_SQ_M = 10.7639104167;
  const FT_PER_M = 3.280839895;
  const L_PER_GAL = 3.785411784;

  function calculatePaint(values) {
    const {
      system = 'metric', length, width, height, coats,
      doors = 0, windows = 0, includeCeiling = false,
      coverage, waste = 10
    } = values;

    const numbers = [length, width, height, coats, doors, windows, coverage, waste].map(Number);
    if (numbers.some(n => !Number.isFinite(n)) || numbers.slice(0, 4).some(n => n <= 0) ||
        numbers[4] < 0 || numbers[5] < 0 || numbers[6] <= 0 || numbers[7] < 0 || numbers[7] > 100) {
      throw new Error('Enter valid positive measurements. Waste must be between 0% and 100%.');
    }

    const [l, w, h, coatCount, doorCount, windowCount, rate, wastePercent] = numbers;
    const openingFactor = system === 'imperial' ? SQ_FT_PER_SQ_M : 1;
    const walls = 2 * (l + w) * h;
    const ceiling = includeCeiling ? l * w : 0;
    const openings = (doorCount * 1.9 + windowCount * 1.4) * openingFactor;
    const area = Math.max(0, walls + ceiling - openings);
    const amount = area * coatCount / rate * (1 + wastePercent / 100);
    const purchaseIncrement = system === 'imperial' ? 0.25 : 0.5;

    return {
      area,
      amount,
      buy: Math.ceil(amount / purchaseIncrement) * purchaseIncrement,
      perCoat: area / rate,
      unit: system === 'imperial' ? 'gal' : 'L',
      areaUnit: system === 'imperial' ? 'ft²' : 'm²'
    };
  }

  function convertMeasurements(values, toSystem) {
    if (values.system === toSystem) return { ...values };
    const toImperial = toSystem === 'imperial';
    const distanceFactor = toImperial ? FT_PER_M : 1 / FT_PER_M;
    const coverageFactor = toImperial ? SQ_FT_PER_SQ_M * L_PER_GAL : 1 / (SQ_FT_PER_SQ_M * L_PER_GAL);
    return {
      ...values,
      system: toSystem,
      length: Number(values.length) * distanceFactor,
      width: Number(values.width) * distanceFactor,
      height: Number(values.height) * distanceFactor,
      coverage: Number(values.coverage) * coverageFactor
    };
  }

  const api = { calculatePaint, convertMeasurements };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PaintCalculator = api;

  if (typeof module !== 'undefined' && require.main === module) {
    const assert = require('node:assert/strict');
    const metric = { system: 'metric', length: 4, width: 3, height: 2.4, coats: 2, doors: 1, windows: 1, coverage: 10, waste: 10 };
    const result = calculatePaint(metric);
    assert.ok(Math.abs(result.amount - 6.666) < 0.001);
    const converted = calculatePaint(convertMeasurements(metric, 'imperial'));
    assert.ok(Math.abs(converted.amount * L_PER_GAL - result.amount) < 0.001);
    assert.equal(result.buy, 7);
    console.log('Paint calculator checks passed.');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
