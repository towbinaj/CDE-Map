// Daily check of RSNA's ontology_map.html, run by .github/workflows/check-rsna-map.yml.
// Reads the file exactly the way the viewer does (map-data.js) and reports one of:
//   ok        - the viewer can read the latest map and RSNA's focus rules are unchanged
//   attention - the viewer still works, but something it relies on changed (an issue is opened)
//   broken    - the viewer cannot read the latest map and is showing its last saved copy
// Writes the result to $GITHUB_OUTPUT and the details to report.md.
"use strict";
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var mapData = require("../../map-data.js");

var SOURCE = "https://raw.githubusercontent.com/RSNA/ACR-RSNA-CDEs/next-gen-2026/docs/next-gen-schema/alpha/visualizations/ontology_map.html";
var RULES_BASELINE = path.join(__dirname, "..", "rsna-rules.sha256");
// Concept types and links that the copied focus rules depend on
var NEEDED_TYPES = ["DataElement", "Value", "FindingClass", "Diagnosis"];
var NEEDED_LINKS = ["HAS_VALUE", "HAS_DATA_ELEMENT"];

function finish(status, title, lines) {
  var report = ["## " + title, ""].concat(lines).join("\n") + "\n";
  fs.writeFileSync("report.md", report);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "status=" + status + "\ntitle=" + title + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  console.log(status + ": " + title + "\n" + report);
}

function main(html) {
  var data;
  try { data = mapData.extractData(html); } catch (e) {
    return finish("broken", "The viewer can no longer read RSNA's map", [
      "The newest `ontology_map.html` on RSNA's `next-gen-2026` branch could not be read: " + e.message + ".",
      "",
      "Until this is fixed, the viewer shows the last copy it read successfully, with a warning at the top.",
      "",
      "Source: " + SOURCE
    ]);
  }

  var problems = [];
  var types = {}, links = {};
  data.nodes.forEach(function (n) { types[n.type] = (types[n.type] || 0) + 1; });
  data.edges.forEach(function (e) { var k = String(e.nativePredicate || e.label || "").trim().toUpperCase(); links[k] = (links[k] || 0) + 1; });
  NEEDED_TYPES.forEach(function (t) { if (!types[t]) problems.push("- No concepts of type **" + t + "** any more. The focus rules for this type will no longer apply."); });
  NEEDED_LINKS.forEach(function (l) { if (!links[l]) problems.push("- No **" + l + "** links any more. The focus rules that follow this link will no longer apply."); });
  var dropped = data.rawEdgeCount - data.edges.length;
  if (dropped > 0) problems.push("- " + dropped + " links point to concepts that are missing from the map, so the viewer skips them.");

  var rules = mapData.rulesScript(html);
  var rulesHash = rules ? crypto.createHash("sha256").update(rules).digest("hex") : "";
  var expected = fs.readFileSync(RULES_BASELINE, "utf8").trim();
  if (!rules) {
    problems.push("- RSNA's page no longer contains its `semanticNeighborhood` focus rules. The viewer keeps using its own copy, which may no longer match RSNA's intent.");
  } else if (rulesHash !== expected) {
    problems.push("- RSNA changed the code of their map page, which contains the focus rules the viewer copies. The viewer keeps working with its copy from 26 Oct 2026, but RSNA's rules may now differ.");
    problems.push("  To review: ask Claude to compare RSNA's `semanticNeighborhood` code with the copy in `index.html`, update it if needed, and set `.github/rsna-rules.sha256` to `" + rulesHash + "`.");
  }

  var counts = "Latest map: " + data.nodes.length + " concepts, " + data.edges.length + " links.";
  if (problems.length) {
    return finish("attention", "RSNA's map changed in a way the viewer may need to follow (" + rulesHash.slice(0, 8) + ")", [
      "The viewer can still read the map. " + counts, "", "What changed:", ""
    ].concat(problems).concat(["", "Source: " + SOURCE]));
  }
  finish("ok", "RSNA's map reads correctly", [counts, "", "Focus rules unchanged."]);
}

if (process.argv[2]) {
  main(fs.readFileSync(process.argv[2], "utf8"));
} else {
  // Three tries, a minute apart, so a brief GitHub hiccup is not reported as a problem
  var download = function (triesLeft) {
    return fetch(SOURCE, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("GitHub returned " + r.status + " for the map file (it may have been moved, renamed or deleted)");
      return r.text();
    }).catch(function (e) {
      if (triesLeft <= 1) throw e;
      return new Promise(function (wait) { setTimeout(wait, 60000); }).then(function () { return download(triesLeft - 1); });
    });
  };
  download(3).then(main, function (e) {
    finish("broken", "The viewer can no longer download RSNA's map", [
      e.message + ".",
      "",
      "Until this is fixed, the viewer shows the last copy it read successfully, with a warning at the top.",
      "",
      "Source: " + SOURCE
    ]);
  });
}
