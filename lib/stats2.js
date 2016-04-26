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

    result.scenariosCreated += r.scenariosCreated;
    result._completedScenarios = r._completedScenarios;

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

//
// An entry is: [timestamp, vuserId, delta, responseCode]
//
Stats.prototype.addEntry = function(entry) {
  this._entries.push(entry);
  return this;
};

Stats.prototype.getEntries = function() {
  return this._entries;
};

Stats.prototype.completedScenario = function() {
  this._completedScenarios++;
  return this;
};

Stats.prototype.addError = function(errCode) {
  if (!this._errors[errCode]) {
    this._errors[errCode] = 0;
  }
  this._errors[errCode]++;
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

  let scenarioIds = L.map(this._entries, (e) => {
    return e[1];
  });
  result.scenariosCreated = L.size(L.uniq(scenarioIds));

  result.scenariosCompleted = this._completedScenarios;
  result.requestsCompleted = L.size(this._entries);

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
  let opTimestamps = L.map(this._entries, (e) => {
    return e[0];
  });
  let startedAt = L.min(opTimestamps);
  let now = Date.now();
  let count = L.size(opTimestamps);
  let mean = Math.round(
    (count / (Math.round((now - startedAt) / 10) / 100)) * 100) / 100;

  result.rps = {
    count: count,
    mean: mean
  };

  result.errors = this._errors;

  // TODO: reconstruct codes here
  result.codes = this._codes;

  result.matches = this._matches;

  result.latencies = this.getEntries();

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
  this.scenariosCreated = 0;
  this._entries = [];
  this._completedScenarios = 0;
  this._errors = {};
  this._matches = 0;
  this._customStats = {};
  return this;
};

// TODO: export this
function round(number, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(number * m) / m;
}
