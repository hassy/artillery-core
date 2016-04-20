/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const L = require('lodash');
const sl = require('stats-lite');

module.exports = {
  create: create,
  combine: combine
};

function create() {
  return new Stats();
}

/**
 * Combine several stats objects into one.
 *
 */
function combine(statsObjs) {
  let result = create();

  statsObjs.map((r) => r.aggregate).forEach((r) => {

    r.latencies.forEach((entry) => {
      result._entries.push(entry);
    });

    console.log(r._generatedScenarios);

    result._generatedScenarios += r._generatedScenarios;
    result._completedScenarios = r._completedScenarios;

    r._requestTimestamps.forEach((t) => {
      result._requestTimestamps.push(t);
    });

    result._completedRequests += r._completedRequests;
    r._scenarioLatencies.forEach((l) => {
      result._scenarioLatencies.push(l);
    });

    result._matches += r.matches;

    result = f(result, r, 'codes');
    result = f(result, r, 'errors');

    L.each(r._customStats, (values, statName) => {
      if (!result[statName]) {
        result[statName] = [];
      }
      values.forEach((v) => {
        result[statName].push(v);
      });
    });
  });

  return result;

  function f(destObj, sourceObj, fieldName) {
    let result = Object.assign({}, destObj);
    L.each(sourceObj[fieldName], (v, k) => {
      result[fieldName] = result[fieldName] || k;
      if (result[fieldName][k]) {
        result[fieldName][k] += v;
      } else {
        result[fieldName][k] = v;
      }
    });
    return result;
  }
}

function Stats() {
  return this.reset();
}

Stats.prototype.addEntry = function(entry) {
  this._entries.push(entry);
  return this;
};

Stats.prototype.getEntries = function() {
  return this._entries;
};

Stats.prototype.newScenario = function() {
  this._generatedScenarios++;
  return this;
};

Stats.prototype.completedScenario = function() {
  this._completedScenarios++;
  return this;
};

Stats.prototype.addCode = function(code) {
  if (!this._codes[code]) {
    this._codes[code] = 0;
  }
  this._codes[code]++;
  return this;
};

Stats.prototype.addError = function(errCode) {
  if (!this._errors[errCode]) {
    this._errors[errCode] = 0;
  }
  this._errors[errCode]++;
  return this;
};

Stats.prototype.newRequest = function() {
  this._requestTimestamps.push(Date.now());
  return this;
};

Stats.prototype.completedRequest = function() {
  this._completedRequests++;
  return this;
};

Stats.prototype.addLatency = function(delta) {
  // this is actually UNUSED
  this._latencies.push(delta);
  return this;
};

Stats.prototype.addScenarioLatency = function(delta) {
  this._scenarioLatencies.push(delta);
  return this;
};

Stats.prototype.addMatch = function() {
  this._matches++;
  return this;
};

// Not really a report, but a data structure representing the state of
// the object.

// *********
// NEXT: Get rid of all current users to report() and just make it serialize()
// And get rid of all the legacy methods used in core. Make it leaner and meaner, make combine work - write a test.
// Then I have the reporting from multiple workers "for free".
// Then expand `quick`.
// Boom!
// *********

Stats.prototype.report = function() {
  let result = {};

  result.timestamp = new Date().toISOString();
  result.scenariosCreated = this._generatedScenarios;
  result.scenariosCompleted = this._completedScenarios;
  result.requestsCompleted = this._completedRequests;

  let latencies = L.map(this._entries, (e) => {
    return e[2];
  });

  // should not need
  result.latency = {
    min: round(L.min(latencies) / 1e6, 1),
    max: round(L.max(latencies) / 1e6, 1),
    median: round(sl.median(latencies) / 1e6, 1),
    p95: round(sl.percentile(latencies, 0.95) / 1e6, 1),
    p99: round(sl.percentile(latencies, 0.99) / 1e6, 1)
  };

  // Can this not be done with the _entries? Those contain timestamps.
  let startedAt = L.min(this._requestTimestamps);
  let now = Date.now();
  let count = L.size(this._requestTimestamps);
  let mean = Math.round(
    (count / (Math.round((now - startedAt) / 10) / 100)) * 100) / 100;

  result.rps = {
    count: count,
    mean: mean
  };

  result.scenarioDuration = {
    min: round(L.min(this._scenarioLatencies) / 1e6, 1),
    max: round(L.max(this._scenarioLatencies) / 1e6, 1),
    median: round(sl.median(this._scenarioLatencies) / 1e6, 1),
    p95: round(sl.percentile(this._scenarioLatencies, 0.95) / 1e6, 1),
    p99: round(sl.percentile(this._scenarioLatencies, 0.99) / 1e6, 1)
  };

  result.errors = this._errors;
  result.codes = this._codes;
  result.matches = this._matches;

  result.latencies = this.getEntries();

  result._requestTimestamps = this._requestTimestamps;
  result._scenarioLatencies = this._scenarioLatencies;
  result._customStats = this._customStats;


  result.customStats = {};
  L.each(this._customStats, function(ns, name) {
    result.customStats[name] = {
      min: round(L.min(ns), 1),
      max: round(L.max(ns), 1),
      median: round(sl.median(ns), 1),
      p95: round(sl.percentile(ns, 0.95), 1),
      p99: round(sl.percentile(ns, 0.99), 1)
    };
  });

  return result;
};

Stats.prototype.addCustomStat = function(name, n) {
  if (!this._customStats[name]) {
    this._customStats[name] = [];
  }

  this._customStats[name].push(n);
  return this;
};

Stats.prototype.reset = function() {
  this._entries = [];
  this._latencies = []; // TODO: unused, remove
  this._generatedScenarios = 0;
  this._completedScenarios = 0;
  this._codes = {};
  this._errors = {};
  this._requestTimestamps = [];
  this._completedRequests = 0;
  this._scenarioLatencies = [];
  this._matches = 0;
  this._customStats = {};
  return this;
};

// TODO: Remove this.
Stats.prototype.free = function() {
  return this;
};

// TODO: export this
function round(number, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(number * m) / m;
}
