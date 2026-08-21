/* =============================================================================
   Auto Loan Calculator — sites/p2-auto-loan
   Vanilla JS, no dependencies, computes entirely in the browser.

   Layout: pure math first (testable, no DOM), then the DOM layer.
   ============================================================================= */
(function (root) {
  'use strict';

  /* ===========================================================================
     STATE SALES TAX DATA — 2026 rates. UPDATE ANNUALLY (one object, on purpose).

     `rate`   state-level tax/excise rate applied to a vehicle purchase, percent.
              Local (county/city) tax is NOT included — it can add several points.
              The UI says so and offers an editable override.
     `taxesTradeIn`  true  = the state taxes the FULL vehicle price (no trade-in credit)
                     false = the state taxes price MINUS the trade-in allowance
     `creditCap`     trade-in credit is allowed but capped at this many dollars
     `cap`           the tax itself is capped at this many dollars
     `note`          shown in the UI when the state is selected

     Sources: state departments of revenue / motor vehicle agencies, cross-checked
     against the Federation of Tax Administrators state sales-tax table and
     Sales Tax Handbook's per-state vehicle tax pages (retrieved Aug 2026).
     Several states levy an excise, use, privilege, or highway-use tax rather than
     a sales tax; the effective purchase rate is used here and noted per state.
     Rates and trade-in rules change — verify with your state before signing.
     =========================================================================== */
  var STATE_TAX_2026 = {
    AL: { name: 'Alabama',              rate: 2.00,  taxesTradeIn: false, note: 'State automotive rate. County and city vehicle taxes are added on top.' },
    AK: { name: 'Alaska',               rate: 0.00,  taxesTradeIn: false, note: 'No state sales tax. Some boroughs levy a local tax.' },
    AZ: { name: 'Arizona',              rate: 5.60,  taxesTradeIn: false, note: 'State transaction privilege tax; city and county rates are added.' },
    AR: { name: 'Arkansas',             rate: 6.50,  taxesTradeIn: false },
    CA: { name: 'California',           rate: 7.25,  taxesTradeIn: true,  note: 'California gives no trade-in tax credit — tax is on the full price. District taxes add 0.1–3%.' },
    CO: { name: 'Colorado',             rate: 2.90,  taxesTradeIn: false, note: 'Low state rate, but county, city and district taxes often add 4–7%.' },
    CT: { name: 'Connecticut',          rate: 6.35,  taxesTradeIn: false, note: '7.75% applies to vehicles over $50,000.' },
    DE: { name: 'Delaware',             rate: 4.25,  taxesTradeIn: false, note: 'No sales tax, but a 4.25% document fee applies to the purchase price.' },
    DC: { name: 'District of Columbia', rate: 6.00,  taxesTradeIn: true,  note: 'Excise tax runs 6–8% by vehicle weight, with no trade-in credit.' },
    FL: { name: 'Florida',              rate: 6.00,  taxesTradeIn: false, note: 'Counties add a discretionary surtax on the first $5,000.' },
    GA: { name: 'Georgia',              rate: 6.60,  taxesTradeIn: false, note: 'One-time Title Ad Valorem Tax (TAVT) on fair market value, not sales tax.' },
    HI: { name: 'Hawaii',               rate: 4.00,  taxesTradeIn: true,  note: 'General excise tax on the full price; no trade-in credit. Oahu adds 0.5%.' },
    ID: { name: 'Idaho',                rate: 6.00,  taxesTradeIn: false },
    IL: { name: 'Illinois',             rate: 6.25,  taxesTradeIn: false, creditCap: 10000, note: 'Trade-in credit is capped at $10,000. Chicago and Cook County add several points.' },
    IN: { name: 'Indiana',              rate: 7.00,  taxesTradeIn: false },
    IA: { name: 'Iowa',                 rate: 5.00,  taxesTradeIn: false, note: 'Charged as a one-time registration fee rather than sales tax.' },
    KS: { name: 'Kansas',               rate: 6.50,  taxesTradeIn: false, note: 'Local rates commonly add 1–4%.' },
    KY: { name: 'Kentucky',             rate: 6.00,  taxesTradeIn: true,  note: 'Motor vehicle usage tax on the full retail price; no trade-in credit.' },
    LA: { name: 'Louisiana',            rate: 4.45,  taxesTradeIn: false, note: 'Parish and city taxes commonly add 4–6%.' },
    ME: { name: 'Maine',                rate: 5.50,  taxesTradeIn: false },
    MD: { name: 'Maryland',             rate: 6.00,  taxesTradeIn: true,  note: 'Titling tax on the full price; trade-in credit applies only to dealer sales in limited cases.' },
    MA: { name: 'Massachusetts',        rate: 6.25,  taxesTradeIn: false },
    MI: { name: 'Michigan',             rate: 6.00,  taxesTradeIn: true,  note: 'Michigan allows only a partial trade-in credit; this estimate taxes the full price. Check the current cap.' },
    MN: { name: 'Minnesota',            rate: 6.875, taxesTradeIn: false, note: 'Motor vehicle sales tax.' },
    MS: { name: 'Mississippi',          rate: 5.00,  taxesTradeIn: false, note: 'Reduced 5% rate for motor vehicles.' },
    MO: { name: 'Missouri',             rate: 4.225, taxesTradeIn: false, note: 'Local rates commonly add 2–5%.' },
    MT: { name: 'Montana',              rate: 0.00,  taxesTradeIn: false, note: 'No state sales tax on vehicles.' },
    NE: { name: 'Nebraska',             rate: 5.50,  taxesTradeIn: false },
    NV: { name: 'Nevada',               rate: 6.85,  taxesTradeIn: false, note: 'County taxes push the combined rate above 8% in Clark County.' },
    NH: { name: 'New Hampshire',        rate: 0.00,  taxesTradeIn: false, note: 'No state sales tax. Municipal registration fees still apply.' },
    NJ: { name: 'New Jersey',           rate: 6.625, taxesTradeIn: false },
    NM: { name: 'New Mexico',           rate: 4.00,  taxesTradeIn: false, note: 'Motor vehicle excise tax.' },
    NY: { name: 'New York',             rate: 4.00,  taxesTradeIn: false, note: 'State rate only; county and MCTD taxes typically add 4–4.9%.' },
    NC: { name: 'North Carolina',       rate: 3.00,  taxesTradeIn: false, note: 'Highway use tax instead of sales tax.' },
    ND: { name: 'North Dakota',         rate: 5.00,  taxesTradeIn: false, note: 'Motor vehicle excise tax.' },
    OH: { name: 'Ohio',                 rate: 5.75,  taxesTradeIn: false, note: 'County taxes add 0.75–2.25%.' },
    OK: { name: 'Oklahoma',             rate: 4.50,  taxesTradeIn: false, note: '1.25% sales tax plus 3.25% excise tax.' },
    OR: { name: 'Oregon',               rate: 0.00,  taxesTradeIn: false, note: 'No sales tax. A 0.5% privilege tax applies to new vehicles.' },
    PA: { name: 'Pennsylvania',         rate: 6.00,  taxesTradeIn: false, note: 'Allegheny County adds 1%, Philadelphia 2%.' },
    RI: { name: 'Rhode Island',         rate: 7.00,  taxesTradeIn: false },
    SC: { name: 'South Carolina',       rate: 5.00,  taxesTradeIn: false, cap: 500, note: 'Infrastructure Maintenance Fee of 5%, capped at $500.' },
    SD: { name: 'South Dakota',         rate: 4.00,  taxesTradeIn: false, note: 'Motor vehicle excise tax.' },
    TN: { name: 'Tennessee',            rate: 7.00,  taxesTradeIn: false, note: 'Local option tax applies to the first $1,600.' },
    TX: { name: 'Texas',                rate: 6.25,  taxesTradeIn: false, note: 'Motor vehicle sales tax on the price after trade-in. No local add-on for vehicles.' },
    UT: { name: 'Utah',                 rate: 4.85,  taxesTradeIn: false, note: 'Local rates commonly add 1.5–3%.' },
    VT: { name: 'Vermont',              rate: 6.00,  taxesTradeIn: false, note: 'Purchase and use tax.' },
    VA: { name: 'Virginia',             rate: 4.15,  taxesTradeIn: true,  note: 'Motor vehicle sales and use tax on the full price, minimum $75. No trade-in credit.' },
    WA: { name: 'Washington',           rate: 6.80,  taxesTradeIn: false, note: '6.5% sales tax plus a 0.3% motor vehicle tax. Local rates add 1–4%.' },
    WV: { name: 'West Virginia',        rate: 6.00,  taxesTradeIn: false },
    WI: { name: 'Wisconsin',            rate: 5.00,  taxesTradeIn: false, note: 'County taxes add 0.5–1.75%.' },
    WY: { name: 'Wyoming',              rate: 4.00,  taxesTradeIn: false, note: 'County taxes add up to 2%.' }
  };

  /* ===========================================================================
     MATH
     ---------------------------------------------------------------------------
     Monthly payment:  M = P · r(1+r)^n / ((1+r)^n − 1),  r = APR/12, n = months.
     When r = 0 the formula is undefined (0/0), so the zero-rate branch is M = P/n.

     VERIFIED TEST CASES (from /specs/p2-auto-loan.md; the payment formula is the
     one calculator.net/auto-loan-calculator.html uses, and every closed-form
     payment below is additionally verified against an independent numeric
     solution of the balance recursion in test-cases.js). Run `node test-cases.js`.

       1. $30,000 financed, 0% tax, 6.00% APR, 60 mo
          → M = $579.98 (exact: 579.984046, matches the spec's ≈$579.98)
            total interest $4,799.09, total paid $34,799.09 over exactly 60 payments
       2. $30,000 financed, 0.00% APR, 60 mo
          → M = $500.00 exactly (r = 0 branch), total interest $0.00
       3. $32,000 vehicle, $4,000 trade-in, TX 6.25% (taxes price minus trade-in),
          $2,000 down, 6.90% APR, 60 mo
          → taxable $28,000, sales tax $1,750.00, amount financed $27,750.00
          → M = $548.17   total interest $5,140.53
       4. Negative equity: $32,000 vehicle, trade-in worth $5,000, $8,000 still owed,
          TX 6.25%, $0 down, 6.90% APR, 60 mo
          → $3,000 of negative equity rolled in; taxable $27,000, tax $1,687.50
          → amount financed $36,687.50 (= 32,000 + 1,687.50 − 5,000 + 8,000),
            exactly $3,000 more than the same deal with a zero-equity trade-in
          → M = $724.73
       5. Case 1 plus $100/month extra
          → paid off in month 50 instead of 60 (10 months early),
             total interest $3,978.21, interest saved $820.88,
             and the schedule reconciles: Σprincipal = $30,000.00,
             Σinterest = total interest, Σpayments = total paid.

     Convention: the monthly payment is rounded to cents (as a lender bills it) and
     the schedule is built from that rounded figure, so the schedule always sums to
     the totals shown. The final payment absorbs the rounding remainder.
     =========================================================================== */

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }

  /** Monthly payment for principal P at annualRatePct over n months. */
  function monthlyPayment(P, annualRatePct, months) {
    if (!(P > 0) || !(months > 0)) return 0;
    var r = annualRatePct / 100 / 12;
    if (r === 0) return P / months;
    var g = Math.pow(1 + r, months);
    return P * r * g / (g - 1);
  }

  /** Sales tax due, honouring each state's trade-in treatment, caps and overrides. */
  function salesTax(input) {
    var price = num(input.vehiclePrice);
    var trade = num(input.tradeInValue);
    var st = STATE_TAX_2026[input.state] || null;
    var ratePct = input.overrideRatePct !== null && input.overrideRatePct !== undefined && input.overrideRatePct !== ''
      ? num(input.overrideRatePct)
      : (st ? st.rate : 0);

    var taxesTradeIn = st ? st.taxesTradeIn : false;
    var credit = taxesTradeIn ? 0 : trade;
    if (st && st.creditCap) credit = Math.min(credit, st.creditCap);

    var taxable = Math.max(0, price - credit);
    var tax = taxable * ratePct / 100;
    if (st && st.cap) tax = Math.min(tax, st.cap);

    return { taxable: taxable, ratePct: ratePct, amount: round2(tax), taxesTradeIn: taxesTradeIn, credit: credit, state: st };
  }

  /**
   * Amount financed.
   *   P = price + salesTax + fees − downPayment − tradeInValue + tradeInPayoff
   * Subtracting the trade-in allowance and adding back what is still owed on it
   * handles both directions: positive equity reduces the loan, negative equity
   * (payoff > value) rolls the shortfall into it.
   */
  function amountFinanced(input, taxAmount) {
    var price = num(input.vehiclePrice);
    var down = num(input.downPayment);
    var trade = num(input.tradeInValue);
    var payoff = num(input.tradeInPayoff);
    var fees = num(input.fees);
    return round2(Math.max(0, price + taxAmount + fees - down - trade + payoff));
  }

  /**
   * Amortization schedule. Extra is an optional additional principal payment
   * applied every month; the loan then closes early.
   */
  function schedule(principal, annualRatePct, months, extra) {
    var r = annualRatePct / 100 / 12;
    var base = round2(monthlyPayment(principal, annualRatePct, months));
    var add = round2(num(extra));
    var balance = principal;
    var rows = [];
    var totalInterest = 0, totalPaid = 0;
    /* The scheduled payment is rounded to cents, so after `months` payments a few
       cents of balance can survive (rounded down) or overshoot (rounded up). A real
       lender settles that in the final payment, and so does this: month `months` is
       always the last one. Extra payments only ever shorten the term. */
    for (var m = 1; m <= months && balance > 0.004; m++) {
      var interest = round2(balance * r);
      var pay = base + add;
      var principalPart = round2(pay - interest);

      if (principalPart >= balance || m === months) {   /* final payment clears the balance */
        principalPart = round2(balance);
        pay = round2(principalPart + interest);
      }
      balance = round2(balance - principalPart);
      totalInterest = round2(totalInterest + interest);
      totalPaid = round2(totalPaid + pay);
      rows.push({ month: m, payment: pay, principal: principalPart, interest: interest, balance: balance });
    }

    return {
      basePayment: base,
      rows: rows,
      months: rows.length,
      totalInterest: totalInterest,
      totalPaid: totalPaid
    };
  }

  /** Full calculation: everything the UI shows, from one input object. */
  function calculate(input) {
    var tax = salesTax(input);
    var principal = amountFinanced(input, tax.amount);
    var months = Math.round(num(input.termMonths));
    var apr = input.apr === '' || input.apr === null || input.apr === undefined ? 0 : Math.max(0, parseFloat(input.apr) || 0);
    var extra = num(input.extraPayment);

    var basePlan = schedule(principal, apr, months, 0);
    var plan = extra > 0 ? schedule(principal, apr, months, extra) : basePlan;

    var trade = num(input.tradeInValue);
    var payoff = num(input.tradeInPayoff);

    return {
      valid: principal > 0 && months > 0,
      vehiclePrice: num(input.vehiclePrice),
      downPayment: num(input.downPayment),
      fees: num(input.fees),
      tradeInValue: trade,
      tradeInPayoff: payoff,
      tradeEquity: round2(trade - payoff),
      negativeEquity: round2(Math.max(0, payoff - trade)),
      salesTax: tax,
      amountFinanced: principal,
      apr: apr,
      termMonths: months,
      monthlyPayment: round2(plan.basePayment),
      extraPayment: extra,
      payoffMonths: plan.months,
      totalInterest: plan.totalInterest,
      totalPaid: plan.totalPaid,
      monthsSaved: basePlan.months - plan.months,
      interestSaved: round2(basePlan.totalInterest - plan.totalInterest),
      baseTotalInterest: basePlan.totalInterest,
      rows: plan.rows
    };
  }

  var API = {
    STATE_TAX_2026: STATE_TAX_2026,
    monthlyPayment: monthlyPayment,
    salesTax: salesTax,
    amountFinanced: amountFinanced,
    schedule: schedule,
    calculate: calculate,
    round2: round2
  };

  root.AutoLoan = API;
  /* Lets the shipped file be unit-tested under Node without a build step. */
  if (typeof module === 'object' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
