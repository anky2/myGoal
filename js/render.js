(function () {
  "use strict";

  var M = null; // App.Models, bound lazily since script load order matters
  function models() {
    if (!M) M = window.App.Models;
    return M;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function fmtDeadline(dateKey) {
    if (!dateKey) return "";
    var parts = dateKey.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function setProgressBar(barEl, pct, color) {
    var fill = barEl.querySelector(".progress-bar-fill");
    fill.style.width = pct + "%";
    if (color) fill.style.background = color;
  }

  function buildMiniHeatmap(logDates, days, large) {
    var Streaks = window.App.Streaks;
    var grid = Streaks.activityGrid(logDates, days);
    var wrap = document.createElement("div");
    wrap.className = "mini-heatmap" + (large ? " large" : "");
    grid.forEach(function (active) {
      var dot = document.createElement("span");
      dot.className = "mini-heatmap-dot" + (active ? " active" : "");
      wrap.appendChild(dot);
    });
    return wrap;
  }

  // ---------- Dashboard ----------

  function renderDashboard(root, state) {
    clear(root);
    var Models = models();
    var stats = Models.overallStats(state.goals);

    var statRow = document.createElement("div");
    statRow.className = "stat-row";
    [
      { value: stats.totalGoals, label: "Total Goals" },
      { value: stats.activeGoals, label: "Active" },
      { value: stats.completedGoals, label: "Completed" },
      { value: stats.overallPct + "%", label: "Overall Progress" },
      { value: state.streak.current, label: "Current Streak" },
      { value: state.streak.longest, label: "Longest Streak" }
    ].forEach(function (s) {
      var tile = document.createElement("div");
      tile.className = "stat-tile";
      var v = document.createElement("div");
      v.className = "stat-tile-value";
      v.textContent = String(s.value);
      var l = document.createElement("div");
      l.className = "stat-tile-label";
      l.textContent = s.label;
      tile.appendChild(v);
      tile.appendChild(l);
      statRow.appendChild(tile);
    });
    root.appendChild(statRow);

    var nextTitle = document.createElement("h2");
    nextTitle.className = "section-title";
    nextTitle.textContent = "What's next";
    root.appendChild(nextTitle);

    var nextPanel = document.createElement("div");
    nextPanel.className = "next-panel";
    var nextItems = Models.nextUpItems(state.goals, 5);

    if (nextItems.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = state.goals.length === 0
        ? "Add a goal below to get started."
        : "Nothing left to do — nice!";
      nextPanel.appendChild(empty);
    } else {
      var list = document.createElement("ul");
      list.className = "next-list";
      nextItems.forEach(function (item) {
        var tmpl = document.getElementById("tmpl-next-item");
        var node = tmpl.content.cloneNode(true);
        var li = node.querySelector(".next-item");
        var checkbox = node.querySelector(".next-item-checkbox");
        var stepText = node.querySelector(".next-item-step");
        var goalLink = node.querySelector(".next-item-goal");

        stepText.textContent = item.kind === "checkin" ? "Check in today" : item.step.title;
        goalLink.textContent = item.goal.title;
        goalLink.href = "#/goal/" + item.goal.id;
        checkbox.dataset.kind = item.kind;
        checkbox.dataset.goalId = item.goal.id;
        if (item.kind === "step") checkbox.dataset.stepId = item.step.id;

        list.appendChild(li);
      });
      nextPanel.appendChild(list);
    }
    root.appendChild(nextPanel);

    var toolbar = document.createElement("div");
    toolbar.className = "goals-toolbar";

    var filters = document.createElement("div");
    filters.className = "goals-toolbar-filters";
    [
      { key: "all", label: "All" },
      { key: "active", label: "Active" },
      { key: "completed", label: "Completed" },
      { key: "archived", label: "Archived" }
    ].forEach(function (f) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.ui.goalFilter === f.key ? " active" : "");
      chip.textContent = f.label;
      chip.dataset.filter = f.key;
      filters.appendChild(chip);
    });
    toolbar.appendChild(filters);

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-primary";
    addBtn.id = "btn-new-goal";
    addBtn.textContent = "+ New Goal";
    toolbar.appendChild(addBtn);

    root.appendChild(toolbar);

    var filtered = state.goals.filter(function (g) {
      var complete = Models.isGoalComplete(g);
      switch (state.ui.goalFilter) {
        case "active":
          return !g.archived && !complete;
        case "completed":
          return !g.archived && complete;
        case "archived":
          return g.archived;
        default:
          return true;
      }
    });

    if (filtered.length === 0) {
      var emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      if (state.goals.length === 0) {
        emptyState.innerHTML = "";
        var h2 = document.createElement("h2");
        h2.textContent = "No goals yet";
        var p = document.createElement("p");
        p.textContent = "Break down what you want to achieve into steps, and start checking them off.";
        emptyState.appendChild(h2);
        emptyState.appendChild(p);
      } else {
        var h2b = document.createElement("h2");
        h2b.textContent = "Nothing here";
        emptyState.appendChild(h2b);
      }
      root.appendChild(emptyState);
    } else {
      var grid = document.createElement("div");
      grid.className = "goals-grid";
      filtered.forEach(function (goal) {
        grid.appendChild(renderGoalCard(goal));
      });
      root.appendChild(grid);
    }
  }

  function renderGoalCard(goal) {
    var Models = models();
    var Streaks = window.App.Streaks;
    var tmpl = document.getElementById("tmpl-goal-card");
    var node = tmpl.content.cloneNode(true);
    var card = node.querySelector(".goal-card");
    var accent = node.querySelector(".goal-card-accent");
    var title = node.querySelector(".goal-card-title");
    var desc = node.querySelector(".goal-card-desc");
    var progressWrap = node.querySelector(".goal-card-progress");
    var metaWrap = node.querySelector(".goal-card-meta");

    var isHabit = Models.isHabit(goal);

    card.dataset.goalId = goal.id;
    accent.style.background = goal.color;
    title.textContent = goal.title;

    if (goal.description) {
      desc.textContent = goal.description;
    } else {
      desc.remove();
    }

    node.querySelector(".btn-edit-goal").dataset.goalId = goal.id;
    node.querySelector(".btn-archive-goal").dataset.goalId = goal.id;
    node.querySelector(".btn-archive-goal").textContent = goal.archived ? "↩️" : "📦";
    node.querySelector(".btn-archive-goal").title = goal.archived ? "Unarchive goal" : "Archive goal";
    node.querySelector(".btn-delete-goal").dataset.goalId = goal.id;

    if (isHabit) {
      card.classList.add("is-habit");

      var habitBadge = document.createElement("span");
      habitBadge.className = "habit-badge";
      habitBadge.textContent = "Habit";
      title.appendChild(habitBadge);

      var log = (goal.habit && goal.habit.log) || [];
      var streakInfo = Streaks.habitStreak(log);
      var checkedToday = log.indexOf(Streaks.todayKey()) !== -1;

      clear(progressWrap);
      var streakLine = document.createElement("div");
      streakLine.className = "habit-streak-line";
      streakLine.textContent = "🔥 " + streakInfo.current + (streakInfo.current === 1 ? " day streak" : " day streak");
      progressWrap.appendChild(streakLine);
      progressWrap.appendChild(buildMiniHeatmap(log, 7));

      clear(metaWrap);
      var checkinLabel = document.createElement("label");
      checkinLabel.className = "card-checkin";
      var checkinBox = document.createElement("input");
      checkinBox.type = "checkbox";
      checkinBox.className = "habit-checkin-checkbox";
      checkinBox.checked = checkedToday;
      checkinBox.dataset.goalId = goal.id;
      checkinLabel.appendChild(checkinBox);
      checkinLabel.appendChild(document.createTextNode(checkedToday ? "Checked in today" : "Check in today"));
      metaWrap.appendChild(checkinLabel);
    } else {
      var bar = progressWrap.querySelector(".progress-bar");
      var label = progressWrap.querySelector(".goal-card-progress-label");
      var stepsEl = metaWrap.querySelector(".goal-card-steps");
      var deadlineEl = metaWrap.querySelector(".goal-card-deadline");

      var progress = Models.goalProgress(goal);
      var complete = Models.isGoalComplete(goal);

      if (complete) {
        card.classList.add("is-complete");
        var doneBadge = document.createElement("span");
        doneBadge.className = "goal-complete-badge";
        doneBadge.textContent = "Done";
        title.appendChild(doneBadge);
      }

      setProgressBar(bar, progress.pct, goal.color);
      label.textContent = progress.pct + "%";

      stepsEl.textContent = progress.total === 0
        ? (complete ? "Marked complete" : "No steps yet")
        : progress.done + " of " + progress.total + " steps";

      if (goal.deadline) {
        deadlineEl.textContent = "Due " + fmtDeadline(goal.deadline);
        if (Models.isOverdue(goal)) deadlineEl.classList.add("overdue");
      } else {
        deadlineEl.remove();
      }
    }

    return card;
  }

  // ---------- Goal detail ----------

  function renderGoalDetail(root, state, goalId) {
    clear(root);
    var Models = models();
    var goal = state.goals.find(function (g) {
      return g.id === goalId;
    });

    if (!goal) {
      var notFound = document.createElement("div");
      notFound.className = "empty-state";
      var h2 = document.createElement("h2");
      h2.textContent = "Goal not found";
      var back = document.createElement("a");
      back.href = "#/";
      back.textContent = "Back to dashboard";
      notFound.appendChild(h2);
      notFound.appendChild(back);
      root.appendChild(notFound);
      return;
    }

    var backLink = document.createElement("a");
    backLink.className = "back-link";
    backLink.href = "#/";
    backLink.textContent = "← Back to dashboard";
    root.appendChild(backLink);

    var Streaks = window.App.Streaks;
    var isHabit = Models.isHabit(goal);
    var progress = Models.goalProgress(goal);
    var complete = Models.isGoalComplete(goal);

    var header = document.createElement("div");
    header.className = "goal-detail-header";

    var top = document.createElement("div");
    top.className = "goal-detail-top";

    var titleWrap = document.createElement("div");
    var titleEl = document.createElement("h1");
    titleEl.className = "goal-detail-title";
    titleEl.textContent = goal.title;
    if (isHabit) {
      var habitBadge = document.createElement("span");
      habitBadge.className = "habit-badge";
      habitBadge.textContent = "Habit";
      titleEl.appendChild(habitBadge);
    } else if (complete) {
      var badge = document.createElement("span");
      badge.className = "goal-complete-badge";
      badge.textContent = "Done";
      titleEl.appendChild(badge);
    }
    titleWrap.appendChild(titleEl);

    if (goal.description) {
      var descEl = document.createElement("p");
      descEl.className = "goal-detail-desc";
      descEl.textContent = goal.description;
      titleWrap.appendChild(descEl);
    }

    var meta = document.createElement("div");
    meta.className = "goal-detail-meta";
    if (goal.category) {
      var cat = document.createElement("span");
      cat.textContent = "📁 " + goal.category;
      meta.appendChild(cat);
    }
    if (goal.deadline) {
      var dl = document.createElement("span");
      dl.textContent = "📅 Due " + fmtDeadline(goal.deadline);
      if (Models.isOverdue(goal)) dl.classList.add("overdue");
      meta.appendChild(dl);
    }
    var created = document.createElement("span");
    created.textContent = "Started " + fmtDate(goal.createdAt);
    meta.appendChild(created);
    titleWrap.appendChild(meta);

    top.appendChild(titleWrap);

    var actions = document.createElement("div");
    actions.className = "goal-detail-actions";
    var editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.id = "btn-edit-goal-detail";
    editBtn.type = "button";
    editBtn.title = "Edit goal";
    editBtn.textContent = "✏️";
    editBtn.dataset.goalId = goal.id;
    var archiveBtn = document.createElement("button");
    archiveBtn.className = "icon-btn";
    archiveBtn.id = "btn-archive-goal-detail";
    archiveBtn.type = "button";
    archiveBtn.title = goal.archived ? "Unarchive goal" : "Archive goal";
    archiveBtn.textContent = goal.archived ? "↩️" : "📦";
    archiveBtn.dataset.goalId = goal.id;
    var deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.id = "btn-delete-goal-detail";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete goal";
    deleteBtn.textContent = "🗑️";
    deleteBtn.dataset.goalId = goal.id;
    actions.appendChild(editBtn);
    actions.appendChild(archiveBtn);
    actions.appendChild(deleteBtn);
    top.appendChild(actions);

    header.appendChild(top);

    if (isHabit) {
      var log = (goal.habit && goal.habit.log) || [];
      var streakInfo = Streaks.habitStreak(log);
      var checkedToday = log.indexOf(Streaks.todayKey()) !== -1;

      var streakRow = document.createElement("div");
      streakRow.className = "habit-detail-streak-row";
      [
        { value: streakInfo.current, label: "Current streak" },
        { value: streakInfo.longest, label: "Longest streak" }
      ].forEach(function (s) {
        var tile = document.createElement("div");
        tile.className = "stat-tile";
        var v = document.createElement("div");
        v.className = "stat-tile-value";
        v.textContent = String(s.value);
        var l = document.createElement("div");
        l.className = "stat-tile-label";
        l.textContent = s.label;
        tile.appendChild(v);
        tile.appendChild(l);
        streakRow.appendChild(tile);
      });
      header.appendChild(streakRow);

      var checkinBtn = document.createElement("button");
      checkinBtn.type = "button";
      checkinBtn.id = "btn-checkin-detail";
      checkinBtn.className = "btn-checkin-large" + (checkedToday ? " checked" : "");
      checkinBtn.dataset.goalId = goal.id;
      checkinBtn.textContent = checkedToday ? "✓ Checked in today" : "Check in today";
      header.appendChild(checkinBtn);

      root.appendChild(header);

      var heatmapSection = document.createElement("div");
      heatmapSection.className = "steps-section";
      var heatmapTitle = document.createElement("h2");
      heatmapTitle.className = "section-title";
      heatmapTitle.textContent = "Last 28 days";
      heatmapSection.appendChild(heatmapTitle);
      heatmapSection.appendChild(buildMiniHeatmap(log, 28, true));
      root.appendChild(heatmapSection);
      return;
    }

    var progressRow = document.createElement("div");
    progressRow.className = "goal-detail-progress-row";
    var bar = document.createElement("div");
    bar.className = "progress-bar large";
    var fill = document.createElement("div");
    fill.className = "progress-bar-fill";
    bar.appendChild(fill);
    var progLabel = document.createElement("span");
    progLabel.className = "goal-detail-progress-label";
    progressRow.appendChild(bar);
    progressRow.appendChild(progLabel);
    header.appendChild(progressRow);

    setProgressBar(bar, progress.pct, goal.color);
    progLabel.textContent = progress.total > 0
      ? progress.pct + "% — " + progress.done + " of " + progress.total + " steps"
      : (complete ? "100% complete" : "0% complete");

    if (progress.total === 0) {
      var zeroWrap = document.createElement("div");
      zeroWrap.className = "zero-step-toggle";
      var zeroCheckbox = document.createElement("input");
      zeroCheckbox.type = "checkbox";
      zeroCheckbox.id = "zero-step-complete";
      zeroCheckbox.checked = complete;
      var zeroLabel = document.createElement("label");
      zeroLabel.htmlFor = "zero-step-complete";
      zeroLabel.textContent = "Mark this goal complete";
      zeroWrap.appendChild(zeroCheckbox);
      zeroWrap.appendChild(zeroLabel);
      header.appendChild(zeroWrap);
    }

    root.appendChild(header);

    var stepsSection = document.createElement("div");
    stepsSection.className = "steps-section";
    var stepsTitle = document.createElement("h2");
    stepsTitle.className = "section-title";
    stepsTitle.textContent = "Steps";
    stepsSection.appendChild(stepsTitle);

    var stepsList = document.createElement("ul");
    stepsList.className = "steps-list";
    goal.steps.forEach(function (step, idx) {
      stepsList.appendChild(renderStepRow(step, idx, goal.steps.length));
    });
    stepsSection.appendChild(stepsList);

    var addRow = document.createElement("div");
    addRow.className = "add-step-row";
    var addInput = document.createElement("input");
    addInput.type = "text";
    addInput.id = "add-step-input";
    addInput.placeholder = "Add a step…";
    var addBtn = document.createElement("button");
    addBtn.className = "btn-primary";
    addBtn.id = "btn-add-step";
    addBtn.type = "button";
    addBtn.textContent = "Add";
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    stepsSection.appendChild(addRow);

    root.appendChild(stepsSection);
  }

  function renderStepRow(step, idx, total) {
    var tmpl = document.getElementById("tmpl-step-row");
    var node = tmpl.content.cloneNode(true);
    var li = node.querySelector(".step-row");
    var checkbox = node.querySelector(".step-checkbox");
    var titleEl = node.querySelector(".step-title");
    var completedDate = node.querySelector(".step-completed-date");
    var upBtn = node.querySelector(".btn-step-up");
    var downBtn = node.querySelector(".btn-step-down");
    var delBtn = node.querySelector(".btn-step-delete");

    li.dataset.stepId = step.id;
    if (step.done) li.classList.add("done");

    checkbox.checked = step.done;
    checkbox.dataset.stepId = step.id;

    titleEl.textContent = step.title;
    titleEl.dataset.stepId = step.id;
    titleEl.contentEditable = "true";

    if (step.done && step.completedAt) {
      completedDate.textContent = "Done " + fmtDate(step.completedAt);
    } else {
      completedDate.remove();
    }

    upBtn.dataset.stepId = step.id;
    downBtn.dataset.stepId = step.id;
    delBtn.dataset.stepId = step.id;
    if (idx === 0) upBtn.disabled = true;
    if (idx === total - 1) downBtn.disabled = true;

    return li;
  }

  window.App = window.App || {};
  window.App.Render = {
    renderDashboard: renderDashboard,
    renderGoalDetail: renderGoalDetail,
    setProgressBar: setProgressBar,
    fmtDate: fmtDate,
    fmtDeadline: fmtDeadline
  };
})();
