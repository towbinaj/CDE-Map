// Reads the concepts and links out of RSNA's ontology_map.html.
// Shared by the viewer (index.html) and the daily GitHub check (.github/scripts/check-rsna-map.js),
// so both always read the file the same way. No RSNA code is run: only the two JSON lists are parsed.
(function (root) {
  "use strict";
  function extractData(html) {
    var mn = /nodes = new vis\.DataSet\((\[[\s\S]*?\])\);/.exec(html);
    var me = /edges = new vis\.DataSet\((\[[\s\S]*?\])\);/.exec(html);
    if (!mn || !me) throw new Error("the map's data format changed");
    var rawNodes = JSON.parse(mn[1]), rawEdges = JSON.parse(me[1]);
    if (!rawNodes.length) throw new Error("the map has no concepts");
    var nodes = rawNodes.map(function (n) {
      var color = typeof n.color === "string" ? n.color : (n.color && (n.color.background || n.color.border)) || "#7F8C8D";
      return {
        id: String(n.id), label: String(n.label || n.id), type: String(n.ontologyType || "generic").trim(),
        color: color, size: Number(n.size) || 15, shortId: n.shortId || "", isPattern: n.isPatternNode === true
      };
    });
    var ids = {}; nodes.forEach(function (n) { ids[n.id] = true; });
    var edges = [];
    rawEdges.forEach(function (e, i) {
      var from = String(e.from), to = String(e.to);
      if (!ids[from] || !ids[to]) return;
      var color = typeof e.color === "string" ? e.color : (e.color && e.color.color) || "#8a93a3";
      edges.push({
        id: "e" + i, source: from, target: to, from: from, to: to, color: color,
        nativePredicate: e.nativePredicate || "", label: e.label || "", title: e.title || "",
        inversePredicate: e.inversePredicate || "", semanticCategory: e.semanticCategory || "",
        narrowValues: Array.isArray(e.narrowValues) ? e.narrowValues.map(String) : [],
        isPattern: e.isPatternEdge === true
      });
    });
    return { nodes: nodes, edges: edges, rawEdgeCount: rawEdges.length };
  }

  // The part of RSNA's page that holds their focus rules (the script with semanticNeighborhood).
  // The viewer carries a copy of those rules, so the daily check watches this part for changes.
  function rulesScript(html) {
    var blocks = html.split(/<script\b[^>]*>/i).slice(1).map(function (b) { return b.split(/<\/script>/i)[0]; });
    var rules = blocks.filter(function (b) { return b.indexOf("function semanticNeighborhood") !== -1; })[0];
    return rules == null ? null : rules.replace(/\r/g, "").trim();
  }

  var api = { extractData: extractData, rulesScript: rulesScript };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CDEMapData = api;
})(this);
