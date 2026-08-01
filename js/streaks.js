(function () {
  "use strict";

  var MILESTONES = [3, 7, 14, 30, 50, 100];

  function keyFromDate(date) {
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  function todayKey(date) {
    return keyFromDate(date || new Date());
  }

  function yesterdayKey(date) {
    var d = date ? new Date(date) : new Date();
    d.setDate(d.getDate() - 1);
    return keyFromDate(d);
  }

  // Resets streak.current to 0 if the last activity wasn't today or yesterday.
  // Must run once at app init so displayed streak state is never stale.
  function decayIfBroken(streak) {
    if (!streak.lastActivityDate) return false;
    var today = todayKey();
    var yesterday = yesterdayKey();
    if (streak.lastActivityDate !== today && streak.lastActivityDate !== yesterday) {
      streak.current = 0;
      return true;
    }
    return false;
  }

  // Call only on a completion event, never on uncheck.
  function recordActivity(streak) {
    var today = todayKey();
    if (streak.lastActivityDate === today) {
      return { incremented: false, milestoneHit: null };
    }

    var wasYesterday = streak.lastActivityDate === yesterdayKey();
    streak.current = wasYesterday ? streak.current + 1 : 1;
    streak.longest = Math.max(streak.longest || 0, streak.current);
    streak.lastActivityDate = today;

    if (!Array.isArray(streak.activityDates)) streak.activityDates = [];
    if (streak.activityDates.indexOf(today) === -1) {
      streak.activityDates.push(today);
    }

    var milestoneHit = MILESTONES.indexOf(streak.current) !== -1 ? streak.current : null;

    return { incremented: true, milestoneHit: milestoneHit };
  }

  // Local-date parse of a "YYYY-MM-DD" key, avoiding the UTC-midnight bug
  // that `new Date(dateOnlyString)` has in negative-UTC-offset timezones.
  function dateFromKey(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  // days of true/false, oldest first, for a mini activity heatmap.
  function activityGrid(logDates, days) {
    days = days || 30;
    var set = {};
    (logDates || []).forEach(function (d) {
      set[d] = true;
    });
    var result = [];
    var today = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var day = new Date(today);
      day.setDate(today.getDate() - i);
      result.push(!!set[keyFromDate(day)]);
    }
    return result;
  }

  // Derived (never stored) current/longest streak for an arbitrary list of
  // "YYYY-MM-DD" check-in dates, e.g. a single habit goal's log. Same
  // today-or-yesterday-counts-as-current rule as the app-wide streak.
  function habitStreak(logDates) {
    var set = {};
    (logDates || []).forEach(function (d) {
      set[d] = true;
    });

    var current = 0;
    var startKey = set[todayKey()] ? todayKey() : (set[yesterdayKey()] ? yesterdayKey() : null);
    if (startKey) {
      var cursor = dateFromKey(startKey);
      while (set[keyFromDate(cursor)]) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    var sortedKeys = Object.keys(set).sort();
    var longest = 0;
    var run = 0;
    var prevKey = null;
    sortedKeys.forEach(function (key) {
      if (prevKey) {
        var expected = dateFromKey(prevKey);
        expected.setDate(expected.getDate() + 1);
        run = keyFromDate(expected) === key ? run + 1 : 1;
      } else {
        run = 1;
      }
      longest = Math.max(longest, run);
      prevKey = key;
    });

    return { current: current, longest: Math.max(longest, current) };
  }

  window.App = window.App || {};
  window.App.Streaks = {
    MILESTONES: MILESTONES,
    todayKey: todayKey,
    yesterdayKey: yesterdayKey,
    dateFromKey: dateFromKey,
    decayIfBroken: decayIfBroken,
    recordActivity: recordActivity,
    activityGrid: activityGrid,
    habitStreak: habitStreak
  };
})();
