(function (root) {
  'use strict';

  var CYCLES = {
    weekly: 52 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12
  };

  function monthlyCost(price, cycle) {
    var factor = CYCLES[cycle];
    if (!factor) throw new Error('Unknown billing cycle: ' + cycle);
    var amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) return NaN;
    return amount * factor;
  }

  function summarize(items) {
    var valid = [];
    (items || []).forEach(function (item) {
      var monthly = monthlyCost(item.price, item.cycle || 'monthly');
      if (Number.isFinite(monthly) && monthly > 0) {
        valid.push({ name: String(item.name || '').trim(), monthly: monthly });
      }
    });

    var monthly = valid.reduce(function (sum, item) { return sum + item.monthly; }, 0);
    var biggest = valid.reduce(function (top, item) {
      return top && top.monthly >= item.monthly ? top : item;
    }, null);

    return {
      count: valid.length,
      monthly: monthly,
      yearly: monthly * 12,
      daily: monthly * 12 / 365,
      fiveYear: monthly * 60,
      biggest: biggest
    };
  }

  var api = { CYCLES: CYCLES, monthlyCost: monthlyCost, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SubscriptionCreep = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
