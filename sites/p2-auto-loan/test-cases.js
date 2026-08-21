/* =============================================================================
   Spec test cases — /specs/p2-auto-loan.md
   Run:  node test-cases.js
   Dev tool only; index.html never loads this file.

   Two layers of verification:
   (a) the five spec cases, against the values documented in calculator.js;
   (b) an INDEPENDENT check of the payment formula — solve for the payment by
       bisection on the raw balance recursion  b <- b(1+r) - M  so that b lands
       on zero after n months, using no annuity formula at all. If the closed
       form and the numeric solution agree, the closed form is right.
   ============================================================================= */
var A = require('./calculator.js');
var pass = 0, fail = 0;

function money(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function check(label, actual, expected, tol) {
  tol = tol === undefined ? 0.005 : tol;
  var ok = Math.abs(actual - expected) <= tol;
  ok ? pass++ : fail++;
  console.log('   ' + (ok ? 'PASS' : 'FAIL') + '  ' + label +
    '  actual=' + actual.toFixed(2) + '  expected=' + expected.toFixed(2));
}
function sum(rows, key) { return rows.reduce(function (a, r) { return a + r[key]; }, 0); }

/* --- independent payment solver: bisection on the balance recursion --------- */
function solvePaymentNumerically(P, aprPct, n) {
  if (aprPct === 0) return P / n;
  var r = aprPct / 100 / 12, lo = 0, hi = P * 10;
  for (var i = 0; i < 400; i++) {
    var mid = (lo + hi) / 2, b = P;
    for (var m = 0; m < n; m++) b = b * (1 + r) - mid;
    if (b > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

console.log('\n=== CASE 1 — $30,000 financed, no sales tax, 6.00% APR, 60 months ===');
var c1 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 6, termMonths: 60, extraPayment: 0 });
check('monthly payment = $579.98 (spec / calculator.net)', c1.monthlyPayment, 579.98);
check('amount financed', c1.amountFinanced, 30000);
check('total interest', c1.totalInterest, 4799.09);
check('total of payments', c1.totalPaid, 34799.09);
check('exactly 60 payments', c1.rows.length, 60, 0);

console.log('\n=== CASE 2 — $30,000 financed, 0.00% APR, 60 months (r = 0 branch) ===');
var c2 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 0, termMonths: 60, extraPayment: 0 });
check('monthly payment is exactly $500.00', c2.monthlyPayment, 500, 0);
check('total interest is exactly zero', c2.totalInterest, 0, 0);
check('total of payments', c2.totalPaid, 30000, 0);

console.log('\n=== CASE 3 — $32,000 car, $4,000 trade-in, TX 6.25%, $2,000 down, 6.90%, 60 mo ===');
var c3 = A.calculate({ vehiclePrice: 32000, downPayment: 2000, tradeInValue: 4000, tradeInPayoff: 0,
  fees: 0, state: 'TX', overrideRatePct: '', apr: 6.9, termMonths: 60, extraPayment: 0 });
check('TX taxes price MINUS trade-in', c3.salesTax.taxesTradeIn ? 1 : 0, 0, 0);
check('taxable = 32,000 - 4,000', c3.salesTax.taxable, 28000, 0);
check('sales tax = 28,000 x 6.25%', c3.salesTax.amount, 1750);
check('amount financed = 32,000 + 1,750 - 2,000 - 4,000', c3.amountFinanced, 27750);
check('monthly payment', c3.monthlyPayment, 548.17);
check('total interest', c3.totalInterest, 5140.53);

console.log('\n=== CASE 4 — negative equity: trade-in worth $5,000, $8,000 still owed ===');
var c4 = A.calculate({ vehiclePrice: 32000, downPayment: 0, tradeInValue: 5000, tradeInPayoff: 8000,
  fees: 0, state: 'TX', overrideRatePct: '', apr: 6.9, termMonths: 60, extraPayment: 0 });
check('negative equity detected', c4.negativeEquity, 3000, 0);
check('tax credit uses the full trade allowance', c4.salesTax.taxable, 27000, 0);
check('sales tax', c4.salesTax.amount, 1687.50);
check('amount financed = 32,000 + 1,687.50 - 5,000 + 8,000', c4.amountFinanced, 36687.50);
/* $3,000 of negative equity rolled in: the same deal with a clean (zero-equity)
   trade-in would finance $33,687.50, exactly $3,000 less. */
var clean = A.calculate({ vehiclePrice: 32000, downPayment: 0, tradeInValue: 5000, tradeInPayoff: 5000,
  fees: 0, state: 'TX', overrideRatePct: '', apr: 6.9, termMonths: 60, extraPayment: 0 });
check('exactly $3,000 more than a zero-equity trade-in', c4.amountFinanced - clean.amountFinanced, 3000, 0);
check('monthly payment', c4.monthlyPayment, 724.73);

console.log('\n=== CASE 5 — case 1 plus $100/month extra ===');
var c5 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 6, termMonths: 60, extraPayment: 100 });
check('scheduled payment unchanged', c5.monthlyPayment, 579.98);
check('paid off in month 50', c5.payoffMonths, 50, 0);
check('10 months early', c5.monthsSaved, 10, 0);
check('total interest drops', c5.totalInterest, 3978.21);
check('interest saved', c5.interestSaved, 820.88);
console.log('   INFO  ' + money(c1.totalInterest) + ' -> ' + money(c5.totalInterest) +
            ', saving ' + money(c5.interestSaved) + ' and 10 payments');
check('schedule reconciles: sum(principal) = amount financed', sum(c5.rows, 'principal'), c5.amountFinanced, 0.01);
check('schedule reconciles: sum(interest) = total interest', sum(c5.rows, 'interest'), c5.totalInterest, 0.01);
check('schedule reconciles: sum(payments) = total paid', sum(c5.rows, 'payment'), c5.totalPaid, 0.01);
check('final balance is zero', c5.rows[c5.rows.length - 1].balance, 0, 0.005);
check('case 1 schedule reconciles too', sum(c1.rows, 'principal'), c1.amountFinanced, 0.01);
check('case 1 interest reconciles', sum(c1.rows, 'interest'), c1.totalInterest, 0.01);

console.log('\n=== INDEPENDENT CHECK — closed form vs numeric solution of the recursion ===');
[[30000, 6, 60], [30000, 0, 60], [27750, 6.9, 60], [36687.50, 6.9, 60],
 [25000, 4.25, 72], [45000, 8.99, 84], [12000, 12.5, 36], [80000, 2.9, 96]
].forEach(function (t) {
  var closed = A.monthlyPayment(t[0], t[1], t[2]);
  var numeric = solvePaymentNumerically(t[0], t[1], t[2]);
  check('$' + t[0] + ' @ ' + t[1] + '% x ' + t[2] + 'mo', closed, numeric, 0.000001);
});

console.log('\n=== State tax rules ===');
function tax(o) { return A.calculate(Object.assign({ vehiclePrice: 0, downPayment: 0, tradeInValue: 0,
  tradeInPayoff: 0, fees: 0, overrideRatePct: '', apr: 5, termMonths: 60, extraPayment: 0 }, o)); }
check('CA taxes the full price (no trade-in credit)', tax({ vehiclePrice: 20000, tradeInValue: 6000, state: 'CA' }).salesTax.taxable, 20000, 0);
check('CA tax = 20,000 x 7.25%', tax({ vehiclePrice: 20000, tradeInValue: 6000, state: 'CA' }).salesTax.amount, 1450);
check('SC tax capped at $500', tax({ vehiclePrice: 60000, state: 'SC' }).salesTax.amount, 500, 0);
check('IL trade-in credit capped at $10,000', tax({ vehiclePrice: 50000, tradeInValue: 20000, state: 'IL' }).salesTax.taxable, 40000, 0);
check('OR charges no sales tax', tax({ vehiclePrice: 25000, state: 'OR' }).salesTax.amount, 0, 0);
check('MT charges no sales tax', tax({ vehiclePrice: 25000, state: 'MT' }).salesTax.amount, 0, 0);
check('manual rate override wins over the state', tax({ vehiclePrice: 20000, state: 'TX', overrideRatePct: 9 }).salesTax.amount, 1800);
check('51 jurisdictions (50 states + DC)', Object.keys(A.STATE_TAX_2026).length, 51, 0);

console.log('\n=== Edge cases ===');
var e1 = tax({ vehiclePrice: 25000, downPayment: 30000, state: '' });
check('down payment above the price cannot go negative', e1.amountFinanced, 0, 0);
check('...and is reported as not calculable', e1.valid ? 1 : 0, 0, 0);
var e2 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 6, termMonths: 60, extraPayment: 100000 });
check('an absurd extra payment closes the loan in month 1', e2.payoffMonths, 1, 0);
var e3 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 1200, state: 'TX', overrideRatePct: '', apr: 6, termMonths: 12, extraPayment: 0 });
check('shortest term (12 mo) still reconciles', sum(e3.rows, 'principal'), e3.amountFinanced, 0.01);
var e4 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 6, termMonths: 96, extraPayment: 0 });
check('longest term (96 mo) produces 96 rows', e4.rows.length, 96, 0);
var e5 = A.calculate({ vehiclePrice: 30000, downPayment: 0, tradeInValue: 0, tradeInPayoff: 0,
  fees: 0, state: '', overrideRatePct: 0, apr: 0, termMonths: 60, extraPayment: 250 });
check('0% APR with extra payments pays off early', e5.payoffMonths, 40, 0);
check('0% APR with extra payments still costs zero interest', e5.totalInterest, 0, 0);

console.log('\n--------------------------------------------');
console.log(pass + ' passed, ' + fail + ' failed');
console.log('--------------------------------------------\n');
process.exit(fail ? 1 : 0);
