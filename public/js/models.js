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

  // Coerces a goal/step object of unknown origin (e.g. pulled from a sync
  // peer) into the shape the rest of the app assumes, so a malformed or
  // incomplete payload degrades gracefully instead of throwing later when
  // code reads goal.steps, goal.habit.log, etc.
  function sanitizeStep(raw) {
    if (!raw || typeof raw !== "object") raw = {};
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      title: typeof raw.title === "string" ? raw.title : "",
      notes: typeof raw.notes === "string" ? raw.notes : "",
      done: !!raw.done,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowISO(),
      completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null
    };
  }

  function sanitizeGoal(raw) {
    if (!raw || typeof raw !== "object") return null;
    var type = raw.type === "habit" ? "habit" : "milestone";
    var steps = Array.isArray(raw.steps) ? raw.steps.map(sanitizeStep) : [];
    var log = type === "habit" && raw.habit && Array.isArray(raw.habit.log)
      ? raw.habit.log.filter(function (d) { return typeof d === "string"; })
      : [];
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      type: type,
      title: typeof raw.title === "string" ? raw.title : "",
      description: typeof raw.description === "string" ? raw.description : "",
      category: typeof raw.category === "string" ? raw.category : "",
      color: typeof raw.color === "string" ? raw.color : COLOR_PALETTE[0],
      deadline: type === "habit" ? null : (typeof raw.deadline === "string" ? raw.deadline : null),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowISO(),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowISO(),
      completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
      archived: !!raw.archived,
      steps: steps,
      habit: type === "habit" ? { log: log } : null
    };
  }

  function sanitizeGoals(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList.map(sanitizeGoal).filter(function (g) {
      return g !== null;
    });
  }

  function sanitizeStreak(raw, fallback) {
    if (!raw || typeof raw !== "object") return fallback;
    return {
      current: typeof raw.current === "number" ? raw.current : 0,
      longest: typeof raw.longest === "number" ? raw.longest : 0,
      lastActivityDate: typeof raw.lastActivityDate === "string" ? raw.lastActivityDate : null,
      activityDates: Array.isArray(raw.activityDates)
        ? raw.activityDates.filter(function (d) { return typeof d === "string"; })
        : []
    };
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
    sanitizeGoal: sanitizeGoal,
    sanitizeGoals: sanitizeGoals,
    sanitizeStreak: sanitizeStreak,
    toggleHabitCheckIn: toggleHabitCheckIn,
    goalProgress: goalProgress,
    isGoalComplete: isGoalComplete,
    isOverdue: isOverdue,
    overallStats: overallStats,
    nextUpItems: nextUpItems
  };
})();
