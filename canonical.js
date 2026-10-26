// RSNA's canonical graph: the reviewer's definition graph (the base) merged with the next-gen-schema
// additions (graph/*.jsonl), following the rules of RSNA's loader, docs/next-gen-schema/tools/foundation.py:
// additions never replace a base node or edge, and an "overlay" line only adds props to one base edge.
// Shared by the Browse views (browse.js) and the daily GitHub check.
(function (root) {
  "use strict";
  var REPO = "https://raw.githubusercontent.com/RSNA/ACR-RSNA-CDEs/next-gen-2026/docs/next-gen-schema/";
  var BASE = REPO + "alpha/graph/definition-graph.json";
  var ADDITIONS = REPO + "graph/";
  var LISTING = "https://api.github.com/repos/RSNA/ACR-RSNA-CDEs/contents/docs/next-gen-schema/graph?ref=next-gen-2026";
  // Used when GitHub's file listing can't be read
  var KNOWN_ADDITIONS = ["concepts.jsonl", "measurements.jsonl", "nodule.jsonl", "pleural-effusion.jsonl", "pyelonephritis.jsonl", "relationships.jsonl"];
  var CLASS_TYPES = { FindingClass: 1, Diagnosis: 1, Grouping: 1 };
  // Edges a class inherits from its ancestors, by bucket (foundation.py EFFECTIVE_EDGES)
  var EFFECTIVE_EDGES = {
    HAS_DATA_ELEMENT: "elements", HAS_MEASUREMENT: "measurements", SCOPED_TO: "scope",
    HAS_ANATOMIC_REFINEMENT_RULE: "refinement_rules", SEEN_ON: "modalities", IN_SUBSPECIALTY: "subspecialty",
    ASSESSED_BY: "assessment_schemes", HAS_COMPONENT: "has_components", COMPONENT_OF: "component_of",
    HAS_VALUE_CONSTRAINT: "value_constraints", MAY_MANIFEST_AS: "may_manifest_as", MAY_CAUSE: "may_cause",
    OCCURS_WITH: "occurs_with", MAY_PROGRESS_TO: "may_progress_to", HAS_ETIOLOGY: "etiology", INTERPRETED_FROM: "interpreted_from"
  };

  // base: the parsed definition-graph.json; additions: [{ name, text }] for each graph/*.jsonl file
  function merge(base, additions) {
    if (!base || !Array.isArray(base.nodes) || !Array.isArray(base.edges)) throw new Error("the definition graph's format changed");
    var g = { nodes: {}, edges: [], out: {}, inn: {}, relTypes: {}, problems: [] };
    function addNode(n, added) {
      if (!n || !n.id || g.nodes[n.id]) { if (n && n.id && added) g.problems.push(n.id + " is already in the base graph"); return; }
      n._added = !!added; g.nodes[n.id] = n;
    }
    function addEdge(e, added) {
      e._added = !!added; e.props = e.props || {};
      g.edges.push(e);
      (g.out[e.from] = g.out[e.from] || []).push(e);
      (g.inn[e.to] = g.inn[e.to] || []).push(e);
    }
    base.nodes.forEach(function (n) { addNode(n, false); });
    base.edges.forEach(function (e) { addEdge(e, false); });
    var baseEdges = {};
    base.edges.forEach(function (e) { baseEdges[e.edge + "|" + e.from + "|" + e.to] = e; });
    var overlays = [];
    (additions || []).slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (file) {
      String(file.text || "").split("\n").forEach(function (line, i) {
        if (!line.trim()) return;
        var item;
        try { item = JSON.parse(line); } catch (e) { g.problems.push(file.name + " line " + (i + 1) + " is not valid JSON"); return; }
        if (item.overlay === true) overlays.push(item);
        else if (item.node === "Edge") addEdge(item, true);
        else if (item.node === "RelationshipType") g.relTypes[item.id] = item;
        else addNode(item, true);
      });
    });
    overlays.forEach(function (o) {
      var e = baseEdges[o.edge + "|" + o.from + "|" + o.to];
      if (!e || !o.props) { g.problems.push("an overlay for " + o.edge + " " + o.from + " → " + o.to + " matches no base edge"); return; }
      Object.keys(o.props).forEach(function (k) { if (!(k in e.props)) { e.props[k] = o.props[k]; (e._addedProps = e._addedProps || {})[k] = true; } });
    });
    return g;
  }

  function out(g, id, type) { return (g.out[id] || []).filter(function (e) { return !type || e.edge === type; }); }
  function inn(g, id, type) { return (g.inn[id] || []).filter(function (e) { return !type || e.edge === type; }); }
  function isClass(g, id) { var n = g.nodes[id]; return !!(n && CLASS_TYPES[n.node]); }

  // A class and its ancestors over SUBTYPE_OF, most general first
  function lineage(g, id) {
    if (!isClass(g, id)) return [id];
    var depth = {};
    function d(x, seen) {
      if (depth[x] != null) return depth[x];
      if (seen[x]) return 0; // a cycle; stop rather than loop
      seen[x] = true;
      var parents = out(g, x, "SUBTYPE_OF").map(function (e) { return e.to; }).filter(function (p) { return isClass(g, p); });
      depth[x] = parents.length ? 1 + Math.max.apply(null, parents.map(function (p) { return d(p, seen); })) : 0;
      return depth[x];
    }
    var all = {}, stack = [id];
    while (stack.length) {
      var x = stack.pop(); if (all[x]) continue; all[x] = true;
      out(g, x, "SUBTYPE_OF").forEach(function (e) { if (isClass(g, e.to)) stack.push(e.to); });
    }
    return Object.keys(all).sort(function (a, b) { return d(a, {}) - d(b, {}) || (a < b ? -1 : 1); });
  }

  function valueOwner(g, valueId) { var o = inn(g, valueId, "HAS_VALUE")[0]; return o ? o.from : null; }

  // The class's own edges plus what it inherits; each item keeps inherited_from (null when its own)
  function effective(g, id) {
    if (!isClass(g, id)) return null;
    var buckets = {};
    Object.keys(EFFECTIVE_EDGES).forEach(function (k) { buckets[EFFECTIVE_EDGES[k]] = {}; });
    lineage(g, id).forEach(function (src) {
      out(g, src).forEach(function (e) {
        var b = EFFECTIVE_EDGES[e.edge]; if (!b) return;
        var key = e.edge === "HAS_VALUE_CONSTRAINT" ? (valueOwner(g, e.to) || e.props.element || e.to) : e.to;
        buckets[b][key] = { edge: e, inherited_from: src === id ? null : src };
      });
    });
    var res = {};
    Object.keys(buckets).forEach(function (b) { res[b] = Object.keys(buckets[b]).map(function (k) { return buckets[b][k]; }); });
    return res;
  }

  // A DataElement's values, in rank order
  function values(g, deId) {
    return out(g, deId, "HAS_VALUE").slice().sort(function (a, b) { return (a.props.rank || 0) - (b.props.rank || 0) || (a.to < b.to ? -1 : 1); })
      .map(function (e) { return g.nodes[e.to]; }).filter(Boolean);
  }

  function status(item) { return item ? (item.status || (item.props && item.props.status) || (item.version && item.version.status) || "") : ""; }

  var api = {
    BASE: BASE, ADDITIONS: ADDITIONS, LISTING: LISTING, KNOWN_ADDITIONS: KNOWN_ADDITIONS, CLASS_TYPES: CLASS_TYPES,
    merge: merge, out: out, inn: inn, isClass: isClass, lineage: lineage, effective: effective, values: values,
    valueOwner: valueOwner, status: status
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CDECanonical = api;
})(this);
