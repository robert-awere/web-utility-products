(function (root) {
  'use strict';

  const SQ_FT_PER_SQ_M = 10.7639104167;
  const FT_PER_M = 3.280839895;

  function calculateFlooring(values) {
    const { system = 'metric', length, width, waste = 10, packCoverage, pricePerArea = 0 } = values;
    const numbers = [length, width, waste, packCoverage, pricePerArea].map(Number);
    if (numbers.some(n => !Number.isFinite(n)) || numbers[0] <= 0 || numbers[1] <= 0 ||
        numbers[2] < 0 || numbers[2] > 100 || numbers[3] <= 0 || numbers[4] < 0) {
      throw new Error('Enter positive room and pack measurements. Waste must be between 0% and 100%.');
    }

    const [l, w, wastePercent, packArea, price] = numbers;
    const roomArea = l * w;
    const requiredArea = roomArea * (1 + wastePercent / 100);
    const packs = Math.ceil(requiredArea / packArea);
    const purchaseArea = packs * packArea;

    return {
      roomArea,
      requiredArea,
      packs,
      purchaseArea,
      cost: purchaseArea * price,
      areaUnit: system === 'imperial' ? 'ft²' : 'm²'
    };
  }

  function convertMeasurements(values, toSystem) {
    if (values.system === toSystem) return { ...values };
    const toImperial = toSystem === 'imperial';
    const distanceFactor = toImperial ? FT_PER_M : 1 / FT_PER_M;
    const areaFactor = toImperial ? SQ_FT_PER_SQ_M : 1 / SQ_FT_PER_SQ_M;
    return {
      ...values,
      system: toSystem,
      length: Number(values.length) * distanceFactor,
      width: Number(values.width) * distanceFactor,
      packCoverage: Number(values.packCoverage) * areaFactor,
      pricePerArea: Number(values.pricePerArea) / areaFactor
    };
  }

  const api = { calculateFlooring, convertMeasurements };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlooringCalculator = api;

  if (typeof module !== 'undefined' && require.main === module) {
    const assert = require('node:assert/strict');
    const metric = { system: 'metric', length: 4, width: 3, waste: 10, packCoverage: 2, pricePerArea: 25 };
    const result = calculateFlooring(metric);
    assert.ok(Math.abs(result.requiredArea - 13.2) < 1e-12);
    assert.equal(result.packs, 7);
    assert.equal(result.cost, 350);
    const converted = calculateFlooring(convertMeasurements(metric, 'imperial'));
    assert.ok(Math.abs(converted.requiredArea / SQ_FT_PER_SQ_M - result.requiredArea) < 0.001);
    assert.ok(Math.abs(converted.cost - result.cost) < 0.001);
    assert.throws(() => calculateFlooring({ ...metric, length: 0 }));
    console.log('Flooring calculator checks passed.');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
