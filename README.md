# Prompt Library — iPhone PWA

A beautiful, offline-first **installable web app** for browsing your 2,168-prompt
library from your iPhone (or any device). No App Store, no `node_modules`, no build
step — just static files + a generated `prompts.json`.

- **Browse** 17 color-coded collections → subcategories → prompts
- **Search** all 2,168 prompts instantly
- **Copy** any prompt with one tap
- **Fill in blanks** — replace `[BRACKETS]` / `${variables}` from a form, then copy
- **Save** favorites · **Recent** history · **Dark mode**
- Works **fully offline** once loaded (service worker)

---

## Folder contents

```
app/
  public/              ← the deployable static site (deploy THIS folder)
    index.html  styles.css  app.js
    prompts.json       ← generated from the markdown library
    manifest.webmanifest  sw.js  vercel.json
    fonts/  icons/
  build_data.py        ← rebuilds public/prompts.json from ../02_output/library
  make_icons.py        ← regenerates the app icons
```

---

## Run it locally (test on your PC)

```powershell
cd "G:\Meu Drive\01_Agentic-AI\02_claude-commands\03_prompts\app\public"
python -m http.server 8000
```
Open **http://localhost:8000** in your browser.

---

## Update the prompts

After you edit any file in `../02_output/library/`, regenerate the data:

```powershell
cd "G:\Meu Drive\01_Agentic-AI\02_claude-commands\03_prompts\app"
python build_data.py
```
It prints a per-category count and asserts the totals. Then redeploy (below).

> Bump the cache version in `public/sw.js` (`pl-v1` → `pl-v2`) when you change data
> or code, so installed copies pick up the update on next launch.

---

## Deploy to Vercel (free) — get a URL for your iPhone

You deploy the **`public/`** folder. Two ways:

### Option A — Dashboard, no install (easiest)
1. Go to **vercel.com** → sign in (free).
2. **Add New… → Project → Deploy** (or drag-and-drop). When asked for the folder,
   choose **`app/public`**.
3. Vercel gives you a URL like `https://your-prompts.vercel.app`.

### Option B — CLI
```powershell
npm i -g vercel
cd "G:\Meu Drive\01_Agentic-AI\02_claude-commands\03_prompts\app\public"
vercel            # first run: log in + accept defaults
vercel --prod     # promote to your production URL
```

To update later: run `python build_data.py`, then `vercel --prod` again (or re-drag the folder).

---

## Install on your iPhone

1. Open the Vercel URL in **Safari** (must be Safari for install to work).
2. Tap the **Share** button (square with an up-arrow).
3. Tap **Add to Home Screen** → **Add**.
4. Launch it from the new icon — it opens full-screen, like a native app, and works
   offline.

---

## Notes

- **Fonts** (Fraunces / Archivo / Spline Sans Mono) are self-hosted in `fonts/`, so the
  app looks right with no network and no third-party requests.
- **Privacy:** a Vercel deployment is a public URL (unguessable, not indexed). If you
  want it private, use Vercel's password protection, or keep it on your local network.
- **Regenerate icons** (if you tweak the design): `python make_icons.py` (needs Pillow).
