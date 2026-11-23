# Mercenaries Play Assistant

## [Launch the Play Assistant](https://abnormalus.github.io/Battletech-Play-Assistant/)

Open the hosted app in your browser. Anyone can use it without downloading or hosting a copy. To install it as an app, use your browser’s **Install app** or **Add to Home Screen** option when available.

The three digital sheets are based on PDF pages 35–37 of the Mercenaries rulebook. The force roster totals Battle Value, and the contract ledger tracks support points and reputation. The employment tab records negotiated terms. Enter support, pay, and coverage values from your campaign; agreement text and edge-case rules remain available in the source PDF.

Attach your own rulebook on the Rulebook & backups tab to open its original sheets. Campaign data stays in the browser’s local storage and PDFs in IndexedDB. Export JSON to back up or transfer the campaign. The attachment is stored separately. The installed app can reopen offline after its first successful load.

## Contract Board

Set the current system, Force Scale, travel mix and travel cost method, then publish ten offers. The default board has six travel contracts and four on-world contracts. The board and campaign are saved on this device. Download the board as Markdown to share the offers, or load one into the Contract sheet. Generated destinations and jump counts are campaign estimates. The four summary cards at the top open the fields that feed those totals.

## Campaign months and formations

On the **Contract sheet** or **MSRB History**, advance one month to post upkeep of 500 SP per Force Scale and collect monthly pay while a signed contract is active. **Resolve contract** records the outcome, final payment, scrap proceeds, and reputation change, then ends monthly contract pay.

On the **Force sheet**, type in **Unit / variant** to search the library. Choose a result or press Enter to auto-link a unique exact name. Linking fills in the unit name and BV. **Link unit sheet** opens the full picker. Record a scrap value on each roster entry. Formation lists link to individual sheets, and **View formation sheets** opens all linked sheets with a print option.

## Private GitHub sync

Choose **Open** and connect to the private library and campaign repository using a fine-grained token scoped to that repository with **Contents: Read and write**. The same session powers company sync and unit lookup. Select a company from the GitHub picker, or choose **Open local backup** to restore an XML or JSON backup. **Save** gives each new company its own `companies/<company-folder>/company.xml` file. Autosync updates the open company while connected.

On the Contract sheet, adjust the offered steps before choosing Sign contract. Negotiation uses up to twice Scale in available Reputation and up to two exchanges of two concession steps for one upgrade step. Sign records a snapshot in MSRB History. Current campaign Reputation remains the basis for future negotiations.

## Mech and vehicle lookup

After connecting through **Open**, choose **Mech lookup** to search the repository’s extracted `.ssw` and `.saw` files or its `SSW-Master-master.zip` archive. You can also select a local ZIP. Search by name or model, select a result, and choose **Print / Save as PDF**.

## Development

The PWA source lives in `docs/`. Bump the cache version in `docs/sw.js` when changing the cached app shell.
