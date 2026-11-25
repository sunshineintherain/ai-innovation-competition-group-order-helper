# Campus Group Order Assistant

## Before the room opens

Run `node server.mjs` in the project folder. Open the printed local address. Keep the app in one tab and the seven-slide presentation in another at `/slides.html`. Arrow keys and the Previous / Next buttons navigate the browser deck. The PowerPoint copy is in `presentation/deck`. Both versions work offline. Keep the board in demo mode and use **Demo controls → Reset demo** before each run. The simulated clock reads 1 December 2026, 12:10 MYT.

## Ten-minute live presentation

| Time | Show | Say and do |
| --- | --- | --- |
| 0:00–0:45 | Slide 1 | “A student finishes class at 12:20 with RM12 in mind for lunch. They can join someone else's order, provided the pickup fits and their own lunch costs less. What should they do?” Introduce the public Atrium counter and the fictional Demo Café. |
| 0:45–1:35 | Slide 2 | “Aster needs to leave by 12:50. Birch arrives at 12:35. Someone coordinating in chat has to discover those fifteen minutes, read the offer and check each person's share. If Birch runs late, that work starts again.” Point out that more people or a larger discount cannot create extra time. |
| 1:35–2:15 | Slide 3 | Read Aster's sentence aloud. Explain the information the assistant retains and the student's opportunity to correct it. “I can leave the board after publishing my intention. The next student can trigger the calculation.” |
| 2:15–3:30 | Slide 4, then the browser board | Reset the demo. Compare each solo price with the group share on the same card. Point to the RM20 eligible threshold, RM4 reduction and RM18 total. “Aster saves RM2.18 and Birch saves RM1.82.” Distinguish the 13:40 merchant cutoff, 10-minute preparation and 12:25 deadline for the selected 12:35 pickup. Click **Confirm for Aster** only. |
| 3:30–4:25 | Slide 5 briefly, then the board | Edit Birch's request. Set **Earliest pickup (MYT)** to 12:55, leave the latest at 13:00, and **Save changes**. Read the waiting reason. “The prices still qualify. These two people now have no common pickup minute. The earlier proposal and its confirmation have gone.” |
| 4:25–5:50 | New request | Select the new-request action. Enter “I want the RM10 rice bowl from Demo Café. I can pick it up between 12:30 and 12:45 today.” Select **Read my request**, check the populated fields, choose **Clover**, and **Publish request**. Point to Aster and Clover. Their common pickup interval is 12:30–12:45. Birch stays available for a later partner. |
| 5:50–6:35 | Group card and activity | Confirm for Aster and Clover. Read RM18 and the Atrium counter in the summary. Refresh. Show the same confirmed summary. Read one real candidate check and one proposal event from the activity log. “This is the end of the agreement recorded by our prototype.” |
| 6:35–7:45 | Merchant catalog | Open **Merchant catalog**. Select **Load review example**, then **Check terms** if needed. Show the source paths for the missing end time and ambiguous threshold. Select the eligible-item subtotal and enter 1 December 2026, 14:00 MYT. Click **Apply corrections and recheck**, inspect the preview, then **Confirm and activate**. The board recalculates with the reviewed catalog. These values are supplied by the fictional demo rule. A real reviewer would need an authoritative public source. |
| 7:45–8:55 | Slide 6 | Trace the local English interpreter, catalog lookup, time checks, solo/group quotes and shared state. Explain the RM30 test: two requests worth RM22 wait, a third RM10 bowl arrives, and all three pay RM28 together. “People keep their original choices. The assistant discovers a feasible combination when it exists.” Explain that fixed-value vouchers can target limited items and that the fee is charged per order. |
| 8:55–10:00 | Slide 7 | Separate the RM4 simulated saving from pilot questions. “We would start with one authorized public menu. A reviewer would own each rule and its expiry. The pilot would measure confirmed groups, actual pickups and differences between quoted and collected totals.” Close with the student's decision: “Can I collect in time, and what will I pay?” |

If time is short, show the two flagged catalog terms and proceed to slide 6. Reset the demo between attempts. If the optional model is unavailable, point to the reported parser mode and use the same structured fields.

## Five-minute Q&A

**0:00–1:00 · What makes the assistant useful after someone posts?**  
It retains the item, acceptable window and minimum saving. A new request, changed time, withdrawal or catalog change triggers a fresh board evaluation. The Aster–Clover replacement demonstrates this without a second post from Aster.

**1:00–2:00 · How do you avoid overstating the saving?**  
We compare a shared basket against each person's best eligible solo quote, including fees, product scope and discount caps. The engine works in sen. Shared payments follow original item values, with leftover sen assigned in decreasing order of fractional remainder. Request ID breaks a remainder tie. A test gives Aster a RM3 solo voucher: RM9 solo beats RM9.82 shared, so that combination is declined.

**2:00–3:00 · Could the first two arrivals block a better third person?**  
The engine evaluates every subset of requests at the same merchant and pickup point, within a 12-request board. It compares disjoint combinations globally by total saving after enforcing every time window and individual minimum. Earlier pickup breaks a saving tie. A partially confirmed proposal can be replaced. A completed summary records an agreement for its members.

**3:00–4:00 · How do you handle unreliable language or a wrong merchant rule?**  
Show missing-field questions or the editable form, and identify the active parsing mode. The pricing code uses reviewed fields. The importer points to individual JSON rules and blocks activation while material terms need review. Recheck a corrected rule and revisit the proposed shares. Only enter permitted public merchant material.

**4:00–5:00 · What would a real pilot require?**  
The team needs a merchant willing to verify rules and a public collection point, someone responsible for menu changes, and a plan for replacements or missed pickups. The local demonstration uses shared controls and fictional aliases. A multi-user deployment needs member-specific authorization and durable operations. The present endpoint is an agreed summary. The team has not measured real demand, campus-wide savings or fulfillment.
