# Mercenaries Play Assistant

Start the app with `Launch Play Assistant.cmd` on Windows with Python 3 available, or serve the `docs` folder over localhost or HTTPS. Open http://localhost:8765. The launcher starts a local server and opens your browser. Keep its window open during use. Use the browser∫w^~)ﬁus Install command when offered.

The three digital sheets are based on PDF pages 35∫w^~)ﬁw37 of the Mercenaries rulebook. The force roster totals Battle Value, and the contract ledger tracks support points and reputation. The employment tab records negotiated terms. Enter support, pay, and coverage values from your campaign; agreement text and edge-case rules remain available in the source PDF.

Attach your own rulebook on the Rulebook & backups tab to open its original sheets. Campaign data stays in the browse{ßuÁ‚ùÁYs local storage and PDFs in IndexedDB. Export JSON to back up or transfer the campaign. The attachment is stored separately. The installed app can reopen offline after its first successful load.

## Contract Board

Set the current system, Force Scale, travel mix and travel cost method, then publish ten offers. The default board has six travel contracts and four on-world contracts. The board and campaign are saved on this device. Download the board as Markdown to share the offers, or load one into the Contract sheet. Generated destinations and jump counts are campaign estimates. The four summary cards at the top open the fields that feed those totals.

## Private GitHub sync

Open Load, enter an owner/repository for a private GitHub repository, and connect with a fine-grained token scoped to that repository with Contents read and write. The app keeps the token only for the current session. Save creates a company XML file under companies/. On another device, connect and select that file from Load. Autosync saves linked edits automatically and checks for newer snapshots while connected. If both copies changed, download the local XML before loading the GitHub copy.

On the Contract sheet, adjust the offered steps before choosing Sign contract. Negotiation uses up to twice Scale in available Reputation and up to two exchanges of two concession steps for one upgrade step. Sign records a snapshot in MSRB History. Current campaign Reputation remains the basis for future negotiations.

The GitHub Pages site publishes the PWA from `main` / `docs`. Update the app files there and bump the service worker cache version in `docs/sw.js` when changing the cached app shell.
