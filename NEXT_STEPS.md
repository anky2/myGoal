# Play Store publishing — remaining manual steps

The PWA groundwork (manifest, icons, service worker, privacy policy) is done
and lives in this repo. Everything below needs to happen on your own machine
and accounts — account signups, big SDK downloads, and passwords shouldn't
flow through an automated tool.

Hosting has moved from GitHub Pages to **Firebase Hosting**, on the same
Firebase project you already use for Firestore sync (`mygoal-8876d`). This is
a nice simplification versus before: Firebase Hosting serves from a clean
root URL (`https://mygoal-8876d.web.app/`), so the Digital Asset Links file
Android needs (`.well-known/assetlinks.json`) can just live in *this* repo
and deploy along with everything else — no separate repo required.

## 0. Deploy to Firebase Hosting

The Firebase CLI is already installed (`firebase-tools`, global npm package).
`firebase.json` and `.firebaserc` are already in this repo, pointed at
project `mygoal-8876d`.

```
firebase login
firebase deploy --only hosting
```
`firebase login` opens a browser for you to sign in with the Google account
that owns the `mygoal-8876d` project (presumably ankityadav200124@gmail.com).
After deploying, your app is live at:
- `https://mygoal-8876d.web.app/`
- `https://mygoal-8876d.firebaseapp.com/` (same site, alternate domain)

Confirm it works by opening that URL — it should be the exact same app as
before, just on a new domain. The old `anky2.github.io/myGoal/` URL still
works too unless/until you disable GitHub Pages in that repo's Settings —
no rush either way, it doesn't conflict with anything.

## 1. Install Bubblewrap and generate the Android project

```
npm install -g @bubblewrap/cli
bubblewrap init --manifest="https://mygoal-8876d.web.app/manifest.json"
```

It downloads its own JDK/Android SDK if missing. When prompted:
- **Package name**: pick something like `com.ankityadav.goalstracker` —
  this is **permanent** once you publish, so don't rush it.
- Accept the name/colors it reads from `manifest.json`.
- Let it generate a new signing keystore (the "upload key").

```
bubblewrap build
```
Produces `app-release-bundle.aab` (upload this to Play Console) and a
`.apk` you can sideload for testing.

**Back up the generated `.jks` keystore file and both its passwords**
somewhere durable and private (password manager, encrypted cloud backup).
Never commit it to git. Losing it is recoverable but slow.

## 2. First-pass assetlinks.json (upload-key fingerprint)

```
keytool -list -v -keystore <path-to-your.jks> -alias <alias-you-chose>
```
Copy the `SHA256:` fingerprint, then create this file **in this repo** at
`.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.ankityadav.goalstracker",
    "sha256_cert_fingerprints": ["<UPLOAD-KEY-SHA256>"]
  }
}]
```
(swap in the package name you actually chose in step 1)

Then redeploy: `firebase deploy --only hosting`. Verify it's live at
`https://mygoal-8876d.web.app/.well-known/assetlinks.json`.

## 3. Google Play Console

1. play.google.com/console/signup → pay the **$25 one-time fee** → identity
   verification (can take a day or two before your first app can go live).
2. Create the app entry (name, free, standard declarations).
3. Store listing: reuse `icons/icon-512.png` for the app icon; make a
   1024×500 feature graphic (Canva/Figma free tier); screenshots via Chrome
   DevTools device toolbar (Ctrl+Shift+M) against the live site +
   "Capture screenshot" (Ctrl+Shift+P) — no emulator needed.
4. Content rating questionnaire → expect "Everyone".
5. Data Safety form: sync is optional, collects only user-entered goal/step
   text, purpose "App functionality", not shared/sold, encrypted in transit,
   no ads/analytics.
6. Privacy policy URL: `https://mygoal-8876d.web.app/privacy.html`
7. Upload the `.aab` to **Internal testing** first, verify the address bar
   is actually hidden and the app works, then promote to **Production**.

## 4. After the first Production upload — second-pass assetlinks.json

Play Console will now re-sign your app with its own key (Play App Signing).
Go to Play Console → your app → Setup → App integrity → copy the
**App signing key certificate SHA-256**, and add it as a second entry in
`sha256_cert_fingerprints` in this repo's `.well-known/assetlinks.json`:

```json
"sha256_cert_fingerprints": [
  "<UPLOAD-KEY-SHA256>",
  "<PLAY-APP-SIGNING-KEY-SHA256>"
]
```
Redeploy (`firebase deploy --only hosting`). Needed once, not on every
future release.

## 5. Ongoing

- Running `firebase deploy --only hosting` after any change to
  `index.html`/`css/`/`js/` updates the Play Store app instantly for
  everyone — no re-submission needed (the service worker is network-first
  specifically to preserve this).
- Re-submission is only needed for native-shell changes (icon, name,
  splash color) or when Play requires a `targetSdkVersion` bump — run
  `bubblewrap update && bubblewrap build` and upload as a normal update,
  roughly once a year.
- Swap the placeholder icon (`icons/*.png`, generated from a simple
  bullseye motif in the app's existing blue/purple theme) for real branding
  whenever you want — regenerate all listed sizes and maskable variants,
  then redeploy and re-run `bubblewrap build` for a new release.
- Optional, not required: connect a custom domain to Firebase Hosting later
  (Hosting → Add custom domain) if you'd rather have a branded URL than
  `mygoal-8876d.web.app`. Costs only whatever the domain registration itself
  costs (~$10–15/year) — Firebase Hosting and everything else stays free.
