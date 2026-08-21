/* =============================================================================
   DOM layer for the auto loan calculator. Loads after calculator.js (both defer).
   Everything computes on input; no submit button.
   ============================================================================= */
(function () {
  'use strict';
  var A = window.AutoLoan;
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    form: $('calc'),
    price: $('price'), down: $('down'), trade: $('trade'), payoff: $('payoff'),
    state: $('state'), rate: $('rate'), fees: $('fees'), apr: $('apr'),
    termCustom: $('term-custom'), extra: $('extra'),
    stateNote: $('state-note'),
    payment: $('payment'), paymentNote: $('payment-note'),
    statFinanced: $('stat-financed'), statTax: $('stat-tax'),
    statInterest: $('stat-interest'), statTotal: $('stat-total'), statPayoff: $('stat-payoff'),
    extraRow: $('extra-savings'), negRow: $('negative-equity-note'),
    schedule: $('schedule'), scheduleWrap: $('schedule-wrap')
  };
  if (!els.form || !A) return;

  /* Build the state dropdown from the data object so the two never drift. */
  (function fillStates() {
    var codes = Object.keys(A.STATE_TAX_2026).sort(function (a, b) {
      return A.STATE_TAX_2026[a].name < A.STATE_TAX_2026[b].name ? -1 : 1;
    });
    codes.forEach(function (code) {
      var o = document.createElement('option');
      o.value = code;
      o.textContent = A.STATE_TAX_2026[code].name;
      els.state.appendChild(o);
    });
    els.state.value = 'TX';
  })();

  var rateEdited = false; /* once the user edits the rate, it overrides the state */

  function fmt(n, cents) {
    return '$' + n.toLocaleString('en-US', {
      minimumFractionDigits: cents === false ? 0 : 2,
      maximumFractionDigits: cents === false ? 0 : 2
    });
  }

  function term() {
    var checked = els.form.querySelector('input[name="term"]:checked');
    var custom = parseInt(els.termCustom.value, 10);
    if (els.termCustom.value !== '' && custom >= 12 && custom <= 96) return custom;
    return checked ? parseInt(checked.value, 10) : 60;
  }

  function syncStateRate() {
    var st = A.STATE_TAX_2026[els.state.value];
    els.rate.value = st ? st.rate : 0;
    rateEdited = false;
    var msg = '';
    if (st) {
      msg = st.taxesTradeIn
        ? st.name + ' taxes the full vehicle price — no trade-in credit.'
        : st.name + ' taxes the price minus your trade-in.';
      if (st.note) msg += ' ' + st.note;
    }
    els.stateNote.textContent = msg;
  }

  function input() {
    return {
      vehiclePrice: els.price.value, downPayment: els.down.value,
      tradeInValue: els.trade.value, tradeInPayoff: els.payoff.value,
      state: els.state.value,
      overrideRatePct: rateEdited ? els.rate.value : '',
      fees: els.fees.value, apr: els.apr.value,
      termMonths: term(), extraPayment: els.extra.value
    };
  }

  function payoffDateText(months) {
    var d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function renderSchedule(r) {
    var frag = document.createDocumentFragment();
    var years = Math.ceil(r.rows.length / 12);
    for (var y = 0; y < years; y++) {
      var rows = r.rows.slice(y * 12, y * 12 + 12);
      var paid = 0, interest = 0;
      rows.forEach(function (row) { paid += row.payment; interest += row.interest; });
      var end = rows[rows.length - 1];

      var det = document.createElement('details');
      if (y === 0) det.open = true;
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="yr">Year ' + (y + 1) + '</span>' +
        '<span class="yr-meta">' + fmt(interest) + ' interest · balance ' + fmt(end.balance) + '</span>';
      det.appendChild(sum);

      var scroller = document.createElement('div');
      scroller.className = 'tbl-scroll';
      var t = document.createElement('table');
      t.innerHTML = '<caption class="visually-hidden">Amortization, year ' + (y + 1) + '</caption>' +
        '<thead><tr><th scope="col">Mo</th><th scope="col">Payment</th><th scope="col">Principal</th>' +
        '<th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>';
      var tb = document.createElement('tbody');
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + row.month + '</td><td>' + fmt(row.payment) + '</td><td>' +
          fmt(row.principal) + '</td><td>' + fmt(row.interest) + '</td><td>' + fmt(row.balance) + '</td>';
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      scroller.appendChild(t);
      det.appendChild(scroller);
      frag.appendChild(det);
    }
    els.schedule.textContent = '';
    els.schedule.appendChild(frag);
  }

  function render() {
    var r = A.calculate(input());
    if (!r.valid) {
      els.payment.textContent = '—';
      els.paymentNote.textContent = 'Enter a vehicle price to see your payment.';
      els.scheduleWrap.hidden = true;
      els.extraRow.hidden = true;
      els.negRow.hidden = true;
      ['statFinanced', 'statTax', 'statInterest', 'statTotal', 'statPayoff'].forEach(function (k) {
        els[k].textContent = '—';
      });
      return;
    }

    els.payment.textContent = fmt(r.monthlyPayment);
    els.paymentNote.textContent = r.termMonths + ' months at ' + r.apr + '% APR' +
      (r.extraPayment > 0 ? ' + ' + fmt(r.extraPayment, false) + '/mo extra' : '');

    els.statFinanced.textContent = fmt(r.amountFinanced);
    els.statTax.textContent = fmt(r.salesTax.amount) +
      (r.salesTax.ratePct ? ' (' + r.salesTax.ratePct + '%)' : '');
    els.statInterest.textContent = fmt(r.totalInterest);
    els.statTotal.textContent = fmt(r.totalPaid);
    els.statPayoff.textContent = payoffDateText(r.payoffMonths) +
      (r.monthsSaved > 0 ? ' · ' + r.monthsSaved + ' mo early' : '');

    if (r.extraPayment > 0 && r.interestSaved > 0.005) {
      els.extraRow.hidden = false;
      els.extraRow.textContent = 'Extra ' + fmt(r.extraPayment, false) + '/month saves ' +
        fmt(r.interestSaved) + ' in interest and pays the loan off ' + r.monthsSaved +
        (r.monthsSaved === 1 ? ' month' : ' months') + ' early.';
    } else els.extraRow.hidden = true;

    if (r.negativeEquity > 0) {
      els.negRow.hidden = false;
      els.negRow.textContent = 'You owe ' + fmt(r.negativeEquity, false) +
        ' more than the trade-in is worth. That negative equity is rolled into this loan.';
    } else els.negRow.hidden = true;

    els.scheduleWrap.hidden = false;
    renderSchedule(r);
  }

  els.state.addEventListener('change', function () { syncStateRate(); render(); });
  els.rate.addEventListener('input', function () { rateEdited = true; render(); });
  els.form.addEventListener('input', function (e) {
    if (e.target === els.rate || e.target === els.state) return;
    if (e.target.name === 'term') els.termCustom.value = '';
    if (e.target === els.termCustom && els.termCustom.value !== '') {
      var checked = els.form.querySelector('input[name="term"]:checked');
      if (checked) checked.checked = false;
    }
    render();
  });
  els.form.addEventListener('submit', function (e) { e.preventDefault(); });

  syncStateRate();
  render();
})();
