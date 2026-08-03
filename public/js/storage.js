(function () {
  "use strict";

  var STORAGE_KEY = "goalsTracker.v1";
  var CURRENT_SCHEMA_VERSION = 1;

  function defaultData() {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      goals: [],
      streak: {
        current: 0,
        longest: 0,
        lastActivityDate: null,
        activityDates: []
      },
      settings: {
        theme: "system",
        confettiEnabled: true
      }
    };
  }

  // Indexed by the version being migrated FROM. migrations[0] takes a v0-shaped
  // object (or anything missing a version) and returns a v1-shaped object.
  var migrations = [
    function fromV0(data) {
      data.schemaVersion = 1;
      if (!Array.isArray(data.goals)) data.goals = [];
      if (!data.streak) {
        data.streak = { current: 0, longest: 0, lastActivityDate: null, activityDates: [] };
      }
      if (!Array.isArray(data.streak.activityDates)) data.streak.activityDates = [];
      if (!data.settings) data.settings = { theme: "system", confettiEnabled: true };
      return data;
    }
  ];

  function migrate(data) {
    var version = data.schemaVersion || 0;
    while (version < CURRENT_SCHEMA_VERSION) {
      var step = migrations[version];
      if (!step) break;
      data = step(data);
      version = data.schemaVersion;
    }
    return data;
  }

  function load() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return defaultData();
    }

    if (!raw) return defaultData();

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      try {
        localStorage.setItem(STORAGE_KEY + ".corrupt." + Date.now(), raw);
      } catch (err2) {
        /* nothing more we can do */
      }
      return defaultData();
    }

    if (!parsed || typeof parsed !== "object") return defaultData();

    var migrated = migrate(parsed);
    save(migrated);
    return migrated;
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  function exportJSON(data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "goals-tracker-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function importJSON(file, onDone) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var migrated = migrate(parsed);
        save(migrated);
        onDone(null, migrated);
      } catch (err) {
        onDone(err, null);
      }
    };
    reader.onerror = function () {
      onDone(reader.error, null);
    };
    reader.readAsText(file);
  }

  window.App = window.App || {};
  window.App.Storage = {
    STORAGE_KEY: STORAGE_KEY,
    defaultData: defaultData,
    load: load,
    save: save,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
})();
