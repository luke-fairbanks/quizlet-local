# QuizletLocal

A local, ad-free app for saving Quizlet sets and studying them. No accounts, no
external services — sets are stored in `data/sets.json` on your machine.

**Stack:** React 18 + [Radix Themes](https://www.radix-ui.com/) + framer-motion
(frontend), with a zero-dependency Node HTTP server as the API/storage backend.

## Run it

Just one thing to run — a single local server on port 4321 serves both the app
and its API.

**To use it (recommended):**

- **Double-click `Start QuizletLocal.command`** — installs/builds on first run,
  starts the server in the background, and opens the app in your browser. You can
  close the little Terminal window; the app keeps running.
- **Double-click `Stop QuizletLocal.command`** when you're done.

That's it. (Tip: drag `Start QuizletLocal.command` into your Dock for one-click
access.)

**From a terminal, if you prefer:**

```bash
npm install      # first time only
npm run build    # build the React app (first time, or after code changes)
node server.js   # serves the app + API at http://localhost:4321
```

**Editing the code** (hot reload — two servers, only needed for development):

```bash
npm run dev      # Node API on :4321 + Vite dev server on :5173 -> open :5173
```

The bookmarklet always posts to :4321, so keep the server running while you use it.

## Importing a set — three ways

Quizlet hides behind Cloudflare, so a plain server-side scrape usually gets
blocked (403). In order of reliability:

1. **Bookmarklet (recommended).** Open the *Bookmarklet* tab, drag the button to
   your browser's bookmarks bar. Open any Quizlet set, click it — it pulls every
   term (via Quizlet's own paginated API, with embedded-data and JSON-LD
   fallbacks) from the page you're viewing and sends them here. Works because it
   runs in your real browser, past Cloudflare.
2. **Paste Import.** On Quizlet: open a set → **···** → **Export** → copy. Paste
   into the *Paste Import* tab. Tab/newline delimiters match Quizlet's export;
   "Blank line" between cards preserves multi-line definitions.
3. **Import by URL.** Quick when it works, but Quizlet often blocks it — fall
   back to the bookmarklet.

## Studying

Click **Study** on any set, then pick a mode (Flashcards / Learn / Quiz / Match / List):

- **Flashcards** — click the card, press **Space**, or the **Flip** button to flip;
  **← / →** navigate; mark each card **Still learning** (`1`) or **Known** (`2`);
  **S** shuffles, the restart button returns to the first card.
- **Learn** — adaptive (à la Quizlet Learn): each card climbs a mastery ladder
  (multiple-choice → written), missed cards come back, with an "Answer with
  Term/Definition" toggle and forgiving typed-answer grading.
- **Quiz** — multiple-choice; correct answers mark a card *known*, wrong ones
  *learning*. Press `1`–`4` to pick, `Enter` for next.
- **Match** — click term/definition tiles to pair them against a timer.
- **List** — a full term/definition table with status dots.

**Esc** closes (every overlay is a focus-trapped, screen-reader-friendly modal).

### Learning progress

Each card tracks a status — **new**, **learning**, or **known** — shown as a
progress bar on every set. Quiz answers and the flashcard buttons update it. Reset
it anytime from the editor.

## Editing a set

Click the **pencil** on any set to open the editor: rename the set, edit each
card's term/definition inline (saved as you go), add or delete cards, and reset
learning progress.

## Project layout

```
server.js                 zero-dependency Node API + static server (port 4321)
index.html, vite.config.mjs
src/
  main.jsx                React entry (wraps app in Radix <Theme>)
  App.jsx                 layout + state orchestration
  api.js                  fetch wrappers for /api/*
  hooks/useSets.js        data store: optimistic edits + live refresh
  components/
    ImportPanel.jsx       URL / Bookmarklet / Paste tabs
    SetList.jsx           saved sets, search, edit, delete, progress
    StudyView.jsx         full-screen study modal + mode switcher (3D flip)
    LearnMode.jsx         adaptive learn (MC -> written mastery)
    QuizMode.jsx          multiple-choice quiz
    MatchMode.jsx         term/definition tile-matching game
    EditSetView.jsx       inline card editor
    Toaster.jsx           framer-motion toast notifications
  lib/util.js             shuffle / date / search / answer-matching helpers
  lib/progress.js         learning-status helpers
  bookmarklet.js          generated bookmarklet URL (see scripts/)
bookmarklet.src.js        readable bookmarklet source
scripts/build-bookmarklet.mjs   `npm run bookmarklet` rebuilds the bookmarklet
public/favicon.svg        app icon
data/sets.json            your saved sets (created at runtime; gitignored)
```

## Disclaimer

QuizletLocal is a personal study tool. A few things to keep in mind:

- **Imported sets belong to their original creators.** Use it to study your own
  or your class's material; don't redistribute scraped content. This repository
  ships with **no** set data.
- Importing by scraping may conflict with **Quizlet's Terms of Service** — use
  the import features responsibly and for personal study only.
- Not affiliated with, endorsed by, or connected to Quizlet in any way.

## License

[MIT](LICENSE) © Luke Fairbanks
