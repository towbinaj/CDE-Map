# CDE Ontology Map viewer

An unofficial 3D viewer for the draft ACR-RSNA next-gen CDE ontology map.

Each time it opens, it downloads the latest `ontology_map.html` from the
[RSNA/ACR-RSNA-CDEs](https://github.com/RSNA/ACR-RSNA-CDEs/tree/next-gen-2026/docs/next-gen-schema/alpha/visualizations)
repository (`next-gen-2026` branch) and shows it as a 3D map you can spin, zoom and explore. Only the map data is used; no code from the RSNA file runs in the viewer. The map itself is authored and maintained by the
ACR-RSNA CDE team; this repository holds only the viewer.

- If a new version on GitHub fails to load, the viewer shows the last version that worked and says so.
- If you are offline, it shows the last version it downloaded.
- On iPhone: open the page in Safari, tap Share, then **Add to Home Screen**.
- **Trace:** tap a concept, then **Trace** to see everything that leads into it ("Comes from") and everything it leads to ("Goes to"), step by step. **Steps** limits how far it follows the arrows.
- **Find path:** tap a concept, tap **Find path**, then tap or search a second concept to see the shortest chain of links between them.

## How it is kept working

- The 3D drawing library ([3d-force-graph](https://github.com/vasturiano/3d-force-graph) 1.80.1, MIT license) is stored in `lib/`, so the viewer does not depend on an outside website.
- A daily GitHub check (`.github/workflows/check-rsna-map.yml`) reads RSNA's latest map the same way the viewer does. If the viewer can no longer read it, or RSNA changed the focus rules this viewer copies, the check opens a GitHub issue here. It also runs whenever the code that reads the map changes, and can be run by hand from the **Actions** tab.

This is a draft work product, not an official ACR or RSNA release.
