(function (root) {
  'use strict';
  const METRES_PER_FOOT = 0.3048;
  const dimensions = ['height', 'rollWidth', 'rollLength', 'trim', 'repeat'];
  function systemFactor(system) {
    if (!['metric', 'imperial'].includes(system)) throw new Error('Choose metric or imperial units.');
    return system === 'imperial' ? METRES_PER_FOOT : 1;
  }
  function number(value, label) {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw new Error(`Enter a finite number for ${label}.`);
    }
    return Number(value);
  }
  // Remove only machine-roundoff at integer boundaries, not measurement uncertainty.
  function integerBoundary(value) {
    const nearest = Math.round(value);
    return Math.abs(value - nearest) <= 32 * Number.EPSILON * Math.max(1, Math.abs(value)) ? nearest : value;
  }
  function convertMeasurements(values, toSystem) {
    const factor = systemFactor(values.system) / systemFactor(toSystem);
    const convert = value => typeof value === 'string' && value.trim() === '' ? value : number(value, 'measurement') * factor;
    return { ...values, system: toSystem, walls: values.walls.map(convert),
      ...Object.fromEntries(dimensions.map(key => [key, convert(values[key])])) };
  }
  function calculateWallpaper(values) {
    const factor = systemFactor(values.system);
    if (!['free', 'straight'].includes(values.match)) throw new Error('Only free and straight match are supported; half-drop/offset match is excluded.');
    if (!Array.isArray(values.walls) || values.walls.length < 1 || values.walls.length > 20) throw new Error('Enter between 1 and 20 wall widths.');
    const measure = (value, label, zero = false) => {
      const n = number(value, label) * factor;
      if (n > 10000 || n < (zero ? 0 : 0.000001)) throw new Error(`${label} must be ${zero ? 'zero or positive' : 'positive'} (maximum 10,000 m equivalent).`);
      return n;
    };
    // Array.from also validates empty slots instead of silently skipping a wall.
    const walls = Array.from(values.walls, (v, i) => measure(v, `Wall ${i + 1} width`));
    const height = measure(values.height, 'Wall height');
    const rollWidth = measure(values.rollWidth, 'Roll width');
    const rollLength = measure(values.rollLength, 'Roll length');
    const trim = measure(values.trim, 'Total trim', true);
    const repeat = values.match === 'straight' ? measure(values.repeat, 'Pattern repeat') : 0;
    const rawDrop = height + trim;
    const cutLength = repeat ? Math.ceil(integerBoundary(rawDrop / repeat)) * repeat : rawDrop;
    // ponytail: reserve a full repeat at each roll start; no cutting-layout optimizer.
    const alignment = repeat;
    const dropsPerRoll = Math.floor(integerBoundary((rollLength - alignment) / cutLength));
    if (dropsPerRoll < 1) throw new Error('No full drop fits after trim, repeat rounding and roll-start allowance. Check the roll length or ask your installer.');
    const wallDrops = walls.map(width => Math.ceil(integerBoundary(width / rollWidth)));
    const drops = wallDrops.reduce((a, b) => a + b, 0);
    const rolls = Math.ceil(drops / dropsPerRoll);
    if (![drops, dropsPerRoll, rolls].every(n => Number.isSafeInteger(n) && n <= 1e9)) throw new Error('These dimensions produce too many drops. Check your units.');
    return { wallDrops, drops, dropsPerRoll, rolls, cutLength: cutLength / factor,
      alignment: alignment / factor, rawDrop: rawDrop / factor, unit: values.system === 'metric' ? 'm' : 'ft' };
  }
  const api = { calculateWallpaper, convertMeasurements, METRES_PER_FOOT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WallpaperCalculator = api;

  if (typeof module !== 'undefined' && require.main === module) {
    const assert = require('node:assert/strict');
    let cases = 0;
    const test = (name, run) => { run(); cases++; console.log(`PASS ${name}`); };
    const base = { system: 'metric', walls: [4, 3, 4, 3], height: 2.4, rollWidth: 0.52, rollLength: 10.05, trim: 0.1, repeat: 0.64, match: 'free' };
    const calc = patch => calculateWallpaper({ ...base, ...patch });
    test('free-match worked example', () => {
      const r = calc(); assert.deepEqual(r.wallDrops, [8, 6, 8, 6]);
      assert.equal(r.drops, 28); assert.equal(r.cutLength, 2.5); assert.equal(r.dropsPerRoll, 4); assert.equal(r.rolls, 7);
    });
    test('straight-match worked example', () => {
      const r = calc({ match: 'straight' }); assert.equal(r.cutLength, 2.56); assert.equal(r.alignment, 0.64);
      assert.equal(r.dropsPerRoll, 3); assert.equal(r.rolls, 10);
    });
    test('round each wall separately', () => assert.equal(calc({ walls: [0.6, 0.6], rollWidth: 0.5 }).drops, 4));
    test('partial drop never counts as a full drop', () => assert.equal(calc({ rollLength: 9.99 }).dropsPerRoll, 3));
    test('fresh-roll pattern alignment reserve changes yield', () => assert.equal(calc({ height: 2, trim: 0, repeat: 0.5, match: 'straight', rollLength: 8 }).dropsPerRoll, 3));
    test('width exact, below, above boundary', () => {
      for (const [width, expected] of [[1.04, 2], [1.04 - 1e-8, 2], [1.04 + 1e-8, 3]]) assert.equal(calc({ walls: [width] }).drops, expected);
    });
    test('repeat exact and just above boundary', () => {
      assert.equal(calc({ height: 2.56, trim: 0, match: 'straight' }).cutLength, 2.56);
      assert.equal(calc({ height: 2.56 + 1e-8, trim: 0, match: 'straight' }).cutLength, 3.2);
    });
    test('roll exact and just below boundary', () => {
      assert.equal(calc({ rollLength: 10 }).dropsPerRoll, 4);
      assert.equal(calc({ rollLength: 10 - 1e-8 }).dropsPerRoll, 3);
    });
    test('reject blank, non-finite, zero, negative and object dimensions', () => {
      for (const height of ['', ' ', null, false, {}, NaN, Infinity, -1, 0, 10001]) assert.throws(() => calc({ height }));
      for (const trim of ['', -1, Infinity]) assert.throws(() => calc({ trim }));
    });
    test('reject empty wall list, excess walls and bad wall width', () => {
      for (const walls of [[], Array(21).fill(1), [0], [''], [Infinity]]) assert.throws(() => calc({ walls }));
    });
    test('reject unsupported units and matching', () => {
      assert.throws(() => calc({ system: 'yards' })); assert.throws(() => calc({ match: 'half-drop' }));
      assert.throws(() => calc({ match: 'straight', repeat: 0 }));
    });
    test('reject impossible drop or alignment allowance', () => {
      assert.throws(() => calc({ rollLength: 2 }));
      assert.throws(() => calc({ rollLength: 3, repeat: 2, match: 'straight' }));
    });
    test('free match ignores inactive repeat', () => assert.equal(calc({ repeat: '' }).rolls, 7));
    test('metric/imperial invariance including rounding boundaries', () => {
      for (const match of ['free', 'straight']) for (const delta of [-1e-8, 0, 1e-8]) {
        const v = { ...base, match, walls: [1.04 + delta], height: 2.56 + delta, trim: 0, rollLength: 10.88 + delta };
        const a = calculateWallpaper(v), b = calculateWallpaper(convertMeasurements(v, 'imperial'));
        for (const key of ['drops', 'dropsPerRoll', 'rolls']) assert.equal(a[key], b[key]);
        assert.ok(Math.abs(a.cutLength - b.cutLength * METRES_PER_FOOT) < 1e-12);
      }
    });
    test('repeated conversions preserve purchase count and blank fields', () => {
      let v = { ...base }; for (let i = 0; i < 100; i++) v = convertMeasurements(convertMeasurements(v, 'imperial'), 'metric');
      assert.equal(calculateWallpaper(v).rolls, 7);
      assert.equal(convertMeasurements({ ...base, height: '' }, 'imperial').height, '');
    });
    test('sparse wall arrays cannot silently undercount', () => assert.throws(() => calc({ walls: Array(2) })));
    test('straight-match usable-roll boundary in both systems', () => {
      for (const [delta, expected] of [[-1e-8, 2], [0, 3], [1e-8, 3]]) {
        const v = { ...base, match: 'straight', rollLength: 8.32 + delta };
        assert.equal(calculateWallpaper(v).dropsPerRoll, expected);
        assert.equal(calculateWallpaper(convertMeasurements(v, 'imperial')).dropsPerRoll, expected);
      }
    });
    test('dimension range boundaries stay valid after conversion', () => {
      for (const width of [0.000001, 10000]) {
        const v = { ...base, walls: [width], rollWidth: 1 };
        assert.equal(calculateWallpaper(v).drops, calculateWallpaper(convertMeasurements(v, 'imperial')).drops);
      }
    });
    console.log(`Wallpaper calculator: ${cases} test groups passed.`);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
