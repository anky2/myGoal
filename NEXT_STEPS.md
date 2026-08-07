# Play Store publishing — remaining manual steps

## Status

- ✅ Web app hosted on Firebase Hosting: `https://mygoal-8876d.web.app/`
- ✅ Android package ID: `app.web.mygoal_8876d.twa` (permanent)
- ✅ `bubblewrap build` succeeded → `app-release-bundle.aab` (repo root).
  Keystore `android.keystore` — **make sure it's backed up outside this repo**,
  along with its password.
- ✅ `.well-known/assetlinks.json` deployed and verified.
- ✅ Firestore rules tightened (schema-validated writes, collection listing
  blocked — only single-doc-by-code reads are allowed).
- ✅ Google Play Developer account: **approved**.
- ✅ Store assets ready (see below).

## Store assets, ready to upload

| Asset | File |
|---|---|
| App name | `Goals: Habit & Goal Tracker` (27 chars, fits Play's 30-char limit) |
| App icon | `public/icons/icon-512.png` |
| Feature graphic (1024×500) | `store-assets/feature-graphic.png` |
| Screenshots (7) | `store-assets/mygoal-8876d.web.app_(Pixel 7)*.png` |
| Short description | "Break goals into steps, build daily habit streaks, sync across devices." |
| Privacy policy URL | `https://mygoal-8876d.web.app/privacy.html` |
| App bundle to upload | `app-release-bundle.aab` (repo root) |

Full description draft:
> Goals Tracker helps you turn what you want to achieve into a simple, visual checklist — and keeps you consistent with daily habits.
>
> MILESTONE GOALS
> Break a goal down into concrete steps (e.g. "Run a half marathon"), check them off one by one, and watch your progress bar fill in. Set an optional deadline and get a clear overdue indicator if you fall behind.
>
> HABIT GOALS
> For ongoing habits (e.g. "Gym", "Sleep schedule"), check in once a day instead of tracking steps. Goals Tracker keeps a running streak and a 28-day activity heatmap so you can see your consistency at a glance.
>
> STAY MOTIVATED
> A dashboard shows your overall progress, a "what's next" panel highlighting exactly what to do today, and small celebrations along the way, including streak milestones at 3, 7, 14, 30, 50, and 100 days.
>
> SYNC ACROSS DEVICES (OPTIONAL)
> Turn on sync with one tap to keep your goals up to date across your phone and other devices, using a private code only you have. Sync is entirely optional — the app works fully offline without it.
>
> PRIVATE BY DESIGN
> No account or sign-up required. No ads. No analytics or tracking of any kind. Your data stays on your device unless you choose to enable sync.
>
> Free, simple, and built to help you actually follow through.

## Step-by-step

### 1. Create the app
Play Console → **Create app**:
- App name: `Goals: Habit & Goal Tracker`
- Default language: English
- App or game: **App** · Free or paid: **Free**
- Tick both declaration checkboxes → Create app

### 2. Store listing
Under **Grow → Store presence → Main store listing**, fill in the short/full
description above, upload the icon, feature graphic, and all 7 screenshots
from the table above. Category: Productivity (or Lifestyle/Health & Fitness).

### 3. App content
Under **Grow → Store presence → App content** (or similarly named section):
- **Privacy policy**: `https://mygoal-8876d.web.app/privacy.html`
- **Ads**: No ads
- **App access**: all functionality available without special access
- **Content rating questionnaire**: answer honestly → expect "Everyone"
- **Target audience**: not primarily for children
- **Data safety**: sync is optional, collects only user-entered goal/step
  text, purpose "App functionality", not shared with third parties,
  encrypted in transit, no ads/analytics SDKs
- News/Government/Financial features sections: not applicable, skip

### 4. Internal testing release
**Testing → Internal testing → Create new release**:
- Upload `app-release-bundle.aab`
- Add release notes (e.g. "Initial release")
- Add your own email under **Testers**
- Save → Review release → **Start rollout to Internal testing**
- Install via the internal testing opt-in link on your phone. Confirm: no
  browser address bar, and sync still works between the app and the website.

### 5. Promote to Production
Once verified on a real device: **Production → Promote release from
Internal testing** (or create a new Production release with the same
`.aab`), add release notes, submit. First-time review: a few hours to a
couple of days.

## After the first Production upload — second assetlinks.json fingerprint

Play Console re-signs your app with its own key. Go to Play Console → your
app → Setup → App integrity → copy the **App signing key certificate
SHA-256**, then add it as a second entry in
`public/.well-known/assetlinks.json`:

```json
"sha256_cert_fingerprints": [
  "57:C5:AF:E4:CF:47:24:E2:BC:01:B0:82:50:B7:B8:15:7A:42:FD:F2:0B:00:6C:9A:78:DA:69:20:CB:C3:A6:8D",
  "<PLAY-APP-SIGNING-KEY-SHA256>"
]
```
Redeploy: `firebase deploy --only hosting`. Needed once, not on every future
release.

## Ongoing

- Editing anything in `public/` and running `firebase deploy --only hosting`
  updates the Play Store app instantly for everyone — no re-submission
  needed (the service worker is network-first specifically to preserve this).
- Re-submission is only needed for native-shell changes (icon, name, splash
  color) or a `targetSdkVersion` bump — `bubblewrap update && bubblewrap
  build`, then upload the new `.aab`. Roughly once a year.
- Optional: connect a custom domain to Firebase Hosting later if you'd
  rather have a branded URL than `mygoal-8876d.web.app` (~$10–15/year for
  the domain itself; Hosting stays free).
