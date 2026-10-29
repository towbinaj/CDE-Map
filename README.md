# CDE Ontology Map viewer

An unofficial viewer for the draft ACR-RSNA next-gen CDE ontology: a 3D map you can spin, zoom and explore, plus card, tree and list views of each concept.

**Open it:** https://towbinaj.github.io/CDE-Map/

This is a draft work product, not an official ACR or RSNA release. The vocabulary is authored and maintained by the ACR-RSNA CDE team; this repository holds only the viewer.

## Where the data comes from

Each time it opens, the viewer reads the latest files from the [RSNA/ACR-RSNA-CDEs](https://github.com/RSNA/ACR-RSNA-CDEs/tree/next-gen-2026/docs/next-gen-schema) repository (`next-gen-2026` branch):

- **The 3D map:** [`ontology_map.html`](https://github.com/RSNA/ACR-RSNA-CDEs/blob/next-gen-2026/docs/next-gen-schema/alpha/visualizations/ontology_map.html). Only its map data is used; no code from the RSNA file runs in the viewer.
- **Relationship term definitions:** [`relationships.jsonl`](https://github.com/RSNA/ACR-RSNA-CDEs/blob/next-gen-2026/docs/next-gen-schema/graph/relationships.jsonl).
- **The canonical graph** behind the Card, Tree and List views: the reviewer's [definition graph](https://github.com/RSNA/ACR-RSNA-CDEs/blob/next-gen-2026/docs/next-gen-schema/alpha/graph/definition-graph.json) merged with the next-gen-schema [additions](https://github.com/RSNA/ACR-RSNA-CDEs/tree/next-gen-2026/docs/next-gen-schema/graph), following the project's own loader rules.

## Using it

- **On iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Offline:** it shows the last versions it downloaded.
- **Broken updates:** if a new version on GitHub can't be read, it shows the last version that worked and says so.
- **New versions of the app:** close the home-screen app fully and reopen it to pick them up.

## Features

- **Trace:** tap a concept to see everything that leads into it ("Comes from") and everything it leads to ("Goes to"), step by step. **Steps** limits how far it follows the arrows. **Focus view** switches to the source map's own view of the concept's relationships.
- **Tapping:** a tap picks the nearest concept, so you don't need to hit the dot exactly. Concepts outside the current selection stay visible in grey and can be tapped to branch off.
- **Definitions:** shows each concept's definition (from the map file) and, under **Terms used**, the definition of each relationship term. RadLex gives no definitions for its anatomy relationships.
- **Views:** the **Map · Card · Tree · List** switch moves between the 3D map and the canonical-graph views, keeping the selected concept: select it on the map and tap **Card**, or open a card and tap **Map**. Items from the additions are marked "proposed addition".
  - **Card:** one concept in the layout of the project's "mat" pictures: anatomic scope, definition, elements and their values, measurements, linked concepts by relationship, codes, and what it inherits from the concepts above it.
  - **Tree:** the concept in four labelled sections: **where it is** (its anatomy, then the RadLex places that anatomy is part of or contained in), **what it is a kind of** (parent and child terms), **what you record about it** (data elements with their values, and measurements), and **what can cause it** (for a diagnosis, also how it can show up and what it can cause).
  - **List:** every concept, searchable, filtered by type and status.
- Works on phones and desktop browsers.

## How it is kept working

- The 3D drawing library ([3d-force-graph](https://github.com/vasturiano/3d-force-graph) 1.80.1, MIT license) is stored in `lib/`, so the viewer does not depend on an outside website.
- A daily GitHub check (`.github/workflows/check-rsna-map.yml`) reads the project's files the same way the viewer does. If the viewer can no longer read the map, the list of relationship terms or the canonical graph, or if the focus rules this viewer copies have changed, the check opens a GitHub issue here. It also runs whenever the code that reads the data changes, and can be run by hand from the **Actions** tab.
- No passwords, keys or tokens are stored here. Everything the viewer reads is public.
