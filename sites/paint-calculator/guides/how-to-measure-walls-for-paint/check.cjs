// Run: node sites/paint-calculator/guides/how-to-measure-walls-for-paint/check.cjs
// Editorial regression checks use the real tool, not a second implementation.
const assert = require('node:assert/strict');
const {calculatePaint: calc, convertMeasurements: convert} = require('../../calculator.js');
const fs = require('node:fs');
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const base = {system:'metric', length:4, width:3, height:2.4, coats:2, doors:1, windows:1, coverage:10, waste:10};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const cases = [
  ['default walls', {}, 30.3, 6.666, 7],
  ['with ceiling', {includeCeiling:true}, 42.3, 9.306, 9.5],
  ['no openings', {doors:0, windows:0}, 33.6, 7.392, 7.5],
  ['one coat no waste', {coats:1, waste:0}, 30.3, 3.03, 3.5],
  ['exact increment', {length:2, width:3, height:2, doors:0, windows:0, waste:0}, 20, 4, 4],
  ['oversized deductions', {doors:100}, 0, 0, 0],
  ['imperial increment', {system:'imperial', length:10, width:10, height:8, doors:0, windows:0, coverage:400}, 320, 1.76, 2]
];
for (const [name, overrides, area, amount, buy] of cases) {
  const result = calc({...base,...overrides});
  close(result.area, area); close(result.amount, amount); close(result.buy, buy);
  console.log(`PASS ${name}: area=${result.area}, amount=${result.amount}, buy=${result.buy}`);
}
close(calc(base).perCoat, 3.03);
close(calc(convert(base,'imperial')).amount * 3.785411784, calc(base).amount);
close(2*(4+3)*2.4 - .9*2.1 - 1.5*1.2, 29.91);
close(4*3*2/10*1.1, 2.64);
close(10*10*2/400*1.1, .55);
close(8+6/12,8.5);
assert.throws(() => calc({...base,coverage:0}));
assert.throws(() => calc({...base,waste:101}));
for (const text of ['29.91 m²','6.666 L','6.67 L','Plan for 7 L','42.3 m²','9.306 L','9.31 L','9.5 L','2.64 L','0.55 US gallon','two decimal places']) assert.ok(html.includes(text), `Missing article result: ${text}`);
assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
for (const text of ['<h1>How to Measure Walls for Painting</h1>', 'how to measure walls for painting, start', 'How to Measure Walls for Painting: final checklist']) assert.ok(html.includes(text), `Missing reviewed heading phrase: ${text}`);
assert.ok(!html.includes('wallpaper-calculator'));
console.log('PASS conversion, manual examples, invalid inputs and article assertions.');
