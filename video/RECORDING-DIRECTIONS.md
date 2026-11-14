# What to film — six takes, about 95 seconds of footage

Read this once, then film. **Six separate takes, not one long one** — short takes
cut together; one long take has to be salvaged.

## Before you start

```bash
cd "/Users/kerriedonaghue/BD tracker/helius-bd-tracker"
node server.js
```

Then in the browser, open **http://localhost:8742** and **hard-refresh** (Cmd+Shift+R).

**Settings that matter**
- Record at **1920×1080**. QuickTime → File → New Screen Recording → drag a 16:9 box,
  or just record the full screen if it is 1920×1080.
- **Hide your bookmarks bar and any notifications.** Do Not Disturb on.
- Browser zoom at **100%** (Cmd+0).
- **No cursor hunting.** Know where you are clicking before you start the take. A cursor
  that wanders for three seconds is three seconds we cut.
- Move slowly. Everything reads faster on film than it feels while recording.

Save each take as `take-1.mov`, `take-2.mov` … in `video/footage/`. Send them to me.

---

## Take 1 — the worklist  (target 18s)

**The point:** the thing produces a real list, and every row shows its evidence.

1. Start on the hero — *"Stop a press release becoming a hot lead"* — hold **2s**.
2. Click **OPEN THE QUEUE**.
3. Let the queue land. Hold **3s** without moving.
4. Scroll slowly down through the opportunities — about **8s** of scrolling. Slow enough
   to read a row.
5. Stop on any row with a visible quote and source URL. Hold **4s**.

*Do not click into anything. This take is only "it has real output."*

---

## Take 2 — the audit, in the terminal  (target 25s)

**The point:** this is the beat the whole film turns on, so this take matters most.

Open a terminal, make the text large (Cmd+ a few times — it must be readable at 1080p),
and:

```bash
cd "/Users/kerriedonaghue/BD tracker/helius-bd-tracker"
node audit.js
```

1. Start recording **before** you press return, with the command typed and waiting. **1s.**
2. Press return. Let it run — it takes a couple of seconds.
3. Scroll up to the top of the output, then scroll **slowly down through all of it**,
   about **15s**.
4. **Stop and hold 5s** on the two lines that matter:
   - `PARAPHRASE of a sentence that IS on this page -> fires on 2.3%`
   - `quoteIsGrounded ranks 1 of 47`
5. Then scroll to the very bottom and hold **3s** on
   `All criteria met — detector ranked 1 of 47, luck-adjusted separation 89.1%`.

---

## Take 3 — the attacks  (target 12s)

```bash
node attack.js
```

1. Press return, let it run.
2. Scroll down through the blocked attacks — about **7s**.
3. Hold **4s** on the last line: `26 attacks · 26 blocked · 0 got in`.

---

## Take 4 — the attestation  (target 15s)

**The point:** the privacy claim is a live call, not a sentence in a README.

1. Back in the browser at **localhost:8742**.
2. Click **ABOUT** in the top navigation (it is the red link).
3. The panel fetches live — give it **2s** to populate.
4. Hold **4s** on **Where this inference ran**: the signing address and the runtime.
5. Scroll down slowly through **Hardware proof** and **Measurements** — about **6s**.
6. Hold **3s** on `Intel TDX quote — present, 10,012 chars`.

---

## Take 5 — the escrow on chain  (target 15s)

**The point:** a real transaction a judge can click.

1. Open **https://testnet.nearblocks.io/txns/23DsHwtrve8XQBYDTqKhrukqqYPfQTBj2josAZErkR67**
2. Hold **4s** on the transaction page.
3. Scroll to the **logs / events** and hold **6s** on the settle event —
   `"reason":"QUOTE_NOT_IN_SOURCE","outcome":"REFUND","state":"REFUNDED"`.
4. Then open **https://testnet.nearblocks.io/address/helius-escrow-81631.testnet**
   and hold **5s** on the transaction list, so the four calls are visible together.

---

## Take 6 — a live scan starting  (target 10s, optional but good)

**The point:** it runs, now, against the real web.

```bash
node --env-file-if-exists=.env scan.js --from 2026-11-01 --to 2026-11-14 --budget 0.15
```

1. Press return.
2. Record about **10s** of it fetching and collecting — the `[collector] fetched …` lines
   scrolling past.
3. You can stop the recording while it is still running. We only need it moving.

*(This spends about 15 cents of the NEAR credit. Skip it if you would rather not.)*

---

## What I do with these

I cut them into the film at the points where the voiceover names them, under the
narration in `VOICEOVER.md`. The existing animated scenes stay as the spine — your
footage is the proof underneath the claims.

**If a take goes wrong, just do it again and send the good one.** Name them clearly.
