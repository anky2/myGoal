(function () {
  "use strict";

  var COLOR_PALETTE = [
    "#4f8cff", "#7c5cff", "#2fb872", "#f5a623",
    "#e5484d", "#00b8b0", "#ff7ab8", "#8a7cff"
  ];

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function createGoal(fields) {
    fields = fields || {};
    var ts = nowISO();
    var type = fields.type === "habit" ? "habit" : "milestone";
    return {
      id: makeId(),
      type: type,
      title: (fields.title || "").trim(),
      description: (fields.description || "").trim(),
      category: (fields.category || "").trim(),
      color: fields.color || COLOR_PALETTE[0],
      deadline: type === "habit" ? null : (fields.deadline || null),
      createdAt: ts,
      updatedAt: ts,
      completedAt: null,
      archived: false,
      steps: [],
      habit: type === "habit" ? { log: [] } : null
    };
  }

  function createStep(fields) {
    fields = fields || {};
    var ts = nowISO();
    return {
      id: makeId(),
      title: (fields.title || "").trim(),
      notes: (fields.notes || "").trim(),
      done: false,
      createdAt: ts,
      completedAt: null
    };
  }

  function isHabit(goal) {
    return goal.type === "habit";
  }

  // Toggles today's check-in for a habit goal. Returns the new checked-in
  // state (true = just checked in, false = just un-checked).
  function toggleHabitCheckIn(goal) {
    if (!goal.habit) goal.habit = { log: [] };
    var today = window.App.Streaks.todayKey();
    var idx = goal.habit.log.indexOf(today);
    goal.updatedAt = nowISO();
    if (idx === -1) {
      goal.habit.log.push(today);
      return true;
    }
    goal.habit.log.splice(idx, 1);
    return false;
  }

  function goalProgress(goal) {
    if (isHabit(goal)) return { done: 0, total: 0, pct: 0 };
    var total = goal.steps.length;
    var done = goal.steps.filter(function (s) {
      return s.done;
    }).length;
    var pct = total === 0 ? (goal.completedAt ? 100 : 0) : Math.round((done / total) * 100);
    return { done: done, total: total, pct: pct };
  }

  function isGoalComplete(goal) {
    if (isHabit(goal)) return false; // ongoing by design, never "complete"
    if (goal.steps.length === 0) return !!goal.completedAt;
    return goal.steps.every(function (s) {
      return s.done;
    });
  }

  function isOverdue(goal) {
    if (!goal.deadline || goal.completedAt) return false;
    var today = new Date();
    var todayKey = today.getFullYear() + "-" +
      String(today.getMonth() + 1).padStart(2, "0") + "-" +
      String(today.getDate()).padStart(2, "0");
    return goal.deadline < todayKey;
  }

  function overallStats(goals) {
    var active = goals.filter(function (g) {
      return !g.archived;
    });
    var completed = active.filter(function (g) {
      return isGoalComplete(g);
    });
    var inProgress = active.filter(function (g) {
      return !isGoalComplete(g);
    });

    var totalSteps = 0;
    var doneSteps = 0;
    active.forEach(function (g) {
      var p = goalProgress(g);
      totalSteps += p.total;
      doneSteps += p.done;
    });

    var overallPct = totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100);

    return {
      totalGoals: active.length,
      activeGoals: inProgress.length,
      completedGoals: completed.length,
      overallPct: overallPct
    };
  }

  function nextUpItems(goals, limit) {
    limit = limit || 5;
    var items = [];
    var today = window.App.Streaks.todayKey();
    var active = goals
      .filter(function (g) {
        return !g.archived && !isGoalComplete(g);
      })
      .sort(function (a, b) {
        if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
      });

    active.forEach(function (g) {
      if (isHabit(g)) {
        var checkedToday = g.habit && g.habit.log.indexOf(today) !== -1;
        if (!checkedToday) items.push({ kind: "checkin", goal: g });
        return;
      }
      var nextStep = g.steps.find(function (s) {
        return !s.done;
      });
      if (nextStep) {
        items.push({ kind: "step", goal: g, step: nextStep });
      }
    });

    return items.slice(0, limit);
  }

  window.App = window.App || {};
  window.App.Models = {
    COLOR_PALETTE: COLOR_PALETTE,
    makeId: makeId,
    nowISO: nowISO,
    createGoal: createGoal,
    createStep: createStep,
    isHabit: isHabit,
    toggleHabitCheckIn: toggleHabitCheckIn,
    goalProgress: goalProgress,
    isGoalComplete: isGoalComplete,
    isOverdue: isOverdue,
    overallStats: overallStats,
    nextUpItems: nextUpItems
  };
})();
