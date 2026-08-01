# Goals Tracker

A local, offline goals tracker: break each goal down into the steps needed to
achieve it, check them off one by one, and get a small celebration (confetti +
progress bar + streak) along the way.

## How to open it

No install, no server, no build step required.

- **Easiest**: double-click `index.html` (or right-click → Open with → your browser).
- Works fully offline — it makes zero network requests.

## How your data is stored

Everything (goals, steps, streak, settings) is saved in your browser's
`localStorage`, under the key `goalsTracker.v1`. That means:

- Data stays on this computer, in this specific browser.
- Clearing your browser's site data/history for this page will delete it.
- Opening `index.html` in a different browser (or in a private/incognito
  window) starts with an empty tracker.

## Back up or reset your data

Open the browser DevTools console (F12) on the page and run:

- **Back up** — copy this output somewhere safe:
  ```js
  copy(localStorage.getItem("goalsTracker.v1"))
  ```
- **Restore** from a backup string you saved earlier:
  ```js
  localStorage.setItem("goalsTracker.v1", /* paste your backup string here */)
  ```
- **Reset everything**:
  ```js
  localStorage.removeItem("goalsTracker.v1")
  ```
  then reload the page.

## Features

- Two kinds of goals, chosen when you create one:
  - **Milestone** — has a concrete checklist of steps and a finish line
    (e.g. "Run a half marathon"). Progress bar per goal, done when all steps
    are checked.
  - **Habit** — ongoing, no fixed steps (e.g. "Gym", "Sleep schedule fix").
    Tracked with a daily "check in" instead, its own streak, and a 28-day
    activity heatmap. Never marked "complete" — the point is consistency.
- Dashboard with overall stats and a "what's next" panel (next undone step,
  or a check-in reminder, per goal)
- Confetti + toast when you complete a step or check in, a bigger celebration
  modal when you complete a whole milestone goal, and a streak-milestone toast
  at 3/7/14/30/50/100 days (app-wide or per-habit)
- Daily activity streak (breaks if you skip a day)
- Light/dark/system theme toggle
