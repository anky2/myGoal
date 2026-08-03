(function () {
  "use strict";

  var Storage = window.App.Storage;
  var Models = window.App.Models;
  var Streaks = window.App.Streaks;
  var Celebrate = window.App.Celebrate;
  var Render = window.App.Render;
  var Sync = window.App.Sync;

  var state = Storage.load();
  if (!state.ui) state.ui = { goalFilter: "all" };
  window.App.state = state;

  var viewRoot = document.getElementById("view-root");
  var modal = document.getElementById("app-modal");
  var modalContent = document.getElementById("app-modal-content");
  var streakBadge = document.getElementById("streak-badge");
  var streakCount = document.getElementById("streak-count");

  // Saves locally and, if this device is paired, pushes to the sync doc.
  // Use for any change a person on THIS device makes.
  function persist() {
    Storage.save(state);
    if (Sync && state.settings.syncCode) {
      Sync.push(state.settings.syncCode, state);
    }
  }

  // Saves locally only — used when applying data that just arrived FROM
  // sync, so we don't immediately push it right back and ping-pong.
  function persistLocalOnly() {
    Storage.save(state);
  }

  // remoteData comes from another device via Firestore — never trust its
  // shape. Sanitize before applying so a malformed or incomplete payload
  // can't crash the view.
  function handleRemoteUpdate(remoteData) {
    if (!remoteData || typeof remoteData !== "object") return;
    state.goals = Models.sanitizeGoals(remoteData.goals);
    state.streak = Models.sanitizeStreak(remoteData.streak, state.streak);
    persistLocalOnly();
    renderCurrentView();
  }

  function findGoal(goalId) {
    return state.goals.find(function (g) {
      return g.id === goalId;
    });
  }

  function findStep(goal, stepId) {
    return goal.steps.find(function (s) {
      return s.id === stepId;
    });
  }

  // ---------- Routing ----------

  function parseRoute() {
    var hash = window.location.hash || "#/";
    var m = hash.match(/^#\/goal\/(.+)$/);
    if (m) return { view: "goal", id: decodeURIComponent(m[1]) };
    return { view: "dashboard" };
  }

  function renderCurrentView() {
    var route = parseRoute();
    if (route.view === "goal") {
      Render.renderGoalDetail(viewRoot, state, route.id);
    } else {
      Render.renderDashboard(viewRoot, state);
    }
    renderStreakBadge(false);
    renderSyncDot();
  }

  window.addEventListener("hashchange", renderCurrentView);

  // ---------- Streak badge ----------

  function renderStreakBadge(pulse) {
    streakCount.textContent = String(state.streak.current);
    streakBadge.classList.toggle("active", state.streak.current > 0);
    streakBadge.title = state.streak.longest > 0
      ? "Current: " + state.streak.current + " · Longest: " + state.streak.longest
      : "Complete a step to start a streak";
    if (pulse) {
      streakBadge.classList.remove("pulse");
      // force reflow so the animation can restart
      void streakBadge.offsetWidth;
      streakBadge.classList.add("pulse");
    }
  }

  // ---------- Theme ----------

  function applyTheme() {
    var theme = state.settings.theme || "system";
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  document.getElementById("theme-toggle").addEventListener("click", function () {
    var order = ["system", "light", "dark"];
    var idx = order.indexOf(state.settings.theme || "system");
    state.settings.theme = order[(idx + 1) % order.length];
    applyTheme();
    persist();
  });

  // ---------- Sync ----------

  function renderSyncDot() {
    var dot = document.getElementById("sync-dot");
    if (dot) dot.classList.toggle("on", !!state.settings.syncCode);
  }

  function openSyncModal() {
    openModal(function (content) {
      var title = document.createElement("h2");
      title.className = "modal-title";
      title.textContent = "Sync across devices";
      content.appendChild(title);

      if (!Sync || !Sync.isConfigured()) {
        var msg = document.createElement("p");
        msg.textContent = "Sync isn't set up in this build yet.";
        content.appendChild(msg);
        return;
      }

      if (state.settings.syncCode) {
        renderPairedView(content, state.settings.syncCode);
      } else {
        renderUnpairedView(content);
      }
    });
  }

  function renderPairedView(content, code) {
    var statusLine = document.createElement("div");
    statusLine.className = "sync-status-line";
    var dot = document.createElement("span");
    dot.className = "sync-dot on";
    statusLine.appendChild(dot);
    statusLine.appendChild(document.createTextNode("This device is synced"));
    content.appendChild(statusLine);

    var p = document.createElement("p");
    p.textContent = "Enter this same code on your other device to connect it:";
    content.appendChild(p);

    var codeDisplay = document.createElement("div");
    codeDisplay.className = "sync-code-display";
    codeDisplay.textContent = code;
    content.appendChild(codeDisplay);

    var hr = document.createElement("hr");
    hr.className = "sync-divider";
    content.appendChild(hr);

    var actions = document.createElement("div");
    actions.className = "form-actions";
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-secondary";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", closeModal);
    var stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "btn-danger";
    stopBtn.textContent = "Stop syncing this device";
    stopBtn.addEventListener("click", function () {
      Sync.stop();
      state.settings.syncCode = null;
      persistLocalOnly();
      renderSyncDot();
      closeModal();
    });
    actions.appendChild(closeBtn);
    actions.appendChild(stopBtn);
    content.appendChild(actions);
  }

  function renderUnpairedView(content) {
    var p1 = document.createElement("p");
    p1.textContent = "Set up sync once on your first device, then connect any others with the code it gives you.";
    content.appendChild(p1);

    var createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = "btn-primary";
    createBtn.style.width = "100%";
    createBtn.textContent = "Set up sync on this device";
    createBtn.addEventListener("click", function () {
      createBtn.disabled = true;
      createBtn.textContent = "Setting up…";
      Sync.createCode(state, function (err, code) {
        if (err) {
          createBtn.disabled = false;
          createBtn.textContent = "Set up sync on this device";
          showInlineError(content, err.message);
          return;
        }
        state.settings.syncCode = code;
        persistLocalOnly();
        Sync.start(code, handleRemoteUpdate);
        renderSyncDot();
        modalContent.innerHTML = "";
        var freshTitle = document.createElement("h2");
        freshTitle.className = "modal-title";
        freshTitle.textContent = "Sync across devices";
        modalContent.appendChild(freshTitle);
        renderPairedView(modalContent, code);
      });
    });
    content.appendChild(createBtn);

    var hr = document.createElement("hr");
    hr.className = "sync-divider";
    content.appendChild(hr);

    var p2 = document.createElement("p");
    p2.textContent = "Already set up sync on another device? Enter its code here:";
    content.appendChild(p2);

    var row = document.createElement("div");
    row.className = "add-step-row";
    var codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.placeholder = "e.g. 7K4M9XPQ";
    codeInput.style.textTransform = "uppercase";
    var connectBtn = document.createElement("button");
    connectBtn.type = "button";
    connectBtn.className = "btn-primary";
    connectBtn.textContent = "Connect";
    row.appendChild(codeInput);
    row.appendChild(connectBtn);
    content.appendChild(row);

    connectBtn.addEventListener("click", function () {
      var code = codeInput.value.trim().toUpperCase();
      if (!code) return;
      connectBtn.disabled = true;
      connectBtn.textContent = "Connecting…";
      Sync.fetchOnce(code, function (err, remoteData) {
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect";
        if (err) {
          showInlineError(content, err.message);
          return;
        }
        var proceed = function () {
          state.goals = Models.sanitizeGoals(remoteData && remoteData.goals);
          state.streak = Models.sanitizeStreak(remoteData && remoteData.streak, state.streak);
          state.settings.syncCode = code;
          persistLocalOnly();
          Sync.start(code, handleRemoteUpdate);
          renderSyncDot();
          renderCurrentView();
          closeModal();
          Celebrate.showToast("Synced! 🎉");
        };
        if (state.goals.length > 0) {
          showReplaceConfirm(state.goals.length, proceed);
        } else {
          proceed();
        }
      });
    });
  }

  function showInlineError(content, message) {
    var existing = content.querySelector(".sync-error");
    if (existing) existing.remove();
    var err = document.createElement("p");
    err.className = "sync-error";
    err.textContent = message;
    content.appendChild(err);
  }

  function showReplaceConfirm(goalCount, onConfirm) {
    modalContent.innerHTML = "";
    var title = document.createElement("h2");
    title.className = "modal-title";
    title.textContent = "Replace this device's goals?";
    modalContent.appendChild(title);

    var msg = document.createElement("p");
    msg.textContent = "This device already has " + goalCount + " goal" + (goalCount === 1 ? "" : "s") +
      ". Connecting will replace them with the synced data from your other device. This can't be undone.";
    modalContent.appendChild(msg);

    var actions = document.createElement("div");
    actions.className = "form-actions";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeModal);
    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn-danger";
    confirmBtn.textContent = "Replace and connect";
    confirmBtn.addEventListener("click", onConfirm);
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modalContent.appendChild(actions);
  }

  document.getElementById("sync-btn").addEventListener("click", openSyncModal);

  // ---------- Completion flow (shared by step checkbox + zero-step toggle) ----------

  function completeGoalIfNeeded(goal, originEl) {
    var wasComplete = !!goal.completedAt;
    var nowComplete = Models.isGoalComplete(goal);

    if (nowComplete && !wasComplete) {
      goal.completedAt = Models.nowISO();
      persist();
      Celebrate.showGoalCompleteModal(goal, { stepsCompleted: goal.steps.filter(function (s) { return s.done; }).length });
    } else if (!nowComplete && wasComplete) {
      goal.completedAt = null;
      persist();
    }
  }

  function onStepToggle(goalId, stepId, originEl) {
    var goal = findGoal(goalId);
    if (!goal) return;
    var step = findStep(goal, stepId);
    if (!step) return;

    step.done = !step.done;
    step.completedAt = step.done ? Models.nowISO() : null;
    goal.updatedAt = Models.nowISO();

    if (step.done) {
      var result = Streaks.recordActivity(state.streak);
      persist();
      Celebrate.celebrateStep(originEl);
      if (result.incremented) {
        renderStreakBadge(true);
        if (result.milestoneHit) {
          setTimeout(function () {
            Celebrate.showStreakMilestone(result.milestoneHit);
          }, 600);
        }
      }
    } else {
      persist();
    }

    completeGoalIfNeeded(goal, originEl);
    renderCurrentView();
  }

  // ---------- Habit check-in ----------

  function onHabitCheckIn(goalId, originEl) {
    var goal = findGoal(goalId);
    if (!goal || !Models.isHabit(goal)) return;

    var checkedIn = Models.toggleHabitCheckIn(goal);

    if (checkedIn) {
      var result = Streaks.recordActivity(state.streak);
      persist();
      Celebrate.celebrateStep(originEl);
      if (result.incremented) {
        renderStreakBadge(true);
        if (result.milestoneHit) {
          setTimeout(function () {
            Celebrate.showStreakMilestone(result.milestoneHit);
          }, 600);
        }
      }
      var habitStreakInfo = Streaks.habitStreak(goal.habit.log);
      if (Streaks.MILESTONES.indexOf(habitStreakInfo.current) !== -1) {
        setTimeout(function () {
          Celebrate.showHabitMilestone(goal.title, habitStreakInfo.current);
        }, 900);
      }
    } else {
      persist();
    }

    renderCurrentView();
  }

  // ---------- Modal helpers ----------

  function openModal(builder) {
    modalContent.innerHTML = "";
    builder(modalContent);
    modal.showModal();
  }

  function closeModal() {
    if (modal.open) modal.close();
  }

  function field(labelText, inputEl) {
    var wrap = document.createElement("div");
    wrap.className = "form-field";
    var label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function openGoalForm(existingGoal) {
    openModal(function (content) {
      var isEdit = !!existingGoal;
      var title = document.createElement("h2");
      title.className = "modal-title";
      title.textContent = isEdit ? "Edit Goal" : "New Goal";
      content.appendChild(title);

      var goalType = isEdit ? (existingGoal.type === "habit" ? "habit" : "milestone") : "milestone";

      var typeSelect = null;
      if (!isEdit) {
        typeSelect = document.createElement("select");
        var optMilestone = document.createElement("option");
        optMilestone.value = "milestone";
        optMilestone.textContent = "Milestone — has concrete steps to finish";
        var optHabit = document.createElement("option");
        optHabit.value = "habit";
        optHabit.textContent = "Habit — ongoing, tracked with daily check-ins";
        typeSelect.appendChild(optMilestone);
        typeSelect.appendChild(optHabit);
        content.appendChild(field("Type", typeSelect));
      }

      var titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.placeholder = "e.g. Run a half marathon";
      titleInput.value = isEdit ? existingGoal.title : "";
      content.appendChild(field("Title", titleInput));

      var descInput = document.createElement("textarea");
      descInput.placeholder = "Why does this matter to you? (optional)";
      descInput.value = isEdit ? existingGoal.description : "";
      content.appendChild(field("Description", descInput));

      var row = document.createElement("div");
      row.className = "form-row";

      var catInput = document.createElement("input");
      catInput.type = "text";
      catInput.placeholder = "e.g. Health";
      catInput.value = isEdit ? existingGoal.category : "";
      row.appendChild(field("Category", catInput));

      var deadlineInput = document.createElement("input");
      deadlineInput.type = "date";
      deadlineInput.value = isEdit && existingGoal.deadline ? existingGoal.deadline : "";
      var deadlineField = field("Deadline", deadlineInput);
      deadlineField.style.display = goalType === "habit" ? "none" : "";
      row.appendChild(deadlineField);

      content.appendChild(row);

      if (typeSelect) {
        typeSelect.addEventListener("change", function () {
          deadlineField.style.display = typeSelect.value === "habit" ? "none" : "";
        });
      }

      var swatchWrap = document.createElement("div");
      swatchWrap.className = "color-swatches";
      var selectedColor = isEdit ? existingGoal.color : Models.COLOR_PALETTE[0];
      Models.COLOR_PALETTE.forEach(function (color) {
        var swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "color-swatch" + (color === selectedColor ? " selected" : "");
        swatch.style.background = color;
        swatch.addEventListener("click", function () {
          selectedColor = color;
          swatchWrap.querySelectorAll(".color-swatch").forEach(function (s) {
            s.classList.remove("selected");
          });
          swatch.classList.add("selected");
        });
        swatchWrap.appendChild(swatch);
      });
      content.appendChild(field("Color", swatchWrap));

      var actions = document.createElement("div");
      actions.className = "form-actions";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn-secondary";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", closeModal);
      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn-primary";
      saveBtn.textContent = isEdit ? "Save changes" : "Create goal";
      saveBtn.addEventListener("click", function () {
        var titleVal = titleInput.value.trim();
        if (!titleVal) {
          titleInput.focus();
          return;
        }
        if (isEdit) {
          existingGoal.title = titleVal;
          existingGoal.description = descInput.value.trim();
          existingGoal.category = catInput.value.trim();
          existingGoal.deadline = deadlineInput.value || null;
          existingGoal.color = selectedColor;
          existingGoal.updatedAt = Models.nowISO();
        } else {
          var goal = Models.createGoal({
            type: typeSelect ? typeSelect.value : "milestone",
            title: titleVal,
            description: descInput.value.trim(),
            category: catInput.value.trim(),
            deadline: deadlineInput.value || null,
            color: selectedColor
          });
          state.goals.unshift(goal);
        }
        persist();
        closeModal();
        renderCurrentView();
      });
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      content.appendChild(actions);

      setTimeout(function () {
        titleInput.focus();
      }, 0);
    });
  }

  function openConfirmDelete(goal) {
    openModal(function (content) {
      var title = document.createElement("h2");
      title.className = "modal-title";
      title.textContent = "Delete goal?";
      content.appendChild(title);

      var msg = document.createElement("p");
      msg.textContent = "\"" + goal.title + "\" and all its steps will be permanently deleted.";
      content.appendChild(msg);

      var actions = document.createElement("div");
      actions.className = "form-actions";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn-secondary";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", closeModal);
      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", function () {
        state.goals = state.goals.filter(function (g) {
          return g.id !== goal.id;
        });
        persist();
        closeModal();
        if (parseRoute().view === "goal") {
          window.location.hash = "#/";
        } else {
          renderCurrentView();
        }
      });
      actions.appendChild(cancelBtn);
      actions.appendChild(deleteBtn);
      content.appendChild(actions);
    });
  }

  // ---------- Step mutations ----------

  function addStep(goal, titleText) {
    var text = titleText.trim();
    if (!text) return;
    goal.steps.push(Models.createStep({ title: text }));
    goal.updatedAt = Models.nowISO();
    persist();
    renderCurrentView();
  }

  function deleteStep(goal, stepId) {
    goal.steps = goal.steps.filter(function (s) {
      return s.id !== stepId;
    });
    goal.updatedAt = Models.nowISO();
    persist();
    renderCurrentView();
  }

  function moveStep(goal, stepId, dir) {
    var idx = goal.steps.findIndex(function (s) {
      return s.id === stepId;
    });
    var newIdx = idx + dir;
    if (idx === -1 || newIdx < 0 || newIdx >= goal.steps.length) return;
    var tmp = goal.steps[idx];
    goal.steps[idx] = goal.steps[newIdx];
    goal.steps[newIdx] = tmp;
    persist();
    renderCurrentView();
  }

  function renameStep(goal, stepId, newTitle) {
    var step = findStep(goal, stepId);
    if (!step) return;
    var text = newTitle.trim();
    step.title = text || step.title;
    persist();
    renderCurrentView();
  }

  // ---------- Event delegation ----------

  viewRoot.addEventListener("click", function (e) {
    var editBtn = e.target.closest(".btn-edit-goal, #btn-edit-goal-detail");
    var archiveBtn = e.target.closest(".btn-archive-goal, #btn-archive-goal-detail");
    var deleteBtn = e.target.closest(".btn-delete-goal, #btn-delete-goal-detail");
    var filterChip = e.target.closest(".chip");
    var newGoalBtn = e.target.closest("#btn-new-goal");
    var addStepBtn = e.target.closest("#btn-add-step");
    var stepUp = e.target.closest(".btn-step-up");
    var stepDown = e.target.closest(".btn-step-down");
    var stepDel = e.target.closest(".btn-step-delete");
    var checkinBtn = e.target.closest("#btn-checkin-detail");
    var cardCheckin = e.target.closest(".card-checkin");
    var card = e.target.closest(".goal-card");

    if (cardCheckin) {
      // let the checkbox's own "change" handler do the work; just stop it
      // from bubbling into the card's "navigate to detail" click below.
      e.stopPropagation();
      return;
    }
    if (editBtn) {
      e.stopPropagation();
      var g1 = findGoal(editBtn.dataset.goalId);
      if (g1) openGoalForm(g1);
      return;
    }
    if (archiveBtn) {
      e.stopPropagation();
      var g2 = findGoal(archiveBtn.dataset.goalId);
      if (g2) {
        g2.archived = !g2.archived;
        persist();
        renderCurrentView();
      }
      return;
    }
    if (deleteBtn) {
      e.stopPropagation();
      var g3 = findGoal(deleteBtn.dataset.goalId);
      if (g3) openConfirmDelete(g3);
      return;
    }
    if (filterChip) {
      state.ui.goalFilter = filterChip.dataset.filter;
      renderCurrentView();
      return;
    }
    if (newGoalBtn) {
      openGoalForm(null);
      return;
    }
    if (addStepBtn) {
      var route = parseRoute();
      var goal = findGoal(route.id);
      var input = document.getElementById("add-step-input");
      if (goal && input) addStep(goal, input.value);
      return;
    }
    if (stepUp || stepDown || stepDel) {
      var routeS = parseRoute();
      var goalS = findGoal(routeS.id);
      if (!goalS) return;
      var btn = stepUp || stepDown || stepDel;
      if (stepDel) deleteStep(goalS, btn.dataset.stepId);
      else moveStep(goalS, btn.dataset.stepId, stepUp ? -1 : 1);
      return;
    }
    if (checkinBtn) {
      onHabitCheckIn(checkinBtn.dataset.goalId, checkinBtn);
      return;
    }
    if (card) {
      window.location.hash = "#/goal/" + card.dataset.goalId;
      return;
    }
  });

  viewRoot.addEventListener("change", function (e) {
    if (e.target.classList.contains("step-checkbox")) {
      var route = parseRoute();
      var goal = findGoal(route.id);
      if (goal) onStepToggle(goal.id, e.target.dataset.stepId, e.target);
      return;
    }
    if (e.target.classList.contains("habit-checkin-checkbox")) {
      onHabitCheckIn(e.target.dataset.goalId, e.target);
      return;
    }
    if (e.target.classList.contains("next-item-checkbox")) {
      if (e.target.dataset.kind === "checkin") {
        onHabitCheckIn(e.target.dataset.goalId, e.target);
      } else {
        onStepToggle(e.target.dataset.goalId, e.target.dataset.stepId, e.target);
      }
      return;
    }
    if (e.target.id === "zero-step-complete") {
      var routeZ = parseRoute();
      var goalZ = findGoal(routeZ.id);
      if (!goalZ) return;
      var wasComplete = !!goalZ.completedAt;
      if (e.target.checked && !wasComplete) {
        goalZ.completedAt = Models.nowISO();
        var result = Streaks.recordActivity(state.streak);
        persist();
        Celebrate.showGoalCompleteModal(goalZ, { stepsCompleted: 0 });
        if (result.incremented) renderStreakBadge(true);
        renderCurrentView();
      } else if (!e.target.checked && wasComplete) {
        goalZ.completedAt = null;
        persist();
        renderCurrentView();
      }
      return;
    }
  });

  viewRoot.addEventListener("keydown", function (e) {
    if (e.target.id === "add-step-input" && e.key === "Enter") {
      e.preventDefault();
      var route = parseRoute();
      var goal = findGoal(route.id);
      if (goal) {
        addStep(goal, e.target.value);
        setTimeout(function () {
          var input = document.getElementById("add-step-input");
          if (input) input.focus();
        }, 0);
      }
      return;
    }
    if (e.target.classList.contains("step-title") && e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  });

  viewRoot.addEventListener(
    "blur",
    function (e) {
      if (e.target.classList && e.target.classList.contains("step-title")) {
        var route = parseRoute();
        var goal = findGoal(route.id);
        if (goal) renameStep(goal, e.target.dataset.stepId, e.target.textContent);
      }
    },
    true
  );

  // ---------- Init ----------

  modal.addEventListener("click", function (e) {
    if (e.target === modal) modal.close();
  });

  function init() {
    applyTheme();
    var decayed = Streaks.decayIfBroken(state.streak);
    if (decayed) persist();
    if (Sync && state.settings.syncCode && Sync.isConfigured()) {
      Sync.start(state.settings.syncCode, handleRemoteUpdate);
    }
    renderCurrentView();
  }

  init();
})();
