# Mercenaries Play Assistant

## [Launch the Play Assistant](https://abnormalus.github.io/Battletech-Play-Assistant/)

Open the hosted app in your browser. Anyone can use it without downloading or hosting a copy. To install it as an app, use your browser’s **Install app** or **Add to Home Screen** option when available.

The three digital sheets are based on PDF pages 35–37 of the Mercenaries rulebook. The force roster totals Battle Value, and the contract ledger tracks support points and reputation. The employment tab records negotiated terms. Enter support, pay, and coverage values from your campaign; agreement text and edge-case rules remain available in the source PDF.

Attach your own rulebook on the Rulebook & backups tab to open its original sheets. Campaign data stays in the browser’s local storage and PDFs in IndexedDB. Export JSON to back up or transfer the campaign. The attachment is stored separately. The installed app can reopen offline after its first successful load.

## Contract Board

Set the current system, Force Scale, travel mix and travel cost method, then publish ten offers. The default board has six travel contracts and four on-world contracts. The board and campaign are saved on this device. Download the board as Markdown to share the offers, or load one into the Contract sheet. Generated destinations and jump counts are campaign estimates. The four summary cards at the top open the fields that feed those totals.

## Campaign months and formations

On the **Contract sheet** or **MSRB History**, advance one month to post upkeep of 500 SP per Force Scale and collect monthly pay while a signed contract is active. **Resolve contract** records the outcome, final payment, scrap proceeds, and reputation change, then ends monthly contract pay.

On the **Force sheet**, create formations and add units beneath them. The pilot roster tracks skills, availability, training, and advances. Assign pilots from the unit dropdown. Search for a unit by name, link a design, and click its name to open a printable record sheet. For Omni units, choose the configuration on the record sheet. The selected configuration updates roster BV. Scrap value uses the Mercenaries tonnage-based selling rate, applied to both BattleMechs and vehicles.

## Private GitHub sync

Choose **Connect GitHub** to link a private library and campaign repository using a fine-grained token scoped to that repository with **Contents: Read and write**. The browser remembers that key until you disconnect. Only save a key on a browser profile you trust. **Open** lists companies or restores a local XML or JSON backup. **Save** defaults new saves to the company name and date. Use the **Save** dropdown for **Save as…**.

Company XML includes the pilot roster, vehicle roster, financial ledger, and company finances. Current SP is calculated from the starting balance and recorded transactions.

## Mech and vehicle lookup

Use **Mech lookup** to search extracted `.ssw` and `.saw` files or a repository `SSW-Master-master.zip`. The local ZIP option is available in Mech lookup while GitHub is disconnected. When no design matches, choose **Add this design** to upload an `.ssw` or `.saw` file.

## Development

The PWA source lives in `docs/`. Bump the cache version in `docs/sw.js` when changing the cached app shell.

## Classic printable PDF

Open a linked unit to view its filled Classic PDF. With GitHub connected, the first player to attach the supported E-CAT35001RS blank PDF shares it with everyone in the private repository. Other players load that template automatically. The app fills the matching biped, quad, ground, VTOL, or naval page. Formation sheets are combined into one printable PDF.
