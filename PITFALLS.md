# Helius BD Tracker — pitfalls and lessons

Session: 3 November 2026. One build, one artifact.

---

## Session 1 — the SVG office (superseded)

> The office was an inline SVG in v1 and is now a Three.js scene. These five bugs are kept
> because the *lessons* generalise — the code they refer to no longer exists in the file.

### 1. The handoff path never drew (silent)
```js
<path d="M${AGENTS.map((a,i)=>`${i?'L':'M'}${a.x} ${a.y}`).join(' ')}"
```
The literal `M` in the attribute plus the `M` from the first iteration produced `MM400 278`.
SVG rejects it and **draws nothing, with no visible symptom** — the scene just looked
slightly emptier than intended. Only `read_console_messages` caught it.

**Lesson:** after building any generated SVG path, read the console. A malformed `d`
attribute fails silently and you will not spot it by looking.

### 2. `aspect-ratio` fighting the `viewBox`
The stage was `aspect-ratio:16/10` while the viewBox was `1380/560` (2.46:1). With
`preserveAspectRatio="meet"` the scene letterboxed into the middle third and the bottom
half of the panel was empty teal.

**Lesson:** when a container holds one full-bleed SVG, set the container's aspect-ratio
to the viewBox ratio, not to a nice round number.

### 3. Over-dimming idle agents
`.idle{opacity:.5}` on a dark teal ground desaturated the agent colours to the point where
all six robots read as the same green. The colours were correct in the DOM — only the eye
was wrong.

**Lesson:** on a dark ground, .5 opacity is not "dimmed", it is "gone". `.88` was enough.

### 4. Skewed wall boards escaping the frame
`transform="translate(560,-10) skewY(17)"` — the skew is applied in the *translated* frame,
so a 150px-wide board gains `tan(17°) × 150 ≈ 46px` of vertical travel. One board poked
above the top edge of the viewBox.

**Fix:** wrap the whole room in a `clipPath` the size of the viewBox. Cheap insurance for
every future element.

### 5. A hacky `settle()` reading `document.activeElement`
First version tried to infer the verdict from focus state. Replaced by passing
`dataset.verdict` straight through the delegated click handler. Obvious in hindsight.

---

## Preview-pane limitations worth knowing

- **Files outside the project folder render as static snapshots.** `navigate` to a
  `file://` path works, but JS is frozen — clicks and `javascript_tool` appear to succeed
  and change nothing. Took two rounds to notice.
  **Fix:** start a real server with `preview_start` (a `.claude/launch.json` with
  `python3 -m http.server`) and drive `http://localhost:PORT`.
- **`.claude/launch.json` must live in the *primary working directory*,** not the
  subfolder. And do **not** use `python3 -m http.server --directory` — argparse evaluates
  `os.getcwd()` for that flag's default and the sandbox blocks getcwd, so the server never
  starts (preview-pitfalls §5). Ship a three-line `serve.py` that passes `directory=` via
  `functools.partial` instead; `serve.py` in this folder is the working one.
- **`computer{action:"zoom"}` region cropping is not supported** in this pane — it returns
  the full screenshot. Inspect geometry with `javascript_tool` + `getBBox()` instead.
- **`navigate` resets viewport emulation,** and a screenshot batched immediately after a
  `javascript_tool` call can race the repaint. Put the resize and the screenshot in
  *separate* calls.
- **Mojibake (`Â·`, `â€`) under `python -m http.server`** is the local server omitting a
  charset, not a file problem. The artifact wrapper supplies `<meta charset>`, so it does
  not appear in the published page. Don't chase it.

---

## Design decisions that are worth keeping

### Verify structurally, not visually, when the pane is small
The preview pane rendered the 1380px scene into ~200px. Screenshots were useless for
judging colour and placement. What actually worked:

```js
[...svg.querySelectorAll('g.robot')].map(g => ({
  t: g.getAttribute('transform'),
  fill: g.querySelector('rect').getAttribute('fill'),
  bb: g.getBBox()
}))
```

That proved all six colours were correct when the screenshot said otherwise.

### A single smoke-test expression beats clicking around
One `javascript_tool` call exercised all six routes, all six views, all six lenses, the
brief overlay and the approve/undo cycle, and returned `[]`:

```js
const errs=[];
['home','office','approvals','report','near','settings'].forEach(r=>{
  try{ go(r); if(!document.querySelector('h2')) errs.push(r+':empty'); }
  catch(e){ errs.push(r+':'+e.message) }
});
```

Do this on every artifact before publishing. It costs one call.

### Two palettes in one page is fine if the boundary is a *thing*
The chrome is the Treasury Intel navy system; the office is the reference recording's teal
room. That is not inconsistency, because the office is a **depicted room inside the
product**, not another panel of chrome. The rule: a palette break needs a diegetic reason.

### Make the honesty the feature
The Rejected view, the counter-reading on every row, the "what we are not claiming" block
in the proposal, the blocked name-collision row kept *visible* rather than dropped, and the
"Fixture · frozen scan" badge. These cost almost nothing to build and they are the hardest
thing for another entry to fake.

---

## Session 2 — the Three.js rebuild (3 Nov 2026)

### 6. Three.js on cdnjs is `three.js`, not `three`
`https://cdnjs.cloudflare.com/ajax/libs/three/r128/three.min.js` → **404**.
`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` → 200.
The cdnjs *library name* carries the `.js`. There is no `three` library on cdnjs at all,
so the API lookup `api.cdnjs.com/libraries/three` also 404s and tells you nothing.
r128 is the UMD classic build — global `THREE`, no ES-module import, which is what the
artifact CSP and `file://` both need.

### 7. A sed/python replacement that eats a semicolon off a one-line statement
Replacing `rug.position.set(2,.07,18);` with `rug.position.set(1,.07,16)` on a line that
read `rug.position.set(2,.07,18); scene.add(rug);` produced
`rug.position.set(1,.07,16) scene.add(rug);` — a parse error that killed the **entire
script**, same silent-failure class as §9 in the preview-pitfalls file.

**Lesson:** when scripting edits, always include the trailing `;` in both halves of the
replacement, and run `node --check` on the extracted script block afterwards. One command:
```bash
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d')
```

### 8. The browser pane keeps stale console errors across navigations
`read_console_messages` kept returning the §7 SyntaxError long after it was fixed, while
`isReady()` returned true and every feature worked. Do not chase a console error that
contradicts a working page — confirm with `node --check` on the source instead.

### 9. `resize_window` + `navigate` race, badly
`navigate` resets viewport emulation, and a screenshot batched straight after a resize
often captures the *previous* scale, rendering a 1280px page into ~200px of the shot.
Sequence that works: navigate → (separate call) resize → (separate call) screenshot.
Expect to take the screenshot twice.

### 10. Verified Casa Lume carry-overs that mattered here
- **Never size WebGL from `window.innerWidth`** — the pane reports 0. Sized from
  `getBoundingClientRect()` on the canvas's parent, plus a `ResizeObserver` so it
  self-heals when the real viewport lands. Confirmed: canvas came up 1171×752, not 0×0.
- **Cap `setPixelRatio` at 1.5.** DPR was the main lag source on the villa tour.
- **No external assets at all.** Every wall board is a 2D `<canvas>` turned into a
  `CanvasTexture` — same-origin, so it dodges the `TextureLoader` crossOrigin trap and
  needs no font loader. Text on a wall in 3D with zero dependencies.

### 11. On the four reference repos
None gave a usable drop-in. `mlegere1323/RobotRoom` is raw WebGL (no Three.js) and
**GPL-3.0**, which would infect the artifact. `OneByJorah/offivo` is MIT and Three.js but
is a WebRTC conferencing app with no extractable room geometry. The other two were not
needed once the decision was made.

**Lesson:** for a scene made of boxes, spheres and cylinders, procedural geometry is
*faster* than sourcing a model and has no licence, CORS or file-size cost. Check the
licence before the code — GPL in an artifact is a hard stop.

### 12. Robot design: colour washes out under flat ambient
Six distinctly-coloured `MeshLambertMaterial` bodies all read as the same green on a teal
floor under `AmbientLight(.62)`. The DOM had the right hex values the whole time — only
the eye was wrong (same class of mistake as §3 last session).
**Fix:** drop ambient to `.46`, raise the key light, and give each body
`emissive: <its own colour>, emissiveIntensity: .34`. Instantly readable.

### 13. Staging: robots belong BEHIND the desk
First pass put each robot in front of its desk (`desk.z + 4.2`) and it read as a lobby, not
an office. The reference has the desk between the viewer and the robot, with the lit
monitor on the near edge. Moving them to `desk.z - 3.3` and flipping the monitor to the
near face was the single change that made the room look like the video.

---

---

## Session 3 — light theme, documents, and more motion (3 Nov 2026)

### 14. `Office.busy()` never goes false under headless eval
Preview-pitfalls §6 again, from a new angle: `renderer.setAnimationLoop` is rAF, and the
pane keeps the tab `document.hidden` between tool calls, so the trip queue never drains.
Polling `busy()` in a `javascript_tool` loop waits forever even though the code is correct —
the clock only advances when something forces a paint, like a screenshot.

**Lesson:** never *wait* on an animation in an eval. Expose a way to force the end state
(`Office.celebrate()`, `Office.reset()`) and verify that instead. Deep-link or force-state
is the only reliable way to screenshot a moving scene.

### 15. Canvas textures are the free win in a sandboxed 3D scene
Floorboards, wall signage and the door sign are all `document.createElement('canvas')` →
`THREE.CanvasTexture`. Same-origin, so no CORS; no font loader; no asset to ship; and the
text can be regenerated from live data. The floor went from a flat brown slab to something
that reads as an office with about fifteen lines of 2D canvas code.

### 16. Inverting a theme is a token job, not a find-and-replace
Swapping dark→light meant rewriting the `:root` block and nothing else structural — because
every colour was already a variable. The one real trap: **lime on white is unreadable as
type.** The fix is to use the accent only as a *block fill* with near-black text on it
(`--accent-ink`), never as a text colour on the page ground. Same for any bright accent.

### 17. A print stylesheet is the cheapest "export to PDF" there is
`@media print` that hides `header, footer, main, .modal .mh, .sidepane, .mf` and leaves only
`.docpane` gives a clean PDF through the browser's own dialogue. No library, no server, no
download permission needed. Add `break-inside: avoid` on tables and pull-quotes and
`@page { margin: 16mm }`.

**Caveat to verify on the host:** `window.print()` and `mailto:` navigation can be blocked
inside a sandboxed artifact iframe. Both work when the file is opened directly from disk.
Do not promise either without testing on the actual host.

### 18. Scripted edits need the semicolon *and* a syntax check, every time
Hit the §7 class of bug again. The standing rule is now: every `python3` patch run ends with
```bash
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d')
```
and the patch is not considered applied until that prints nothing.

---

---

## Session 4 (3 Nov 2026) - encoding, and a slicing bug that duplicated the whole file

### 19. The mojibake was never in the file
`A-middot` and `a-euro-"` appear when a UTF-8 file is decoded as Latin-1. The source was
clean (`xxd` showed `c2 b7` for the middot). The cause is a missing charset declaration -
guaranteed on `python -m http.server`, and possible on any host whose wrapper you do not
control.

**The permanent fix: make the file pure ASCII.** HTML entities outside the script block,
`\uXXXX` escapes inside it. Then it renders identically with or without a charset
declaration, on any host, from `file://` or over HTTP. Verify with:
```bash
file -I index.html     # want: charset=us-ascii
```

### 20. `s.index('</script>')` can come BEFORE `s.index('<script>')`
This one silently **duplicated the entire document**.

The page has a CDN tag on line 6: `<script src="...three.min.js"></script>`. The literal
`<script>` does not match it (it is `<script src=`), so `index('<script>')` found my real
block near the bottom. But `index('</script>')` matched the CDN tag's closing tag on line 6.
With `j < i`:
```python
head = s[:i]   # the whole document
js   = s[i:j]  # empty, because j < i
tail = s[j:]   # the whole document again, from line 6
out  = head + js + tail   # two copies
```
The page still rendered - two navs, two copies of every section - and nothing errored.

**Rules now:** use `rindex` for both ends when the block you want is the last one, and
`assert j > i` before slicing. Then count landmark tags afterwards:
```python
assert out.count('<title>') == 1 and out.count('<main') == 1
```

### 21. The same bug put HTML entities inside JavaScript
Because the mis-sliced "head" contained my script, the entity pass ran over it and turned
`var ARROW = '->'` into `var ARROW = '&rarr;'`. Where that string was written as raw HTML it
looked fine; where it passed through `esc()` it rendered as the literal text `&rarr;`.
Symptom to recognise: **an entity visible as text only in the escaped parts of the page.**

### 22. RESEARCH is a state, not a band
First cut made the counter-rationale a *cap*, so Securitize scored 26, landed in NO_ACTION,
and the cap to RESEARCH could not raise it. Wrong: a named entity with real evidence but no
gap signal should be *kept and researched*, not dropped.

**Fix:** the counter-rule now **reclassifies** to RESEARCH when the row has a named entity,
and only annotates when it does not. Scoring bands and workflow states are different axes -
do not collapse them.

### 23. Glassmorphism washes colour out on a light ground
Six translucent robots at `opacity .84` on a pale room all read as the same pastel. Walls
and desks can be glass; **the subjects cannot**. Bodies went to `opacity .95` with a small
emissive, and the wall signage inverted to dark panels with light text so it reads at all.
Third time this session that a colour was right in the DOM and wrong to the eye.

### 24. The verdict must not live in the schema
Rows now carry a rubric, a gate object and a counter-rule; `assess()` computes score, band,
and the caps that override it. Nobody can promote a row by typing a better word into it,
and the UI can show *why* a row is capped. This is the single change that moved the tool
from "scores things" to "qualifies things".

---

---

## Session 5 (4 Nov 2026) - the disclaimer problem, and a nav that was not a nav

### 25. An inline-block child silently widened the whole nav
The pill nav looked like **two bars**: a small pill, and a full-width dark strip under it.
There was only one `<nav>`. The ticker inside it was

```css
nav .tick div { display: inline-block; animation: tick 30s linear infinite; }
```

An in-flow inline-block with long content **sizes its ancestors**. `overflow:hidden` on the
nav clips the paint but does nothing to the width, so the pill stretched to fit the ticker
and the centring had nothing left to centre.

**Fix:** take the marquee out of flow entirely.
```css
nav .tick     { position: relative; overflow: hidden; height: 21px; }
nav .tick div { position: absolute; top: 0; left: 0; }
nav           { width: max-content; }
```
**Rule:** a marquee inside a sized container is always absolutely positioned. If it is in
flow, it is a width bug waiting to happen.

### 26. Measure the reference, do not eyeball a scaled screenshot
Guessing from Kerrie's screenshot gave margins roughly half of the real thing. Two
`getComputedStyle` reads on the live site settled it in one call:

| | reference | what I had |
|---|---|---|
| side gutter | **80px fixed**, full bleed, `max-width: none` | `clamp(16px, 2.2vw, 40px)` + 1760 cap |
| h1 | 40px @1150 -> 68px @1760 | capped at 74px |
| h2 | 42px @1150 -> 48px @1760 | capped at 46px |
| left column | ~640px @1760 | 440px |

The 440px column was why headings ran to four lines. **Widening the column fixed the
heading, not a smaller font.** Always measure: `getBoundingClientRect()` + `getComputedStyle`
on the real site beats any amount of squinting.

### 27. Disclaimers are not product, they are submission material
The honesty card and the ICP table were the first thing on the page. Kerrie's question was
the right one: *does a judge want this in the interface, or in the demo video?*

The answer is neither-in-the-way: **one discreet nav entry, "About this build", opening a
modal** with the real/fixture table, the ICP tiers, the schema, the limits and the track
positions. The product keeps its hero for what a user came for.

What replaced it is the thing a user actually wants first: **the scan result**. Ten rows in,
one out, named. That is more persuasive than any disclaimer, and it still tells the truth.

**Rule:** if a block exists to defend the build rather than to do the work, it belongs
behind one click, and in the README. Never in the hero.

### 28. A derived number must be derived, not typed
The scan card said "capped below their score: 10" because it counted rows with any cap
entry - including rows that were never promoted in the first place. Three places repeated
the stale figure `8`.

**Fix:** `assess()` now returns `band` as well as `verdict`, so "moved by a cap" means
exactly `verdict !== band` (4 rows). A single `CAPPED_N` constant feeds the scan card, the
3D wall board and the agent roster.

**Rule:** the moment a number appears in two places, compute it once. In a tool whose entire
claim is that its verdicts are derived rather than typed, a hard-coded count is not a
cosmetic bug - it is the thesis failing in miniature.

---

---

## Session 6 (4 Nov 2026) - two dangling references, and a static check that catches both

### 29. `var` hoisting rendered a number as `undefined` on a live dashboard

```js
var AGENTS = [ ..., { out: CAPPED_N + ' rows moved by a cap' }, ... ];
var CAPPED_N = STORE.filter(...).length;      // four lines LATER
```

`var` hoists the **declaration**, not the assignment. At the moment the AGENTS array is
built, `CAPPED_N` is `undefined`, so the agent chip read **"undefined rows moved by a cap"**
on the live page. No error, no warning.

This is worse than a cosmetic bug in this particular product: the whole claim is that
numbers are *computed, not typed*, and the first computed number a viewer met was broken.

**Fix:** never let a derived number be a module-level `var` consumed by another
module-level literal. Make it a function evaluated at render time:
```js
function cappedCount(){ return STORE.filter(function(r){
  var a = assess(r, null); return a.verdict !== a.band; }).length; }
```

### 30. A renderer outlived the element it rendered into
Rewriting the hero removed `<div id="scanCard">`. `renderScanCard()` stayed in
`renderAll()`, threw `Cannot set properties of null`, and **aborted the whole render chain**
- so the lens strip, the queue and everything after it silently never rendered. The page
looked like a hero and nothing else.

**The static check that catches both of these**, run after every edit pass:

```python
used     = set(re.findall(r"\$\('([A-Za-z0-9_]+)'\)", src))
declared = set(re.findall(r'id="([A-Za-z0-9_]+)"', src))
print('MISSING TARGETS:', sorted(used - declared))   # expect only dynamic ids
```

It takes a second and it would have caught the dead renderer before the browser did.
`node --check` cannot: both bugs are valid JavaScript.

### 31. Editing for a worklist, not a manifesto
The real content lesson of this pass. Every element was put to one question:

> **Does this change whether I call, research, or ignore?**

Everything that failed it moved to Method or About, or went. Concretely:

| | Before | After |
|---|---|---|
| Nav | 6 items incl. "Motion" | 5: Queue, Office, Method, Output, About |
| Hero | headline + 2 explanatory lines + a result panel | headline + "Ten Solana events. One Sender lead." |
| Queue row | headline, chips, prose, rubric, cap note, source | company / score+verdict / fit / why now / blocker / next |
| Queue tabs | 6 | 4 (Gate and Products folded into the row) |
| Lens strip | 6 equal buttons + a paragraph | 1 primary + collapsed "Other lenses" |
| Agent table | 3-column table repeating counts | 6 status chips |
| BD brief | 8 sections | 5, with the audit material in an appendix |
| Footer | 3 lines | 1 |

The rubric arithmetic, the gate chips and the product fit are all still there - one
disclosure deeper, inside **"Score, gate and product fit"** on the row. Nothing was deleted
from the system; it was moved to where someone actually asks for it.

**The principle worth keeping:** a tool's intelligence should show in *what it suppresses*.
Explaining your own rigour on every screen is the surest sign of not trusting it.

---

---

## Session 7 (4 Nov 2026) - fixture to real pipeline, on NEAR AI

### 32. An artifact cannot be the scanner, and that is settled by the guide
The artifact CSP blocks fetch/XHR to every host. A published page therefore cannot call
`cloud-api.near.ai`, cannot fetch a source page, and cannot run a scan. Two dead ends were
considered and rejected:

- **`sample` capability (ask Claude from the page).** It works, but Claude has no web access
  there, so it would answer from training data. A model recalling a Solana event and
  presenting it as a scan result **is** fabrication - precisely what the brief forbids.
- **`mcp` + `host:claude_browser`.** Real web access, but only inside a Cowork session of
  the desktop app. A core feature that works in one environment is not a feature.

**HACKATHON.md Q-012 settles it:** a local-only demo is acceptable - public repo,
reproducible README, demo video. So the pipeline is a Node service and the artifact is the
interface. When the page is opened without a pipeline on its origin it says so and labels
the dataset **demo dataset**.

### 33. Two stages must have no model, and saying so is the feature
Scorer and Gate are pure code. This came straight from the operator's own prompt packs:
*"code does the arithmetic, a model never scores or sizes"* - after a prior project where a
model inventing its own weighting scored four prospects 75-77 "Critical" when the correct
figure was 70.

The rubric also **clamps**: `Math.min(RUBRIC_MAX[k], v)`. A model returning `txVolume: 9999`
gets 25. Asserted in the selftest.

### 34. The grounding check is the only thing standing between you and fiction
Every inherited pack in this lineage asked for a `summary`. None asked for a span, so none
could check one. Here the Collector must return a verbatim quote and `verify.js` searches
for it in text **we fetched ourselves**:

```js
if (!quoteIsGrounded(c.quote, pageText)) return fail('QUOTE_NOT_IN_SOURCE');
```

Tolerance is a long contiguous run of words, never a bag of words - the selftest asserts
that a reshuffled bag of real words from the page is **rejected**.

Second guard in the same spirit: in the Enricher, a gate field returned `true` with no
supporting span is **downgraded to false**. The model may assert; it may not assert without
evidence.

### 35. A wrong reason code is worse than no reason code
An invalid NEAR AI key produced a 401, which the pipeline logged as `MALFORMED_JSON`. The
JSON was fine; the auth was not. In a tool whose entire claim is honest reason codes, a
misleading one is a credibility failure of the same class as `undefined rows moved by a cap`.

**Fix:** errors carry `e.code`, and `INFERENCE_FAILED` was added. Verified by running with a
deliberately invalid key: the run fetched the real page, got the real 401, logged
`INFERENCE_FAILED` with the API's own message, returned **zero rows** and a **$0 ledger**.
That test is worth keeping - it is the proof the system fails honestly.

### 36. Cost must come from the provider's numbers or not exist
The ledger is built from the API's own `usage` object. If the per-token price env vars are
unset it reports **token counts and says so**, rather than inventing a dollar figure. A
budget cap aborts the run mid-flight, because a runaway loop must not eat a $10 grant.

### 37. The same assertion-script discipline, now for a pipeline
`pipeline/selftest.js` - 27 assertions, no key, no network, no tokens. It proved the
clamp, the veto, the blocked-alias guard and the bag-of-words rejection in under a second.

It also caught a wrong *test*: `reach: 15` with `infrastructure_owner_identified: false`
stayed capped at Qualify. The code was right - score and gate are independent on purpose,
and the fix was to assert that explicitly (`score alone cannot clear the cap`).

### 38. An error thrown in a render chain kills every stage after it
Hit again this session in a new form: a `rep()` python patch asserted and exited **before
its write**, so two edits silently never landed and `#scanPanel` did not exist while the
code referencing it did. The `$('id')` vs `id="..."` static check caught it in one second.
Run that check after every edit pass, every time.

---

## What to do next

1. **Wire the 1Click `dry:true` quote to the live endpoint.** Until then, do not select the
   Unstoppable DeFi track.
2. **Run the collectors for real** and replace the ten hand-entered findings. Keep the
   schema identical so no view code changes.
3. **Measure the benchmark table from a real run.** Eight honest numbers beat one
   impressive percentage.
4. **Add Securitize and Jump Trading to `prospects.yaml`** in the treasury-intel repo —
   the entries are already drafted in the research notes.
5. **Leave the fixture badge on** until 2 and 3 are done.

---

## Pitfall 24 — a source list that cannot produce the lead you are selling

Run `run-2026-11-04T21-10-13` returned zero qualified leads. The instinct was to
blame the gate. The gate was fine. The **sources** were Solana core development
(Anza, Agave, SIMDs), so `latency_sensitive` was false on every single row and
the Sender lens could not fire even once.

Swapping in trade press fixed the volume evidence and still produced nothing,
because trade press describes a market, not a buyer's own stack.

**The fix was structural, not editorial.** `sourcePlan()` now derives the reading
list from the registry's verified surfaces, ordered buyer-owned → technical →
context, and `source_type` travels with the row so a context page is capped at
Research no matter how well it scores.

**Rule:** before blaming the scorer for an empty run, ask whether any page in
the source list *could physically contain* the sentence your product needs.

## Pitfall 25 — "eleven changes found" is not a result

The Account Monitor reported eleven dated changes and it felt like progress.
One was Sender-relevant. Three were the wrong motion, six were not Solana at
all, one was context.

An unfiltered count flatters the tool and wastes the reader. Every change is now
bucketed before display. **Report the useful number, then the honest total.**

## Pitfall 26 — `source_type` meant two different things

`verify.js` was setting `source_type` to the whitelist's granular kind (`blog`,
`news`), and the new classifier wanted it for the class (`buyer_owned`). Keeping
both under one name would have silently mis-capped every row.

Renamed the granular one to `source_kind`. **When a field's meaning changes,
rename it — do not overload it.**

## Pitfall 27 — the evidence was real, the company was wrong

A research note said Drift's keeper-bot docs were now Drift-owned and carried the quote
*"track your RPC latency"*. Both claims failed on contact with the page.

`docs.drift.trade/developers/trading-automation/keeper-bots` still redirects, and the page
it lands on is titled **"Keeper Bots | Velocity Protocol"** — Velocity eleven times, Drift
once, and that once is the nav link *"Migrate from Drift"*. The nearest real line is
"track RPC latency", not "track your RPC latency", and it is on a Velocity page.

The keeper-bot dependency was genuine the whole time. It just belonged to a different
company. **Velocity is now a registry account; Drift stays blocked.**

**Rule:** when evidence looks too good for a blocked account, the likeliest explanation is
that you have the right evidence and the wrong company. Re-fetch before you re-classify.

## Pitfall 28 — an event-shaped pipeline cannot see a standing condition

Every Velocity candidate was being rejected `DATE_UNVERIFIABLE`. Nothing was broken: docs
pages carry no dates, because nothing happened. The pipeline only understood events, and
the strongest first-party evidence in the whole registry is a **condition** — "our bots
submit transactions and operators must track RPC latency".

Standing conditions are now a second candidate class: first-party surfaces only, dated by
the fetch, `date_basis: observed_on_fetch`, grounding unchanged, and **capped at Research**
because nothing happened to reach out about. Rows above the floor went 0 → 3.

**Rule:** if a whole class of source produces nothing, check whether it is the wrong
*shape* before deciding it is the wrong source.

## Pitfall 29 — the unknown row outranked the known one

The counter-rationale rule read: if there is a named entity, cap to Research; otherwise
just note it. So a row we **could** identify was demoted and a row we **could not** kept
its band. Less identifiable scored better.

It surfaced as the build's first-ever QUALIFY: entity *"Solana"*, score 61. You cannot
sell Sender to a blockchain.

Both branches now lower the verdict, and chain names are no longer named entities.

**Rule:** any rule with an "otherwise just note it" branch is a promotion path. Make both
branches move the verdict the same direction.

## Pitfall 30 — assert-before-write lost the edits again (4th time)

A patch script applied one change, hit a `MISS` on the second, raised, and died **before**
`open(p,'w').write(s)`. The applied change was silently discarded and the self-test kept
passing on the old code.

**Rule, now non-negotiable:** count the applied hunks, assert the count, and only then
write. Every patch in this session that followed it survived; the one that did not, did not.

## Pitfall 31 — the operator agent found everything except operators

First run of HX-GA2 returned eighteen "operators", all grounded, none of them an
operator:

- **Bot roles as organisations** — "Keeper bots", "Liquidation bot", "JIT maker bot",
  "Makers". A job is not a buyer.
- **Helius** — we are the seller.
- **Seven Flint employees** — named under *Team* and *Founder* on Flint's own page.

Zero rejections, because the agent had no discrimination. The fix was three guards in
**code**, not a politer prompt: tokenise the name and reject it if every word is a role
word; block our own name; and route a person named in a staff context on the company's
own page to the **contact queue** instead of discarding them.

The first regex missed "JIT maker bot" and "Makers" because it allowed only one role
suffix. **Test the guard against the exact strings that defeated it**, which is now a
self-test.

**The honest result after the fix: zero third-party operators and seven named contacts.**
Velocity's docs describe what the bots *do*, never who runs them. That is a real finding
— the operators are not discoverable from the protocol's own documentation, so the next
step is GitHub forks and Discord, not another docs pass.

## Pitfall 32 — a wrong assert count silently discarded five good edits

A patch applied five hunks and asserted `n == 6`, because the count was written from the
plan rather than the code. The assert fired, the script died before the write, and all
five edits were lost — the pattern from Pitfall 30 working correctly, defeated by a
hand-written number.

**Rule:** derive the expected count from the number of `rep()` calls, or print `n` and
check it before trusting the run. The assert protects the file; it does not protect you
from miscounting.

## Pitfall 33 — the filter excluded exactly what we were looking for

HX-GA2 v2 reads a protocol's fork graph instead of its docs. First run: **zero forks, zero
operators.** The crawler was filtering out archived repositories as dead weight.

Every Drift-era keeper repo on the Velocity org is archived — `keeper-bots-v2` (99 forks),
`jit-proxy` (21), `keepyrs` (7), `keep-rs` (4). The one repo that survived the filter was
`relay`, with one fork.

**Archival of the upstream says nothing about whether the forks are running.**
`dpiprotocol/dpi-keepers` was pushed months after its parent was archived. Removing the
filter took the run from 1 fork to 100, and from zero identifiable owners to seven.

**Rule:** when a crawler returns zero, suspect the filter before the world. And an archived
reference implementation is itself intelligence — it is what a protocol mid-migration
looks like.

## Pitfall 34 — a missing lookup is not a finding

Classification resolves a company NAME to a company SITE by looking the name up as a
GitHub org, because a profile's blog is usually the person's, not the firm's.

When the API call failed, the code fell back to the personal blog and classified the
company from it. For Astralane that meant judging an infrastructure company by an
engineer's personal site — and the failure that triggered it was a **rate limit**, meaning
we had not looked at all.

Now a 404 falls back (no such org, the personal blog is the best we have) and a
`RATE_LIMITED` returns `UNVERIFIABLE` saying the lookup never ran.

**Rule:** distinguish *we looked and found nothing* from *we never looked*. Only the first
is a result. The same rule governs the run summary: a run that hits the rate limit reports
`INCOMPLETE`, never an empty result.

## Pitfall 35 — the crawler found a competitor's engineer, and that is correct

One fork owner's company field reads **Astralane**. Astralane's own site is titled *"Fast
Solana Transaction Submission API"* — it sells what Sender sells.

A crawler that surfaces a competitor's engineer is working. A crawler that calls them a
lead is not. Classification fetches the company's own site and returns `COMPETITOR` on any
page selling transaction submission or RPC, before anything reaches the pipeline.

**Rule:** discovery and qualification are different jobs. Widening discovery is safe only
when qualification is enforced in code.

## Pitfall 36 — 89% of the biggest page was being thrown away, silently

The collector read `text.slice(0, 14000)` of every page and was capped at four
candidates. On `status.kraken.com` — **128,512 characters** of dated incidents — that
discarded **89% of the page** and returned **one row**.

Neither limit announced itself. The run log said "1 candidate from status.kraken.com",
which reads like a quiet page rather than a truncated read.

The fix is to read the whole page **in small overlapping windows**, each with its own
candidate budget: 16 windows of 9,000 characters with a 600-character overlap covers
Kraken exactly. The overlap matters — an event whose date sits in one window and whose
quote sits in the next would be lost at the seam. Duplicates across windows are removed in
code, which is why `DUPLICATE` rejections rose from 14 to 78 and that is the mechanism
working, not a leak.

**Result: 14 verified rows → 72.** Cost went $0.0197 → $0.1161, which for 5× the material
is not a trade worth thinking about.

**Rule:** any truncation must appear in the run log. A silent `.slice()` is a data loss
that looks like an empty result.

## Pitfall 37 — the model's own rationale was satisfying the evidence test

Routing requires the EVENT to be about Solana, not just the account. The test read
`quote + headline + why`.

`why` is **written by the model**. So a Coinbase incident about *"delays affecting Interac
e-Transfer withdrawals for Canadian users"* routed as a Solana task, because the model's
rationale said Coinbase runs Solana volume. Four of six routed rows were fiat-rail or
non-Solana incidents on that basis.

The test now reads `quote + headline` only — the parts that came off the page. Six routed
rows became one, and that one is the genuine 31 October Solana sends-and-receives incident.

**Rule:** never let model-generated text satisfy a test that exists to check grounding.
Mixing a grounded field and a generated field in one string erases the distinction the
whole gate depends on.

## Pitfall 38 — `&amp;` made one page look like four

Surface discovery parses `href` values out of raw HTML. Those arrive entity-encoded, so
`?tag=x&amp;sort=y` parses as a parameter literally named `amp;sort` — and the
strip-tracking-parameters rule, which looks for `sort`, missed every one of them.

`flint.trade/blog` was admitted four times as four different surfaces.

Decode entities **before** parsing the URL, not after.

**Rule:** normalise before you deduplicate. Deduplication is only as good as the key.

## Pitfall 39 — the page and the pipeline were scoring the same rows differently

The interface kept its own copy of the scoring rules so it could score the fixture dataset
without a pipeline. Over time the two drifted: `pipeline/score.js` grew the `source_type`
cap, the `standing` cap and the evidence-grade cap, and `index.html` never got them.

The page showed **8 research and 0 routed** where the pipeline scored **4 and 1** on the
same rows. Both looked healthy. Nothing errored.

Copying the three caps across did not fix it either, because `adoptRun()` — the function
that maps a pipeline row onto the page's store — **never carried the fields those caps
read**. No `source_type`, no `standing`, no `quote`. The caps ran against `undefined` and
did nothing.

The actual fix is to stop having two implementations. A live row now carries the verdict
the pipeline computed, and the page uses it verbatim; the local implementation only scores
the fixture dataset, which has no pipeline behind it.

**Rule:** two implementations of one rule will diverge, and the divergence will be silent.
If a value can be computed once and carried, carry it.

**Consequence worth naming:** stored verdicts go stale when a cap changes. Re-running a
scan to pick that up costs $0.12 and moves the evidence underneath you, so `npm run
rescore` re-applies the current rules to a saved run — pure code, no model, no cost. It
reported the five fiat-rail rows dropping from ROUTED to NO_ACTION after Pitfall 37.

## Pitfall 40 — Flint scored 80 with "No infrastructure owner identified" printed underneath it

The highest score the system had ever produced was `Flint — RESEARCH 80`, on the quote
*"Spot is live; perps are next."* That should not be an 80, and three separate defects
were stacking to make it one.

**1. A CEO is not an infrastructure owner.** The enricher set
`infrastructure_owner_identified: true` with a perfectly grounded span: *"Founder Joshua
Watts Co-Founder, CEO"*. A real person, really on the page — and not someone who owns the
transaction-landing decision. The field now requires the span to name an **infrastructure
role**: engineer, CTO, platform, SRE, trading systems, head of engineering. A name is not
a role.

**2. The rubric was frozen at collection.** The 15 reach points that field earned stayed
on the row after the field was withdrawn, so the row printed a score of 80 above the cap
"No infrastructure owner identified." The rubric is now **derived** from the sanitised
gate wherever a row is scored. Store the inputs; derive the numbers.

**3. An UNCLEAR relationship was reaching a high band.** Flint had already been
reclassified UNCLEAR — we do not know it is a buyer — and nothing stopped it scoring like
one. UNCLEAR now caps at Research, which is what "we are not sure what they are" means.

**Flint is now 65**, and the drop came entirely from removing points that were never
earned. **Rule:** when a number looks too good, check whether every input to it is still
true at the moment it is read.

## Pitfall 41 — the span requirement fired on rows that had no spans

Moving gate sanitisation into `score.js` so saved runs could be re-scored broke 21
self-tests and would have zeroed the fixture dataset: rows with a hand-written gate and no
`spans` object had every field dropped as "unsupported".

Absent spans are not failed spans. A row that never made a span-backed claim has nothing
to withdraw. `sanitiseGate` is now a no-op when `row.spans` is absent.

**Rule:** a validator that cannot tell "this failed" from "this was never asserted" will
fail everything that predates it.

## Pitfall 42 — an account with no surface can never be started

Surface discovery reads links off a page an account already owns, which means an account
with **no** verified surface is permanently stuck — exactly where the six candidate orgs
in the universe map were.

The rule against constructing URLs stands: we do not turn "Raydium" into "raydium.io" and
hope. So a **source** supplies the URL instead. DefiLlama's API returns each protocol's own
declared `url`; we fetch it, confirm the page actually names the company
(`NAME_NOT_ON_PAGE` if not), and only then admit it. The directory is a citation for where
to look; the fetched page is the evidence.

Six requested, three seeded. Mango declares no URL; Raydium and Meteora return JS shells
with too little text. That is the honest yield, and it is three more than before.

## Pitfall 43 — an article is not a surface

Discovery admitted `learn.backpack.exchange/articles/what-is-a-sui-wallet-everything-you-
need-to-know` as a Backpack surface. It is SEO content about another chain, written once
and finished — adding it means re-reading a page that will never change, every week.

A long slug was the first test, and `%20monad-wallet` defeated it twice: the encoded space
made it look like two words, and "monad-wallet" is genuinely short. The working test is
structural — **any segment sitting under a collection path**. `/updates` is an index;
`/updates/<anything>` is one post.

**Rule:** classify a URL by its shape, not by its length. And decode before you test.

## Pitfall 44 — 35 liquidations that had nothing to do with Solana

Classifying Backpack, the term search found 35 instances of "liquidation" and several of
"market maker" in its API docs. On a naive count that reads like an execution buyer.

Every one of them is a **CEX margin liquidation**, handled internally by the exchange.
Nothing to do with a keeper bot racing a transaction on-chain.

Signal terms are now split. **Inherent** terms can only mean Solana execution — `priority
fee`, `crank`, `jito`, `blockhash`, `sendTransaction`. **Contextual** terms — `liquidator`,
`market maker`, `latency`, `slot` — count only when the excerpt itself carries on-chain
context. Rejected hits are kept in an `AMBIGUOUS` bucket rather than deleted, so the
reason is inspectable.

This is the same failure as routing a Sonic outage as a Solana task: a word that means one
thing in a trading venue and another in an exchange.

## Pitfall 45 — "we found nothing" and "we read nothing" had the same verdict

Backpack and Zeta both came back `NONE`. They were not remotely the same answer.

- **Backpack**: 392,908 characters of its own API reference read, zero grounded Sender
  terms in any of it. That is a confident **no**.
- **Zeta**: 5,001 characters read, because `docs.zeta.markets/` is a navigation page and
  the actual documentation sits behind it. That is **not an answer at all**.

Confidence now scales with the corpus. Under 20,000 characters returns
`INSUFFICIENT_EVIDENCE` — a missing corpus, not an absent signal. Above it, silence is
evidence of absence.

Finding Zeta's real documentation (`llms.txt`, the TypeScript SDK) moved it from
`INSUFFICIENT_EVIDENCE` to `SENDER_CANDIDATE`.

**Rule:** a negative result is only as strong as the corpus behind it. Report the corpus.

## Pitfall 46 — legal boilerplate can manufacture confidence

Zeta's terms-and-conditions page is 46,230 characters. Admitting it would have pushed the
corpus past the "we read a lot and found nothing" threshold on its own and produced a
confident `NOT_SENDER` built almost entirely out of legal text.

Legal, privacy, cookie and disclaimer paths are excluded from the classification corpus.

**Rule:** if a threshold depends on volume, audit what is supplying the volume.

## Pitfall 47 — the model said the owner was "exchange"

The interpretation step returned `owner_named: true` with `owner_evidence: "exchange"`.

That is not a person and not a role. The same `INFRA_ROLE` test the gate uses now runs
against the model's own answer in code, and demotes it with the reason recorded.

**Rule:** a model's structured field is a claim, not a result. Validate it with the same
rule you would apply to any other claim.

## Pitfall 48 — generic vocabulary outvoted unambiguous evidence

Zeta's SDK ships `updatePriorityFee()` and `getRecentPrioritizationFees`, and its docs
describe "crank instructions that keep our exchange moving" alongside a Liquidator. The
classifier called it `RPC_ENTERPRISE`, because it counted 4 distinct RPC terms against 3
Sender terms and `rpc` and `validator` appear in any chain's documentation.

Two or more **inherent** terms now outrank any quantity of generic infrastructure
vocabulary. Zeta is `SENDER_CANDIDATE`.

**Rule:** weight evidence by how much it narrows the answer, not by how often it appears.

## Pitfall 49 — the owner was on the page, on a different line

Flint's front page lists its team in plain text. The owner search found nobody.

A team listing is **structural**, not textual:

```
Founder
David Gorski
Co-Founder, CTO
prev. Jito Labs · Jump Trading
```

The name and the role are on separate lines, so a line-by-line scan can never see them
together. Flint's CTO — ex-Jito, ex-Jump — was invisible while sitting in plain text on
the front page of an account we had already fetched twice.

The first fix over-corrected: "a block containing a role and two capitalised words" then
read **"Trading Specifications"** and **"Our Mission"** as people, because navigation is
full of capitalised word pairs.

What works is a structural test: a short line that is **only** a name, adjacent to a short
line that is **only** a role. Six people found at Flint, zero false positives on Zeta's
and Velocity's navigation.

**Rule:** when a scan finds nothing on a page you can see the answer on, the defect is the
scan's shape, not the page.

## Pitfall 50 — my own assert rule, broken by me, again

The patch recording Flint's owners applied one of two hunks, asserted `n == 2`, and died
**before the write**. The Flint edit was silently lost, and the self-test that would have
caught it was in the same dead script.

This is Pitfall 32, written by me, violated by me, two turns later.

**Rule, restated:** when a patch has independent edits, write each one separately. An
assert that protects the file also discards the work when the count is wrong — and the
count is written by hand, which is the part that fails.

## Pitfall 51 — the diagnosis was right, the mechanism was wrong

The brief said zero qualified leads were caused by `infrastructure_owner_identified` acting
as a Qualify requirement, and asked for it to be moved to Actionable.

It was already there. `capTo('QUALIFY', 'No infrastructure owner identified.')` means
*cannot exceed Qualify* — it had never blocked Qualify at all. Moving it would have changed
nothing.

Zeta scored **65**, which **is** the Qualify band. Two different caps pushed it down:

- the counter-rationale *"no evidence of an infrastructure gap"* → Research
- *standing condition, not a dated event* → Research

Both were wrong under the intended definition. If **Qualify means "worth assigning a human
research task"**, then "no gap evidenced yet" is *the question the research task answers*,
and a company documenting how its own execution works is exactly what you research.

Both now cap at Qualify — but only for a registry account with first-party grade A/B
evidence. A market-context source, a grade C source or an unregistered entity still caps
at Research. Actionable is untouched.

Result: **the first Qualify in the project's history** — Zeta Markets, 65, grade A,
first-party, Sender-routed.

**Rule:** when a brief diagnoses a cause, check the cause before implementing the cure.
The symptom was real; the named mechanism was not.

## Pitfall 52 — the test row never reached the band it was testing

Three self-tests failed after the cap change, asserting a row should reach Qualify when it
scored 50.

The row had no `productFit`, so it banded as Watch — and **a cap can only lower a verdict,
never promote one**. The caps under test were doing nothing because there was nothing to
cap.

The code was right and the test was wrong, which is the harder of the two to notice: a
failing test is normally read as a broken implementation.

**Rule:** a test for a cap must build a row that reaches the band above it first.

## Pitfall 53 — the context gate widened and let the old bug back in

The product-fit engine scores seven motions instead of one, so the on-chain context gate
was rewritten. The new version included `transaction` and `program`.

Both are everywhere. "Our transaction latency is low" then counted as Solana execution
evidence — and **Backpack scored 10 on Sender**, after 392,908 characters of its own docs
had already proved it has zero grounded Solana-execution terms.

That is Pitfall 44 returning through a wider door, four weeks later, in new code.

The gate is now `solana · on-chain · spl token · mainnet-beta · SOL · validator · lamports ·
slot`. Backpack scores **0** on Sender, consistent with its classification.

**Rule:** when you widen a system, re-test the narrow guard that made the old version
trustworthy. New surface area reopens old holes.

## Pitfall 54 — a single case-sensitive pattern broke "Solana"

`SOL` must be case-**sensitive** or it matches inside "solution" and "console". So the
whole gate was made case-sensitive — and immediately stopped matching **"Solana"** with a
capital S, which is how it is always written.

Two patterns now: everything case-insensitive, `\bSOL\b` case-sensitive, tested both ways.

**Rule:** when one term in a pattern needs different matching from the rest, it needs its
own pattern, not a flag change for all of them.

## Pitfall 55 — corpus size was manufacturing evidence

Reading a few thousand characters awarded a "corpus strength" bonus to **every** product,
so every account scored 3 on all seven motions regardless of content. "No evidence" and
"a little evidence" became indistinguishable, and the whole matrix read as faint positives.

Strength now requires a base signal to strengthen. Zeros mean zero.

**Rule:** a confidence modifier must modify something. If it applies to an absent signal
it is not a modifier, it is a floor.

## Pitfall 56 — "no product fit" with a score of 39

Flint reported `primary_product: none` alongside `product_fit_score: 39` — two statements
that cannot both be true. Triggers and reachability were adding points to a fit that did
not exist: a dated funding round and a known GitHub org, at a company with no evidenced
need.

Triggers and reachability now **modify** a fit and cannot create one. With no fit, the
score is capped at 19 and the verdict cannot exceed Context.

**Rule:** a reason to approach is not a reason to be approached. Keep "is there a need" and
"is now the moment" as separate questions, and never let the second answer the first.

## Pitfall 57 — the first Qualify was a company that shut down in May 2025

Zeta Markets was classified `SENDER_CANDIDATE` on grade-A first-party evidence, given a
full product-fit vector, and promoted to **the project's first QUALIFY**.

Its own documentation says:

> *"Disclaimer: Zeta Markets has ceased operating as of May 2025."*
> *"Zeta Markets has since been discontinued and stopped operations. Bullet is a new
> network purpose-built for trading…"*

That notice was on `docs.zeta.markets` the entire time — a page fetched a dozen times
across the classifier, the owner search, the product engine and three scans. **Every agent
read it for execution vocabulary. None read it for whether the company exists.**

Everything downstream was correct. The SDK really does ship `updatePriorityFee()`. The
docs really do describe cranks and a Liquidator. **Evidence outlives the company**, and a
pipeline that only asks "is this evidence real?" will confidently sell to the dead.

`status.js` now runs before anything is believed: `active · ceased · acquired · succeeded`,
from the company's own words, gating both the scorer and the product engine. A ceased
account returns NO_ACTION whatever its evidence looks like.

**Bullet is registered with no surfaces and no inherited evidence.** A successor is a
different company until its own pages say otherwise.

**Rule:** verify the company before verifying the claim. Ask "does this company still
exist?" first, because every other question assumes the answer.

## Pitfall 58 — then it excluded Coinbase

First run of the status gate reported **Coinbase** as not operating, from Coinbase's own
status page:

> *"BLAST that is not moved off of Coinbase before October 26, 2026 will not be accessible
> to you after the Blast network is shut down."*

**The Blast network** is shut down. Not Coinbase. A third party's closure, announced on the
account's own surface, read as the account's obituary — the same failure as routing a Sonic
outage as a Solana signal, and as attributing Velocity's docs to Drift.

The cessation phrase must now have the **account as its subject**: the company's name has
to appear in the run-up to the phrase, with no other proper noun closer to it. Self-
reference ("we have ceased") counts.

A guard built in one place does not generalise to the next place that needs it.

**Rule:** whenever a rule fires on text, ask *who the sentence is about*. Three separate
bugs in this project have been the same mistake with different nouns.

## Pitfall 59 — the token was pasted three times

The GitHub token returned `401 Bad credentials` despite being well-formed: `github_pat_`
prefix, no whitespace, no quotes, only valid characters.

It was **279 characters** — almost exactly 3 x 93, the normal length. The same token,
pasted three times. `github_pat_` appeared three times in the string.

Diagnosed without ever printing the value: length, prefix shape, character classes, and a
test for whether the string is a repeated block. Repaired by writing back the first
repeating unit, file mode preserved at 600.

**Rule:** when a credential is rejected but well-formed, check its *shape* before assuming
it is wrong. Length is a diagnostic, and a secret can be debugged without being displayed.

## Pitfall 60 — forking a Solana repo is not building on Solana

With the token working, the fork-graph crawler read all 100 forks and produced one new
candidate: **fireflyprotocol**, whose GitHub org declares `bluefin.io`.

Bluefin is a **Sui** venue. Its site does not mention Solana once.

The classifier asked "do they sell what we sell?" and "is this a real company?" — and
never "are they even on the right chain?". An engineer forking Velocity's keeper bots
tells you what they are reading, not what they are building on.

A chain check now runs before anything else about fit: `WRONG_CHAIN` when the site is
about another chain and never mentions Solana.

That is the fourth instance of one mistake in this project — Velocity's docs attributed to
Drift, a Sonic outage routed as Solana, Blast's shutdown read as Coinbase's, and now a Sui
venue read as a Solana operator. **Every time, the system matched on a signal and failed to
ask who or what the signal was about.**

## Pitfall 61 — the evidence was in the README, not the page

DPI Protocol was registered with `github.com/dpiprotocol/dpi-keepers` as its surface and
scored 18 - almost nothing. A GitHub HTML page renders very little text through a fetch.

The evidence was in the README the whole time: *"Keeper Bots for DPI Protocol — Order
Filling & Liquidation Services"*. `raw.githubusercontent.com` serves it as plain text, is
not rate-limited, and is now the registered surface.

**Rule:** when a source scores far below what you know it contains, check whether you are
reading the page a human sees or the page a fetch returns.

## Pitfall 62 — "Orca DEX" could not find Orca

The first DefiLlama batch seeded 5 of 16 accounts. Six of the eleven failures were
`NAME_NOT_ON_PAGE`: Orca, Sanctum, Loopscale, THORChain, Exponent, Templar.

The directory names carry a product suffix — "Orca **DEX**", "Templar **Lending**",
"Exponent **Yield Exchange**" — and the test normalised the whole string and looked for
`orcadex` on a page that says **Orca**.

Name variants now strip product suffixes and also try the first word. The same batch seeds
**11 of 16**. The remainder are genuine JS shells and HTTP errors.

**Rule:** a directory's name for a company is not the company's name for itself.

## Pitfall 63 — a token pair and a name-list became two Sender leads

The batch reported three accounts with Sender evidence. Two were the same word doing
different work:

- **Orca** — *"Jito 750,000+ Total Trades for JTO-paired Orca pools."* Jito as a **token
  pair**.
- **Sanctum** — *"across Sanctum, Jupiter, Phantom, Jito, and Marinade."* Jito in an
  **ecosystem name-list**.

Neither is a block engine. `jito` is a brand that is also a token that is also a company
that is also a product, and bare-matching it manufactured two leads.

The term is now `jito bundle` / `jito tip` / `block engine` — Jito alongside what you
actually use it for.

**Save survived**, and is real: *"Owner: Save — Liquidator — Permissionless — Outflow
limit."* Save runs a liquidator.

**Rule:** a brand name is not a product signal. Match on the thing being done, not the
company whose name is attached to it.

## Pitfall 64 — the org endpoint 404s on a user account

The DPI owner search failed with `GITHUB_404` on `/orgs/dpiprotocol/repos` and reported
"no owners found". `dpiprotocol` is a **user** account, not an organisation.

A lookup that never ran was reported as a result - the same failure as the rate-limited
classification in Pitfall 34, in a new place. It now falls back to `/users/<name>/repos`.

It also skipped `dpi-keepers` entirely, because repo selection filtered out forks - and for
an operator the fork **is** the thing they run.

**Caveat found in the process:** a fork inherits the upstream commit history, so GitHub's
contributor list for `dpi-keepers` is mostly Drift and Velocity people. Only commits after
the fork point are DPI's. The contributors endpoint does not distinguish them.

## Pitfall 65 — the landing page said operator, the docs said venue

Save came out of the DefiLlama batch as the one account with genuine Sender evidence:

> *"Owner: Save — Liquidator — Permissionless — Outflow limit"*

Read on its own, that is a company running a liquidator. Read in context, it is a row in a
**protocol accounts table** — a program-account owner label, not a bot fleet.

Its own documentation settles it:

> *"We rely on third party liquidators, which means anyone can become a liquidator."*

Save is the **venue**. That is now the fifth account to show this shape — Velocity, Zeta,
Flint, Titan and Save all document automation that somebody else runs. **The pattern is
not an exception; it is the norm for protocols.**

The docs did hand over the next seam — `solendprotocol/liquidator`, *"open source version
of a liquidation bot running against solend"* — but that repo is **archived**, last pushed
2022, with 69 forks and exactly one touched since May 2025. A cold trail, recorded as cold.

**Rule:** a landing page is marketing; the docs are the specification. When they disagree
about what a company does, the docs win.

## Pitfall 66 — a 74,907-character terms page as the main "docs" surface

Surface discovery offered `docs.loopscale.com/resources/terms` and `/resources/privacy` as
Loopscale's most substantial documentation surfaces — 74,907 and 73,880 characters.

The classifier had excluded legal boilerplate since Pitfall 46. Discovery had not, so it
was still admitting it into the registry, where it would have dominated every corpus
measurement and manufactured confidence exactly as before.

**Rule:** when you fix a filter, check every other place that makes the same decision. A
rule applied in one module is not a rule.

## Pitfall 67 — the registry was about to cold-pitch Helius's own customers

Reading helius.dev/use-case/trading to ground the product definitions turned up the
customer list. The registry disagreed with it on four accounts:

| Account | Registry said | Helius's own page says |
|---|---|---|
| **DFlow** | COMPETITOR | testimonial from **Nitesh Nath, CEO**: *"we depend on LaserStream to feed our price engine"* |
| **Wintermute** | PROSPECT, tier 1 | listed under *"Some of our partners"* |
| **Ellipsis Labs** | PROSPECT, tier 1 | listed under *"Some of our partners"* |
| **Pyth** | UNCLEAR | listed under *"Some of our partners"* |

Classifying a customer as a competitor is the worst single error this system can make, and
it survived nine rounds of improvement because **nobody ever read the seller's own site**.
Every agent was pointed outward at prospects; none was pointed at us.

`pipeline/helius.js` now holds the customer and partner list, and the funnel disqualifies
anyone on it before scoring, routing them to account management with the known contact.

**Rule:** check your own customer list first. Bob W's tracker had this as data-hygiene rule
number one and the Helius build never implemented it.

## Pitfall 68 — outreach-grade certainty was the test for being useful at all

The system required a proven gap, a named owner, a dated trigger and no counter-rationale
before an account was worth anything. Everything else collapsed into `No action`: **80 rows,
zero leads**, and a queue that looked empty while Solayer Labs advertised the exact role
that proves Sender need, publicly, for months.

That is outreach-grade certainty used as a discovery filter. A BD team does not need proof
of a purchase decision to put an account on a work list.

Five states now, and **nothing silently disappears**: `outreach_ready` · `product_opportunity`
· `research` · `monitor` · `disqualified`. A named owner is required only for
`outreach_ready`. Research tasks are **questions**, not shrugs — *"Who owns infrastructure
at Sanctum? No careers page, GitHub org or named engineer found."*

Same registry, same evidence rules, same caps: **0 leads became 20 on the worklist.**

**Rule:** the bar for *worth looking at* and the bar for *ready to contact* are different
bars. Collapsing them does not make a system rigorous, it makes it blind.

## Pitfall 69 — the pipeline could never discover, by construction

`fetch.js` fetches a URL you already have. It cannot find one. `sourcePlan()` derives from
the registry. The registry only ever grew from itself. The three "discovery" mechanisms all
answered something else:

- `seeds.js` → *which protocols have TVL?* — a ranking, not a signal
- `forks.js` → *who copied this repo?* — a code trail, not a buying signal
- `surfaces.js` → *what else does an account I already know link to?*

None asked *who just raised money, started hiring, or filed with the SEC.* It was a
**monitoring** system being judged as a **discovery** system, and no amount of verification
rigour could fix that — the signals that produce leads live on job boards, in press
releases and in filings, none of which is the company's own page.

`data/signals/` plus `pipeline/discovery.js` is the missing input: a validated schema
requiring org, type, date, source URL, quote, segment, verification level and a mandatory
counter-rationale. Search-sourced signals are **capped at research** in code, so they can
start a question and never authorise an approach.

**Rule:** before tuning a system's thresholds, check whether it is architecturally capable
of the thing you are asking it to do.

## Pitfall 70 — the system was trying to prove a sale

Five states, and the top one was `outreach_ready`: fit **plus** a named owner **plus** a
dated trigger. Nothing ever reached it, and the state below it inherited the same anxiety.

That is the system trying to prove a company will buy. It cannot, and it should not try —
that is the human's job. Asking it to produce "leads" meant asking it to guess the one
thing it has no evidence for, and the result was eighty rows reported as nothing.

Four states now. An **opportunity** is an account where the evidence supports a credible
Helius product conversation, and needs exactly four things:

```
verified account + plausible buyer segment + one grounded product-fit signal + no disqualifier
```

No owner. No trigger. No intent. Every opportunity still shows its primary and secondary
product, fit score, grounded quote, source, date basis and a mandatory counter-rationale —
and the next action is always human work.

Same registry, same evidence, same caps: **0 leads became 8 opportunities and 15 research
tasks.**

**Rule:** build the system to find the conversation, not to predict the outcome. A tool
that must be certain before it speaks will never speak.

## Pitfall 71 — accounts with no readable surface vanished from the worklist

The funnel iterated only accounts with a verified surface. **DFlow** — an existing Helius
customer — and **Bullet** — the successor Zeta names — were silently absent from a list
whose entire promise is that nothing disappears.

An account with nothing readable still belongs on the list, as monitor or disqualified, so
nobody re-adds it as a fresh prospect six weeks later.

And the funnel checked only `COMPETITOR` among relationships, so **Helius itself** came back
as a research task. It now honours every non-prospect relationship the registry records.

**Rule:** a completeness guarantee has to iterate the complete set. "Nothing is dropped" is
a claim about the loop, not about the logic inside it.

## Pitfall 72 — the test policing substring bugs had a substring bug

A new self-test asserted an opportunity's next action never mentions outreach:

```js
!/send|email|contact them now/i.test(op.next_action)
```

It failed. The action was *"Research the **Send**er conversation at Testco"* — `/send/`
matching inside the product name.

That is precisely the family of bug this project has caught four times in its own evidence
matching: `jito` inside a JTO trading pair, `SOL` inside "solution", "liquidation" in a CEX
margin table, Blast's shutdown read as Coinbase's. Written, this time, into the test meant
to police it.

**Rule:** word boundaries in every match, including the ones in your tests. The test suite
is not exempt from the discipline it enforces.

## Pitfall 73 — narrowing the window multiplied the out-of-window rejections

The brief predicted that rolling 14-day batches would *reduce* `DATE_OUT_OF_WINDOW`
rejections, on the reasoning that index pages were forcing the collector to pull candidates
out of years of archive.

It did the opposite, and arithmetically it had to:

| Window | DATE_OUT_OF_WINDOW |
|---|---:|
| One 90-day sweep | 12 |
| 14-day batch (12 Nov → 29 Oct) | 68 |
| 14-day batch (29 Oct → 15 Oct) | 123 |
| 14-day batch (15 Oct → 1 Oct) | 133 |
| 14-day batch (1 Oct → 17 Sep) | 132 |

A narrower window rejects **more** as out of window, not fewer. The pages did not change;
the acceptance band shrank by 85%. **388 rejections across three batches against 12 for
the whole quarter.**

That is not a fault. A rejection with a reason code is the system working, and the real
gains showed up elsewhere:

- **Dated rows decay with age** — 12, then 7, then 3 going backwards. That is a genuine
  freshness signal the single sweep flattened into one undated number.
- **The newest batch surfaced DPI Keepers at QUALIFY 65** on first-party evidence —
  *"DPI Keepers are the backbone infrastructure bots that keep the DPI Protocol running"* —
  which the 90-day run never lifted above the floor.

**Rule:** when a change is justified by a predicted metric, measure the metric. The right
change was made for a wrong reason, and only running it showed which.

## Pitfall 74 — a merge key made of read-time would have doubled everything

Batches overlap at their boundaries and the same page is re-read every run, so a naive
history would have grown by ~300 duplicate rows per sweep.

The merge key is the evidence itself — `event_date | first 80 chars of the quote` — not the
run that found it. Across four batches: **290 new pieces of evidence, 307 already held and
correctly skipped.**

The history also merges **every run on disk** that it has not seen, not just the ones a
given invocation produced, so a batch run separately with `scan.js --from/--to` still lands
in the same history.

**Rule:** key a merge on what the thing is, never on when you happened to see it.

## Pitfall 75 — splitting the collector produced FEWER leads, not more

The single collector carried fourteen event types and a cap of six candidates, so the
model had to pick six winners across fourteen competing categories on every read. Splitting
it into five narrow collectors — execution, infrastructure, incident, commercial, hiring —
each with its own six-candidate budget, looked certain to raise recall.

Three runs over the same window and the same 29 sources:

| Config | Rows | Real companies | **Distinct** | Noise | Cost |
|---|---:|---:|---:|---:|---:|
| Broad prompt only | 60 | 60 | **33** | 0 | **$0.1250** |
| Targeted everywhere | 78 | 53 | 28 | **25** | $0.2434 |
| Targeted + routing + entity filters | 52 | 52 | 30 | 0 | $0.2170 |

**74% more cost for 9% fewer distinct companies**, and the targeted run *lost* GSR Markets,
Zebec Network, Zeus Network, Meteora, QuantumAMM and Pump — all of which the broad prompt
found.

The mechanism, once measured, is obvious. A narrow collector capped at six returns its six
best signals **within one category**, and those are frequently six quotes from the same
company's documentation. The broad prompt returns its six best across the whole page, which
spreads across more companies.

**Targeted collectors buy evidence depth per account and pay for it in company breadth.**

They are not useless — the targeted execution pass is how `dpi-keepers` surfaced with the
quote *"the backbone infrastructure bots that keep the DPI Protocol running"*. They are
simply the wrong tool for discovery. Discovery is broad by default now; `--deep` runs the
targeted set against an account you already hold.

**Rule:** "more targeted prompts" is an intuition about recall, not a fact about it. More
prompts over the same page with per-prompt caps can concentrate rather than widen. Measure
distinct entities, not rows.

## Pitfall 76 — fifteen token tickers arrived as companies

The targeted collectors pulled **"Bonk (BONK)", "Unicorn Fart Dust (UFD)", "Stool
Prisondente (JAILSTOOL)", "Tether USD (USDT)"** and eleven more out of exchange listing
tables — each a correctly grounded quote naming a real ticker, and none a business anyone
can sell infrastructure to. Ten more rows were other chains: Stacks, Hedera, DOT, Flare,
Aerodrome.

The narrow prompts caused it. Told to find one kind of signal and allowed six, they reached
harder into whatever the page held; on a listing table that means tickers. The broad
fourteen-category prompt had been acting as an unintended relevance filter.

`isTokenListing` and `OTHER_CHAIN_ENTITY` now reject both at verification, which is the
same family as "Solana is a chain, not a company" and the `WRONG_CHAIN` verdict. Noise went
25 → 0.

**Rule:** a filter you did not know you had will be removed by a refactor that looks
unrelated. When recall rises, check what the new material actually is before celebrating.

## Pitfall 77 — the product taxonomy was less than half of what Helius sells

The fit engine scored **seven** motions. Helius's own navigation lists **sixteen** across
four categories. Missing entirely: **Preprocessed Transactions, Transaction Rebates,
Validator-as-a-Service, Validator Monetization, Solana Privacy Rings, Historical Data,
Token APIs, Wallet API**.

Eight product conversations could not be detected at all, because nothing in the system
knew they existed.

Worse, one of the seven was **invented**: "Enterprise" is a *pricing tier* on helius.dev,
not a product. The engine had been scoring accounts against a motion Helius does not sell,
and gating it by segment as though it were real.

The segment list was wrong too. **"Searchers"** is one of Helius's declared use cases and
was absent — MEV searchers are named on the Preconfirmations, Shred Delivery and
LaserStream pages as a primary buyer.

**Rule:** read the seller's own navigation before building a taxonomy of what they sell.
Nine rounds of work rested on a product list I assembled from inference.

## Pitfall 78 — twelve of our prospects were already Helius customers

Reading helius.dev properly turned up the customer logo wall on the RPC page: **36 named
companies**. The registry had **twelve** of them as prospects, and **three were sitting in
the OPPORTUNITY list**:

| Account | Was | Evidence on helius.dev |
|---|---|---|
| **Coinbase** | OPPORTUNITY (Webhooks 25) | customer logo wall |
| **Backpack** | OPPORTUNITY (Parsed 18) | logo wall + *"They power a great portion of our infrastructure at Backpack"* — Armani Ferrante, CEO |
| **Loopscale** | OPPORTUNITY (Parsed 14) | logo wall + *"Helius has been a game-changer for us"* — Luke Truitt, CEO |
| Jupiter, Orca, Drift, pump.fun, Zeta, Solana Foundation | research / monitor | logo wall |
| DFlow | was COMPETITOR | two testimonials, CEO and CTO |

Pitfall 67 caught four of these from a single use-case page. The full wall is nine times
larger, and the earlier fix had created false confidence that the check was done.

Nineteen named testimonials are now recorded with person and title, alongside the 36-name
logo wall, the partner list and the named custodians. **Opportunities fell 8 → 6, and all
six are genuinely cold.**

**Rule:** when a check finds something, ask whether you checked the whole surface or just
the page you happened to open. A partial customer list is more dangerous than none,
because it feels complete.

## 79. A prompt that names a buyer type invites the buyer's *assets*

Adding "memecoin snipers" to the collector's hunt order made it return Fwog,
Gigachad, Goatseus Maximus, OFFICIAL TRUMP, Grass and Frontier Stable Token —
six memecoins, scraped off Kraken's status page, where every tradeable asset is
listed as `Name (TICKER) - Solana / Operational`. The entity names alone look
like companies, so the name test could not catch them. The *quote* always puts a
ticker straight after the name, so the test belongs on the evidence, not the
name: `isAssetListingQuote(entity, quote)`. A mirror branch catches the case
where the model took the ticker itself as the entity ("USDT" from "Tether USD
(USDT) - Solana"), restricted to ticker-shaped names so "Kraken" and "NYSE"
survive. 17 asset rows rejected on the next run; zero ticker noise in output.

## 80. A window-tagged run id breaks "latest"

Run ids became `run-<from>_to_<to>-<stamp>`. `/api/latest` sorted them
lexically, so `run-2026-10-29_to_...-2026-11-13T20-39-15` sorted *before*
`run-2026-11-10T19-26-18` and the interface showed a three-day-old run as live.
Sort on the trailing ISO stamp, the only part that orders runs in time. The
lesson is that an id which gains a prefix silently invalidates every sort that
assumed the id began with its date.

## 81. The prompt was never the thing limiting list length

Three runs of the same 14-day window: the baseline, the revenue-ranked prompt,
and the revenue-ranked prompt with a wider source plan. Distinct companies went
60/33 → 29 (6 of them tickers) → 21 (0 tickers) → 21 (0 tickers, two of them
new). Quality rose sharply — Wintermute, GSR, Ellipsis Labs, Kalshi, NYSE, ICE,
all rank 1–4 buyers — but the count did not, because `sourcePlan()` is
registry-bound: it reads the surfaces of accounts already in the registry. No
prompt can name a company that is not on a page the run fetched. 100 of 307
rejections were `DATE_OUT_OF_WINDOW` or `DATE_UNVERIFIABLE`, which is the second
ceiling: discovering *names* and scanning *dated events* are different jobs, and
a 14-day dated scan throws away the name lists that would lengthen the pipeline.

## 82. Passing the shard instead of the shard's text

`shardText()` returns `{ i, of, from, to, text }`. The discovery pass passed the
whole object where the prompt wanted a string, so every model call received
`[object Object]`. The model did exactly the right thing — it reported no
companies — and the pass printed `0 candidates, 0 rejected` with no error
anywhere. A clean zero is the most dangerous possible output: it is
indistinguishable from an honest empty run, which this system treats as a valid
result. The only reason it was caught was that the page in question was known to
name six firms. Lesson: when a pass returns zero, check the prompt that was
actually sent, not the code that built it.

Same shape of bug as the field names: `fetchSource` returns `pageText`, reports
failure in `{ ok: false, error }` rather than throwing, and `modelText` is only
the first 14,000 characters. Reading `page.fullText` returned `undefined` on
every page and the pass reported nine empty fetches.

## 83. The seller is on the prospect list

The first discovery pass returned **Helius** as a candidate, and filled 36 of
its 71 infrastructure-tier slots with Syndica, Chainstack, Blockdaemon,
GetBlock, dRPC, Allnodes, Google and AWS — the companies Helius competes with
for the same budget. `heliusRelationship()` covers customers, partners and the
logo wall, so it had nothing to say about either the seller or a rival.
`sellerSideReason()` now checks both before any prospect gate. Pitching a
competitor is not a wasted call, it is a leak; and Helius was only kept out of
its own pipeline by the accident of a too-short quote.

## 84. An acronym is not a ticker

`isTokenListing` rejected **Amazon Web Services (AWS)** as a memecoin, because
it treated any parenthesised capitals as a ticker. The structural difference is
that a ticker is a new string while an acronym is built from the initials in
front of it: `Amazon Web Services` → `AWS`, but `Fwog` → `F`, not `FWOG`. Every
looser rule tried — subsequence matching over the name's letters — let
`Goatseus Maximus (GOAT)` and `Tether USD (USDT)` straight back in, so the
strict initials test is what shipped. Known accepted limit: an acronym taking
letters from inside a word (`Intercontinental Exchange (ICE)` → `IE`) is still
rejected. Keeping memecoins out of a BD list is worth more than catching a rare
bracketed acronym, and in practice those firms arrive with no bracket at all.

## 85. Discovery cannot hand itself to the registry

The discovery pass works: 9 rosters, 149 names new to the registry, 40 of them
in the trading and institutional tiers, for $0.026. It cannot promote any of
them on its own, and should not be made to. A registry entry needs a **verified
first-party surface**, and a roster names a company without linking to one —
`discoverSurfaces()` reads the surfaces of accounts already in `ICP`, so it
cannot help either. Inventing a homepage from a company name is exactly the
fabrication this system exists to prevent (the first draft of `sources.js`
guessed six blog URLs and four were 404s). The bridge therefore has to resolve
each candidate's own site from a cited source — the roster's own per-project
pages carry an outbound link — and that is a build, not a flag. Until it exists,
discovery output is a research queue a human reads, which is what it claims to be.

## 86. Rolling batches backwards cannot reach the past

The 90-day sweep ran as seven 14-day batches. Dated rows per batch, newest
first: **21, 6, 1, 1, 1, 1, 0**. Thirty-one dated findings across ninety days,
twenty-one of them in the most recent fortnight.

That is not the window logic failing. It is what the sources are. The registry's
surfaces are **index pages** — a blog front page, a status page, a changelog —
and an index page shows the present. Walking the window backwards over a page
that only contains the last ten posts finds nothing, and the rejection counts
say so directly: `DATE_OUT_OF_WINDOW` climbs from 44 in batch 1 to around 90 in
every later batch, because the pages keep offering the same recent dates and the
window keeps refusing them.

So a batch timeline built this way is honest but thin: one real batch, then six
batches of re-read documentation. Reaching actual history needs **paginated or
archived sources** — `/blog/page/4`, a changelog's older entries, an IR archive —
not more windows over the same front pages. Until those are in the plan, the
sweep's value is the single most recent batch plus the account history it merges.

## 87. An undated page was re-read once per window

The same sweep collected **130 standing conditions for 22 distinct facts** —
every one appeared in more than one batch — and that duplication was roughly
half of the $0.59 it cost. The merge deduped them correctly on
`date|quote`, so the artefact was right; the money was already spent at
collection.

The definition gives the fix away. A standing condition is a fact read off a
page that **carries no date**. Such a page cannot produce a dated row in this
window or any other, so reading it again for six more windows buys nothing.
`batches.js` now retires a surface after the batch that first read it, but only
if that surface produced **standing conditions and no dated row**. A surface
with even one dated row stays in the plan, and so does a surface that produced
nothing at all — a blog index whose posts were all out of window this time may
be in window later, and retiring it would hide exactly the history the sweep is
looking for.

**Measured, not assumed.** The same seven batches re-run with the rule: cost
$0.5924 → **$0.3840 (35% less)**, standing rows 130 → 70, dated rows 31 → **35**,
accounts with a dated event 11 → **14**. A name-by-name comparison of both runs
shows **no dated entity lost**, and three gained — Aria, Anchorage Digital and
Metaplanet. A cost fix that quietly dropped evidence would have been worse than
the waste it removed, so the check is the point, not the saving.

## 88. Helius was an account on its own worklist

The sweep's funnel printed:

    Helius
       Already a Helius customer.
       NEXT: Route to account management, not BD.

Wrong twice: Helius is not its own customer, and there is nobody to route it to.
The seller reached the account list because `heliusRelationship()` matched it
against the logo wall, and the funnel's disqualifier map only knew how to say
"customer" or "partner". `sellerSideReason()` now runs ahead of that map in both
the funnel and the discovery pass, and says what is actually true: *this is
Helius, it is the seller, not an account* — next action **none, remove from the
list**, not a handoff.

## 89. "Latest" meant the last file written, and a sweep walks backwards

Fixing the run-id sort (Pitfall 80) introduced a worse bug than the one it
fixed. Sorting on the trailing write stamp is correct for ordering *when a run
happened* — but `batches.js` walks **backwards**, so batch 7 (the August window)
is written last and therefore won. The interface spent the whole sweep showing
three-month-old evidence as the live run, with the correct window printed right
next to it.

"Latest" means the most recent **evidence window**, not the most recent write.
The run id carries the window (`run-<from>_to_<to>-<stamp>`), so sort on the
window's end date and keep the write stamp only as the tie-break and as the
fallback for older ids that have no window in the name. Both bugs came from the
same root: an id gained a prefix, and every sort that assumed the id began with
its date silently started answering a different question.

## 90. The two halves of the system could not read each other

The bridge verified 135 surfaces across 59 promoted accounts. The next 90-day
sweep then planned 179 surfaces and **refused 125 of them** with
`SOURCE_NOT_WHITELISTED` — every single surface of every account the bridge had
just promoted: `save.finance`, `sanctum.so`, `loopscale.com`, `astralane.io`,
`basis.markets`, `edgex-1.gitbook.io` and the rest.

The cause is that the two sides used different definitions of trusted. The
bridge fetches with `skipWhitelist: true` — it has to, because the whole point
is reading a host we have not approved yet, which is what discovering a company
means. It then applies a *stricter* test than any hand-check: the page must
fetch, the company must **publish** it (its own registrable domain, or a
docs/GitHub space carrying its name), and the page must **name** the company.
A surface that passes all three is a first-party source by construction.

The scan, meanwhile, enforced a hand-written whitelist and had never heard of
any of them. So the bridge's entire output was locked out of the pipeline, and
the batch sweep that was supposed to measure it read 54 sources instead of 179
and reported "1 dated row" for windows where it had simply never opened the
pages.

`whitelistEntry()` now falls through to bridge-verified hosts, then to hosts of
registry surfaces already marked `status: 'verified'` — which fixed a second,
older instance of the same bug: `sanctum.so` and `loopscale.com` sat in
`icp.js` marked verified, trusted enough to plan a run around and not trusted
enough to read. Every admitted host records which account it was verified for,
so provenance stays traceable, and an unknown host is still refused.

Readable surfaces in the plan: **54 → 179.**

The general lesson is that "verified" meant two different things in two files,
exactly as "verified account" had meant two different things one build earlier
(Pitfall 83 and the two-flag rule). When a word carries a decision, it has to
mean one thing everywhere, and the place it breaks is the seam between two
components that were right on their own.
