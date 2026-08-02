(function () {
  "use strict";

  var CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L — easy to type
  var PUSH_DEBOUNCE_MS = 500;

  var db = null;
  var unsubscribe = null;
  var lastPushedJson = null;
  var pushTimer = null;
  var onRemoteUpdateCb = null;

  function isConfigured() {
    var cfg = window.App.firebaseConfig;
    return !!(cfg && cfg.apiKey && cfg.projectId);
  }

  function ensureApp() {
    if (!isConfigured() || typeof firebase === "undefined") return false;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.App.firebaseConfig);
      }
      if (!db) db = firebase.firestore();
      return true;
    } catch (err) {
      return false;
    }
  }

  function makeCode() {
    var code = "";
    for (var i = 0; i < 8; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  function docRef(code) {
    return db.collection("syncedData").doc(code);
  }

  function payloadFromState(state) {
    return {
      schemaVersion: state.schemaVersion,
      goals: state.goals,
      streak: state.streak,
      updatedAt: new Date().toISOString()
    };
  }

  // Starts (or restarts) the live listener for a given code. onRemoteUpdate
  // is called with the remote payload whenever another device's write is
  // detected — never for this device's own writes echoing back.
  function start(code, onRemoteUpdate) {
    if (!ensureApp()) return false;
    stop();
    onRemoteUpdateCb = onRemoteUpdate;

    unsubscribe = docRef(code).onSnapshot(
      function (snap) {
        if (!snap.exists) return;
        var data = snap.data();
        var json = JSON.stringify(data);
        if (json === lastPushedJson) return; // our own echo, ignore
        lastPushedJson = json;
        if (onRemoteUpdateCb) onRemoteUpdateCb(data);
      },
      function () {
        // connection/permission error — fail silently, app keeps working locally
      }
    );
    return true;
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
  }

  function push(code, state) {
    if (!ensureApp()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var payload = payloadFromState(state);
      lastPushedJson = JSON.stringify(payload);
      docRef(code).set(payload).catch(function () {
        // offline or blocked — Firestore will retry from its local queue
        // once connectivity returns, nothing more to do here
      });
    }, PUSH_DEBOUNCE_MS);
  }

  // One-time fetch used when pairing a second device with an existing code.
  function fetchOnce(code, callback) {
    if (!ensureApp()) {
      callback(new Error("Sync isn't set up in this build yet."), null);
      return;
    }
    docRef(code)
      .get()
      .then(function (snap) {
        if (!snap.exists) {
          callback(new Error("That code wasn't found. Double-check it, or generate a new one on your other device."), null);
          return;
        }
        callback(null, snap.data());
      })
      .catch(function (err) {
        callback(err, null);
      });
  }

  function createCode(state, callback) {
    if (!ensureApp()) {
      callback(new Error("Sync isn't set up in this build yet."));
      return;
    }
    var code = makeCode();
    var payload = payloadFromState(state);
    lastPushedJson = JSON.stringify(payload);
    docRef(code)
      .set(payload)
      .then(function () {
        callback(null, code);
      })
      .catch(function (err) {
        callback(err, null);
      });
  }

  window.App = window.App || {};
  window.App.Sync = {
    isConfigured: isConfigured,
    start: start,
    stop: stop,
    push: push,
    fetchOnce: fetchOnce,
    createCode: createCode
  };
})();
