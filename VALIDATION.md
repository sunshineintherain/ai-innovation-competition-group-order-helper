# Validation record

Verified on Windows using Node.js 24.22.3, Playwright and Google Chrome in an English locale. The scenarios below use synthetic catalog and student data. MYT is UTC+8. The demo has a reproducible clock independent of the venue computer's date.

## Executed checks

| Command | Observed outcome |
| --- | --- |
| `node --test test/*.test.mjs` | 24 passed, 0 failed, 0 skipped. Includes real local HTTP requests and restarting the test server. |
| `node test/browser.cjs` | Passed the normal browser entry at 1366 × 880 and 390 × 880. Both completed the initial summary, edited Birch, published Clover from English input, confirmed the replacement group, withdrew Clover and visited the catalog. |
| `node test/browser-import.cjs` | Passed actual file upload, blocked activation, two human corrections, price revision after partial consent, refresh and final summary. Used the bundled Playwright package via NODE_PATH. |
| `node server.mjs` | Opened the local prototype at http://127.0.0.1:4173. |

The browser checks used temporary state and a fresh server. The main test asserted zero horizontal page overflow, an English document and no visible CJK characters on the sampled board, request, summary and catalog views. Both scripts checked for browser page errors. The English interface strings, activity messages and simulated catalog were also inspected during integration. This is desktop-browser mobile emulation; physical handset testing remains open.

## Acceptance evidence

| Input or change | Expected decision | Observed result |
| --- | --- | --- |
| RM12 + RM10 at 12:20–12:50 and 12:35–13:00; threshold RM20, discount RM4, fee RM0 | Positive savings with common pickup | 12:35–12:50, confirm by 12:25. RM9.82 + RM8.18 = RM18.00. One simulated match, RM4.00 net saving. |
| Change Birch to 12:55 earliest | Withdraw the original match | No match. Both requests show “Your pickup windows do not overlap.” |
| Add Clover, RM10, 12:35–12:50, using English | Reuse Aster's standing request | Aster and Clover match; Birch waits. Both confirm successfully. Withdrawal releases the group. |
| RM22.00 threshold and exactly RM22.00; then reduce an item by one sen | Inclusive threshold; explain shortfall | RM18 total at equality. RM0.01 short after the edit. |
| Only the RM12 item qualifies for a RM20 threshold | Count only eligible goods | RM8.00 short. |
| Increase threshold to RM30, then add a third RM10 request to RM12 + RM10 | Pair waits; triple qualifies | One group of three, RM32.00 before discount, RM28.00 payable. |
| Solo RM3 off Aster's item; shared offer RM4 | Protect a member who would lose money | No proposal. Aster would pay RM0.82 more than ordering alone. |
| Fee RM1 per order with no discount | Compare two solo fees with one group fee | RM22 gross, RM23 shared total, RM1 net saving. Shares RM12.55 and RM10.45. |
| Overlapping stackable rules limited to the same goods | Cap discounts at eligible value | Stacked same-item discounts leave RM10.00 payable. Exclusive alternative leaves RM13.00. |
| Offer ends 12:18; clock changes to 12:19 | Recheck eligibility | Eligible at 12:18; expired on the next minute. Separate assertions cover merchant cutoff and insufficient preparation time. |
| Four compatible requests with an offer reusable per order | Compare disjoint alternatives | Two separate pairs save RM8 total. Reversing request arrival order yields the same assignment. |
| One member confirms, then Lunch Set increases to RM14 | Invalidate old consent and reprice | New proposal key, zero confirmations. RM11.67 + RM8.33 = RM20.00. |
| Parallel and repeated confirmations for Aster and Birch; restart service | One durable summary and each consent recorded once | HTTP test returned one complete group with the two unique IDs, total RM18 and one completion event. |
| Upload `fixtures/needs-review.json` | Point to ambiguous threshold basis and missing validity end | Activation disabled. Browser displayed both JSON paths. Corrected basis and end produced a valid preview and activation. |
| Turn off the optional local model endpoint | Keep a usable draft and show fallback | Mocked endpoint failure returned an editable catalog item and an explicit unavailable-model status. |

## Reproduce the three-member case in the browser

Reset the demo. In Merchant catalog, select **Review terms for Demo Café**. Change `offers[0].threshold` from 2000 to 3000, check the terms, then activate. Aster and Birch now lack RM8. Publish Clover's RM10 Rice Bowl with the same date and a 12:35–12:45 window. All three can collect at 12:35; their combined RM32 basket triggers the RM4 discount. Reset the demo to restore the original offer.

## Evidence by judging category

| Category | Where to look |
| --- | --- |
| Problem identification and relevance · 20% | Slides 1–2 and the two fictional lunch schedules. |
| Innovation and creativity · 20% | Move Birch's window, publish Clover once, and inspect the automatic new match. Use the three-member threshold walkthrough to show a combination missed by pair-only matching. |
| Functionality and technical implementation · 25% | Editable parsing, source-linked catalog decisions, computed activity, API/state tests, browser workflow and README decision rules. |
| Practical application and potential impact · 20% | Per-member and total net savings, merchant onboarding path, current limits and proposed pilot measures. All reported savings are simulated. |
| Presentation and demonstration · 15% | Seven English slides, timed ten-minute presenter guide, five-minute Q&A and resettable browser demo. |

