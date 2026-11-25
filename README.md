# Campus Group Order Assistant

A student leaving class at 12:20 has until 12:50 to collect lunch. A second student wants a meal from the same counter. This local English web app checks whether their pickup windows overlap and whether **each student** would benefit after solo discounts and fees. A request stays on the board so a later arrival can unlock an offer.

## Run the prototype

Use Node.js 22 or 24. From the project directory run:

```sh
node server.mjs
```

Open **http://127.0.0.1:4173** in a browser. The core application needs no installation, network connection, API key or model download. One Node process owns one board. Stop it with Ctrl+C. Set `PORT` to change the port, or `CAMPUS_STATE` to use a different state file. Use a separate state file for each running server. The default store is `.local/board.json`. The local URL works on the computer running the server.

**Demo controls → Reset demo** restores the two fictional students, original menu, simulated offer and frozen 1 December 2026, 12:10 MYT clock. The separate public board uses current Malaysia time. Its directory starts empty. A reset preserves public merchant data and public requests.

## Five-minute product walkthrough

1. On **Board**, inspect Demo Café. Aster's RM12 Lunch Set and Birch's RM10 Rice Bowl qualify for RM4 off RM20. Their shared pickup window is **12:35–12:50**, with pickup proposed at **12:35**. Confirm by **12:25** to allow ten minutes of preparation. The merchant's order cutoff is **13:40**.
2. Compare best solo with group pay. Aster saves RM2.18 and Birch saves RM1.82. Confirm for each alias to produce a summary. Refresh. The agreement is still there.
3. Choose **Edit Birch** and set earliest pickup to **12:55**. Save. Both original requests remain visible with the time-conflict explanation.
4. Choose **New request**. Use Clover and enter *“I want the RM10 rice bowl from Demo Café. I can pick it up between 12:30 and 12:45 today.”* Click **Read my request**, review the fields and publish. Aster and Clover now share a 12:30–12:45 window. Both confirm the new terms. Try withdrawing Clover to see the board release the group.
5. Open **Merchant catalog** and upload `fixtures/needs-review.json` or choose **Load review example**. Two fields need review. For this fictional exercise the verified threshold counts eligible items before fees, and the offer ends at **2026-12-01T14:00**. Apply the corrections, check the preview and activate. Source paths identify each rule in the JSON.
6. Return to **Demo controls → Reset demo** for the next judge. The English slides are available from Demo controls or at **/slides.html**.

## Architecture and decision rules

| Component | Responsibility |
| --- | --- |
| Browser | Editable English draft, member actions, catalog review, match and summary cards. Polls the board every four seconds. |
| Intent tool (`intent.mjs`) | Grounds item names, amounts, quantities, dates and pickup windows in the active catalog. Returns fields and targeted questions. An optional local model can propose draft fields. |
| Catalog tool (`catalog.mjs`) | Validates one structured merchant JSON file and reports field paths. Human review gates activation. |
| Matching and pricing tools (`engine.mjs`) | Check service date, pickup point, opening hours, order cutoff, prep and intersection. Enumerate candidate baskets, price solo and shared alternatives, then select compatible disjoint groups. |
| Coordinator (`board.mjs`) | Handles request, catalog, clock and consent events. Chooses between waiting, proposing, invalidating consent and producing a summary. Uses tool results for English activity and reasons. |
| Local HTTP service (`server.mjs`) | Serializes mutations within one process and atomically replaces the local JSON file. A timer and incoming requests check real-time changes on the live board. Raw student sentences are processed in memory. |

The demo clock advances through the controls. Live mode evaluates current order placement at minute precision. Offers include both their start and end minutes. Future-dated requests wait until their service day. A proposal's deadline is the earliest of the merchant cutoff, the proposed pickup minus prep, and an applied offer's end. Passing a deadline can produce a later feasible pickup with fresh consent.

Each merchant has one public pickup point and a same-day opening interval. Every basket includes a flat fee once. Fixed discounts use the eligible subtotal before fees and each offer's cap. The engine compares exclusive offers with compatible stackable offers. Stacked discounts cannot consume the same item's value twice. Solo-only promotions affect the baseline. The allocation splits the final total in proportion to original item subtotals using integer sen. Remaining sen go to the largest fractional remainders, then to ascending request ID for ties.

Every member must meet their minimum saving, nobody can pay more than their best solo price, and combined net saving must be positive. The board maximizes the sum of net savings across disjoint groups. Equal-saving plans prefer earlier pickup times. Enumeration is bounded to **12 requests per board**. Each request contains one menu item and quantity, up to 20 units. Withdraw old requests to free an alias and board slot.

A changed proposal receives a new confirmation key. The server checks the current key and member ID on every confirmation. A completed summary records an agreement at that moment. It stays available through clock changes and new arrivals. Editing or withdrawing a member or activating changed terms for that merchant reopens the decision. Identity controls are intentionally limited to fictional aliases on a shared presenter-operated board.

## Import the next merchant

Start with `fixtures/demo.json`. Prices, thresholds, discount amounts, caps and fees are integer sen. The supported input is UTF-8 JSON, one catalog per file, under 128 KB. `demo: true` routes to the demo directory; `false` routes to the reviewed public directory. Give each directory its own merchant IDs. Edit and reactivate the same ID to revise terms. Include explicit local validity timestamps and the applied item IDs. The fixed discount can be its own cap. Unknown terms, ambiguous threshold basis, missing dates and unrecognized fields block activation.

Use the approved public merchant's own published menu and rules, with a designated reviewer and a source update schedule. Resolve every material ambiguity against the source. The prototype preserves field locations within the uploaded JSON. Converting a PDF, photo, percentage discount, delivery tariff or overnight trading interval requires translation into supported rules or a separate parser and tests. Keep personal, non-public and confidential material out of project inputs, logs and presentation materials. Use only fictional aliases. No real merchant data was supplied for this build.

## Language mode

The default **Local English parser** handles catalog-grounded English requests offline. Inspect every draft before publishing. For an existing Ollama installation with a locally available model, set `CAMPUS_MODEL` to that model's tag before starting the server. The optional adapter calls only the local Ollama generation endpoint on port 11434, with a six-second timeout. Model output can populate the editable form. All eligibility, amounts and consent remain in deterministic code. A connection failure or unusable model response falls back to the parser and displays the mode. This build was demonstrated with the offline parser; an actual model installation and its accuracy have not been evaluated.

## Tests and competition materials

```sh
node --test test/*.test.mjs
node test/browser.cjs
node test/browser-import.cjs
```

The browser tests require Playwright and an installed Chrome browser. In a standalone development checkout, use `npm install --no-save playwright` if needed. The core app has no third-party runtime dependencies. In the Codex desktop runtime, set `NODE_PATH` to the bundled Node package directory for the import test. Each browser test uses an isolated temporary server and state file. See [validation evidence](VALIDATION.md), [tool disclosure](DISCLOSURE.md), the [browser slides](public/slides.html), and the presentation folder for the offline deck and speaking notes.

The team should rehearse on the actual venue computer, review the English artifacts, confirm team originality and tool disclosure, and decide whether an approved public catalog is ready for a pilot. The measured outcomes are simulated. Adoption, collection reliability, real spending and coordination time require a pilot. The submission deadline is **16 December 2026**. Submission and final sign-off belong to the team. The handbook prohibits amendments or resubmission after submitting.

