/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This implementation prioritizes simplicity over performance.
// Performance can be profiled & optimized later.

var sl = require('stats-lite');
var L = require('lodash');

function Bag() {
  this.counters = {};
  this.histograms = {};
  this.groups = {};
  return this;
}

Bag.prototype.counter = function counter(name, value) {
  value = value || 1;
  if (this.counters[name]) {
    this.counters[name] += value;
  } else {
    this.counters[name] = value;
  }
  return this;
}

Bag.prototype.histogram = function histogram(name, value) {
  if (this.histograms[name]) {
    this.histograms[name].push(value);
  } else {
    this.histograms[name] = [];
  }
  return this;
}

Bag.prototype.group = function group(name, key, value) {
  value = value || 1;
  if (this.groups[name]) {
    if (this.groups[name][key]) {
      this.groups[name][key] += value;
    } else {
      this.groups[name][key] = value;
    }
  } else {
    this.groups[name] = {};
    this.groups[name][key] = value;
  }

  return this;
}

function combine(bags) {
  var result = new Bag();
  L.forEach(bags, function(bag) {
    L.each(bag.counters, function(counterValue, counterName) {
      result.counter(counterName, counterValue);
    });

    L.each(bag.histograms, function(values, name) {
      L.each(values, function(v) {
        result.histogram(name, v);
      });
    });

    L.each(bag.groups, function(counters, groupName) {
      // counters is something like: { '200': 450, '500': 7 }
      L.each(counters, function(value, key) {
        result.group(groupName, key, value);
      });
    });
  });

  return result;
}

function histogram(values) {
  return {
    min: L.min(values),
    max: L.max(values),
    median: sl.median(values),
    p95: sl.percentile(values, 0.95),
    p99: sl.percentile(values, 0.99)
  }
}

function round(number, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(number * m) / m;
}

module.exports = {
  create: function() {
    return new Bag();
  },
  histogram: histogram,
  round: round,
  combine: combine
}
