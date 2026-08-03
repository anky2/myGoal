(function () {
  "use strict";

  var STEP_MESSAGES = [
    "Nice work!",
    "One step closer!",
    "Keep it up!",
    "Progress!",
    "You're on a roll!",
    "Well done!"
  ];

  var COLORS = ["#4f8cff", "#7c5cff", "#2fb872", "#f5a623", "#e5484d", "#00b8b0", "#ff7ab8"];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduce-motion: reduce), (prefers-reduced-motion: reduce)").matches;
  }

  function confettiEnabled() {
    var state = window.App.state;
    return !state || !state.settings || state.settings.confettiEnabled !== false;
  }

  function burst(originEl, opts) {
    if (!confettiEnabled() || prefersReducedMotion()) return;
    opts = opts || {};
    var count = opts.count || 40;
    var layer = document.getElementById("confetti-layer");
    if (!layer) return;

    var originX = window.innerWidth / 2;
    var originY = 0;
    if (originEl && typeof originEl.getBoundingClientRect === "function") {
      var rect = originEl.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
    }

    for (var i = 0; i < count; i++) {
      var piece = document.createElement("div");
      piece.className = "confetti-piece";
      var size = 6 + Math.random() * 6;
      var drift = (Math.random() - 0.5) * 260;
      var fall = 180 + Math.random() * 260;
      var rot = Math.random() * 360;
      var duration = 0.9 + Math.random() * 0.9;
      var delay = Math.random() * 0.15;

      piece.style.setProperty("--left", originX + "px");
      piece.style.setProperty("--top", originY + "px");
      piece.style.setProperty("--size", size + "px");
      piece.style.setProperty("--color", COLORS[Math.floor(Math.random() * COLORS.length)]);
      piece.style.setProperty("--drift", drift + "px");
      piece.style.setProperty("--fall", fall + "px");
      piece.style.setProperty("--rot", rot + "deg");
      piece.style.setProperty("--duration", duration + "s");
      piece.style.setProperty("--delay", delay + "s");

      var cleanup = function () {
        piece.remove();
      };
      piece.addEventListener("animationend", cleanup);
      setTimeout(cleanup, (duration + delay) * 1000 + 400);

      layer.appendChild(piece);
    }
  }

  function celebrateStep(originEl) {
    burst(originEl, { count: 30 });
    var msg = STEP_MESSAGES[Math.floor(Math.random() * STEP_MESSAGES.length)];
    showToast(msg);
  }

  function celebrateGoal() {
    burst(null, { count: 140 });
  }

  function showToast(message) {
    var container = document.getElementById("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.classList.add("leaving");
      setTimeout(function () {
        toast.remove();
      }, 250);
    }, 2500);
  }

  function showGoalCompleteModal(goal, stats) {
    var modal = document.getElementById("app-modal");
    var content = document.getElementById("app-modal-content");
    if (!modal || !content) return;

    content.innerHTML = "";

    var title = document.createElement("h2");
    title.className = "modal-title celebrate";
    title.textContent = "Goal Achieved! 🎉";
    content.appendChild(title);

    var goalName = document.createElement("p");
    goalName.style.textAlign = "center";
    goalName.style.fontWeight = "600";
    goalName.textContent = goal.title;
    content.appendChild(goalName);

    var statsRow = document.createElement("div");
    statsRow.className = "celebrate-stats";

    var daysTaken = 0;
    try {
      var created = new Date(goal.createdAt);
      var completed = new Date(goal.completedAt || Date.now());
      daysTaken = Math.max(0, Math.round((completed - created) / 86400000));
    } catch (e) {
      daysTaken = 0;
    }

    var stepsCompleted = stats && typeof stats.stepsCompleted === "number" ? stats.stepsCompleted : goal.steps.length;

    [
      { value: daysTaken, label: daysTaken === 1 ? "day taken" : "days taken" },
      { value: stepsCompleted, label: stepsCompleted === 1 ? "step done" : "steps done" }
    ].forEach(function (s) {
      var wrap = document.createElement("div");
      var v = document.createElement("div");
      v.className = "celebrate-stat-value";
      v.textContent = String(s.value);
      var l = document.createElement("div");
      l.className = "celebrate-stat-label";
      l.textContent = s.label;
      wrap.appendChild(v);
      wrap.appendChild(l);
      statsRow.appendChild(wrap);
    });
    content.appendChild(statsRow);

    var actions = document.createElement("div");
    actions.className = "celebrate-actions";
    var closeBtn = document.createElement("button");
    closeBtn.className = "btn-primary";
    closeBtn.type = "button";
    closeBtn.textContent = "Nice!";
    closeBtn.addEventListener("click", function () {
      modal.close();
    });
    actions.appendChild(closeBtn);
    content.appendChild(actions);

    // Native <dialog> paints in the browser's top layer, so its ::backdrop
    // would otherwise sit above the confetti layer and dim the burst. Fire
    // the confetti first so it's visible, then bring in the modal.
    celebrateGoal();
    setTimeout(function () {
      modal.showModal();
    }, 300);
  }

  function showStreakMilestone(count) {
    showToast("🔥 " + count + "-day streak!");
  }

  function showHabitMilestone(goalTitle, count) {
    showToast("🔥 " + count + "-day streak on " + goalTitle + "!");
  }

  window.App = window.App || {};
  window.App.Celebrate = {
    burst: burst,
    celebrateStep: celebrateStep,
    celebrateGoal: celebrateGoal,
    showToast: showToast,
    showGoalCompleteModal: showGoalCompleteModal,
    showStreakMilestone: showStreakMilestone,
    showHabitMilestone: showHabitMilestone
  };
})();
