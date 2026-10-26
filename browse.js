// Browse, Mat and Tree views of RSNA's canonical graph (merged by canonical.js).
// Modelled on RSNA's own displays: the "Browse repository" demo, and the mat and tree pictures drawn by
// docs/next-gen-schema/tools/render_cards.py (one concept with its links in labelled containers; an is-a outline).
(function () {
  "use strict";
  var C = window.CDECanonical;
  var CACHE = "cde-map-v2", GOOD_KEY = "/last-good-canonical.json";
  // RSNA's accent colors and kind labels (render_cards.py ACCENT and KIND)
  var ACCENT = { FindingClass: "#3b82f6", Diagnosis: "#8b5cf6", Grouping: "#94a3b8", DataElement: "#22c55e", Value: "#84cc16",
    Measurement: "#14b8a6", AnatomicLocation: "#f59e0b", AnatomicRefinementRule: "#f59e0b", AssessmentScheme: "#f43f5e" };
  var KIND = { FindingClass: "FINDING", Diagnosis: "DIAGNOSIS", Grouping: "GROUPING", DataElement: "ELEMENT", Value: "VALUE",
    Measurement: "MEASUREMENT", AnatomicLocation: "ANATOMY", AnatomicRefinementRule: "REFINEMENT RULE", AssessmentScheme: "ASSESSMENT",
    Etiology: "ETIOLOGY", Modality: "MODALITY", Subspecialty: "SUBSPECIALTY", Concept: "CONCEPT" };
  // (label, edge, direction) in RSNA's order: "out" lists targets of the concept's edges, "in" the sources pointing at it
  var CONTAINERS = [["A kind of", "SUBTYPE_OF", "out"], ["Kinds of", "SUBTYPE_OF", "in"],
    ["Has component", "HAS_COMPONENT", "out"], ["Component of", "COMPONENT_OF", "out"],
    ["Manifests as", "MAY_MANIFEST_AS", "out"], ["May represent", "MAY_MANIFEST_AS", "in"],
    ["May be caused by", "MAY_CAUSE", "in"], ["May cause", "MAY_CAUSE", "out"],
    ["Progresses to", "MAY_PROGRESS_TO", "out"], ["Progresses from", "MAY_PROGRESS_TO", "in"],
    ["Occurs with", "OCCURS_WITH", "both"], ["Assessed by", "ASSESSED_BY", "out"], ["Assesses", "ASSESSED_BY", "in"]];
  var TYPE_FILTERS = [["All", null], ["Finding", ["FindingClass"]], ["Diagnosis", ["Diagnosis"]], ["Grouping", ["Grouping"]],
    ["Data element", ["DataElement"]], ["Value", ["Value"]], ["Measurement", ["Measurement"]], ["Anatomy", ["AnatomicLocation"]],
    ["Other", ["AssessmentScheme", "Etiology", "Modality", "Subspecialty", "Concept", "AnatomicRefinementRule"]]];
  var STATUS_FILTERS = [["Any status", null], ["Published", "published"], ["Proposed", "proposed"], ["Draft", "draft"], ["Additions", "added"]];
  // Labels for what points at a scheme, modality, subspecialty, etiology or concept
  var LINKED_BY = { ASSESSED_BY: "Assesses", SEEN_ON: "Seen on this modality", IN_SUBSPECIALTY: "In this subspecialty",
    HAS_ETIOLOGY: "Diagnoses with this etiology", SEX: "Applies to", AGE_APPLICABILITY: "Applies to", TIME_COURSE: "Applies to",
    HAS_ANATOMIC_REFINEMENT_RULE: "Used by" };
  var CODE_SYSTEMS ={ RADLEX: "RadLex", SNOMEDCT: "SNOMED CT", LOINC: "LOINC" };
  var MATCH_WORDS = { closeMatch: " (close)", narrowMatch: " (narrower)", broadMatch: " (broader)", relatedMatch: " (related)" };

  var g = null, loading = null, hooks = {}, stack = [], state = null;
  var filters = { q: "", type: 0, status: 0 };
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function words(v) { return String(v).replace(/_/g, " "); }
  function node(id) { return g.nodes[id]; }
  // Anatomy the canonical graph only points at is named from the 3D map's data
  function nameOf(id) { var n = node(id); if (n) return n.name; var m = hooks.mapNode && hooks.mapNode(id); return m ? m.label : id; }
  function typeOf(id) { var n = node(id); if (n) return n.node; var m = hooks.mapNode && hooks.mapNode(id); return m ? m.type : "Concept"; }
  function accent(type) { return ACCENT[type] || "#94a3b8"; }
  function statusOf(n) { return n._added ? "added" : C.status(n); }

  // ---------- loading ----------
  function openCache() { return ("caches" in window) ? caches.open(CACHE).catch(function () { return null; }) : Promise.resolve(null); }
  function fetchText(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("GitHub returned " + r.status); return r.text(); }); }
  function listAdditions() {
    return fetch(C.LISTING, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
      var names = Array.isArray(list) ? list.map(function (f) { return f.name; }).filter(function (n) { return /\.jsonl$/.test(n); }) : [];
      return names.length ? names : C.KNOWN_ADDITIONS;
    }).catch(function () { return C.KNOWN_ADDITIONS; });
  }
  function load() {
    if (g) return Promise.resolve(g);
    if (loading) return loading;
    loading = openCache().then(function (cache) {
      return listAdditions().then(function (names) {
        return Promise.all([fetchText(C.BASE)].concat(names.map(function (n) { return fetchText(C.ADDITIONS + n); }))).then(function (texts) {
          var raw = { base: JSON.parse(texts[0]), additions: names.map(function (n, i) { return { name: n, text: texts[i + 1] }; }) };
          var merged = C.merge(raw.base, raw.additions);
          if (cache) cache.put(GOOD_KEY, new Response(JSON.stringify(raw), { headers: { "content-type": "application/json" } })).catch(function () {});
          return merged;
        });
      }).catch(function (err) {
        // Offline or unreadable: use the last copy that worked
        return (cache ? cache.match(GOOD_KEY).then(function (r) { return r ? r.json() : null; }) : Promise.resolve(null)).then(function (raw) {
          if (!raw) throw err;
          var merged = C.merge(raw.base, raw.additions); merged.fromCache = true; return merged;
        });
      });
    }).then(function (merged) { g = merged; return g; }, function (err) { loading = null; throw err; });
    return loading;
  }

  // ---------- screen and navigation ----------
  function show(next, push) {
    if (push && state) stack.push(state);
    state = next;
    $("browse").hidden = false;
    $("bBack").textContent = stack.length ? "‹ Back" : "‹ Map";
    var body = $("bBody"); body.innerHTML = "";
    if (!g) {
      body.appendChild(el("div", "bNote", "Loading RSNA's canonical graph…"));
      load().then(function () { if (state === next) show(next, false); }, function (e) {
        body.innerHTML = ""; body.appendChild(el("div", "bNote", "The canonical graph could not be loaded (" + e.message + "). Check your connection and try again."));
      });
      return;
    }
    if (state.view === "list") renderList(body);
    else if (state.view === "tree") renderTree(body, state.id);
    else renderMat(body, state.id);
    if (state.view !== "list") body.scrollTop = 0;
  }
  function open(id) { show(id ? { view: "mat", id: id } : { view: "list" }, false); stack = []; $("bBack").textContent = "‹ Map"; }
  function close() { $("browse").hidden = true; stack = []; state = null; if (hooks.onClose) hooks.onClose(); }
  function go(view, id) { show({ view: view, id: id }, true); }

  // ---------- browse list ----------
  function renderList(body) {
    $("bTitle").textContent = "Browse";
    var controls = el("div", "bControls");
    var q = el("input", "bSearch"); q.type = "search"; q.placeholder = "Narrow this list"; q.value = filters.q; q.setAttribute("aria-label", "Narrow this list");
    controls.appendChild(q);
    controls.appendChild(chips(TYPE_FILTERS, "type"));
    controls.appendChild(chips(STATUS_FILTERS, "status"));
    var count = el("div", "bCount");
    controls.appendChild(count);
    body.appendChild(controls);
    var list = el("div", "bList"); body.appendChild(list);
    if (g.fromCache) body.insertBefore(el("div", "bNote warn", "GitHub could not be reached; showing the last copy read."), controls);
    function fill() {
      var term = filters.q.trim().toLowerCase(), types = TYPE_FILTERS[filters.type][1], st = STATUS_FILTERS[filters.status][1];
      var rows = Object.keys(g.nodes).map(node).filter(function (n) {
        if (types && types.indexOf(n.node) === -1) return false;
        if (st && statusOf(n) !== st) return false;
        if (!term) return true;
        return (n.name + " " + n.id + " " + (n.definition || "") + " " + (n.synonyms || []).map(function (s) { return s.term; }).join(" ")).toLowerCase().indexOf(term) !== -1;
      }).sort(function (a, b) { return a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1); });
      count.textContent = rows.length + (rows.length === 1 ? " concept" : " concepts");
      list.innerHTML = "";
      rows.forEach(function (n) { list.appendChild(listRow(n)); });
    }
    q.addEventListener("input", function () { filters.q = q.value; fill(); });
    controls.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-group]"); if (!b) return;
      filters[b.dataset.group] = Number(b.dataset.i);
      Array.prototype.forEach.call(controls.querySelectorAll('button[data-group="' + b.dataset.group + '"]'), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      fill();
    });
    fill();
  }
  function chips(options, group) {
    var row = el("div", "bChips");
    options.forEach(function (o, i) {
      var b = el("button", "bChip", o[0]); b.type = "button"; b.dataset.group = group; b.dataset.i = i;
      b.setAttribute("aria-pressed", filters[group] === i ? "true" : "false");
      row.appendChild(b);
    });
    return row;
  }
  function listRow(n) {
    var b = el("button", "bRow"); b.type = "button"; b.style.borderLeftColor = accent(n.node);
    var top = el("div", "bRowTop");
    top.appendChild(el("span", "bKind", KIND[n.node] || n.node.toUpperCase())).style.color = accent(n.node);
    top.appendChild(el("span", "bName", n.name));
    var scope = C.out(g, n.id, "SCOPED_TO")[0];
    if (scope) top.appendChild(el("span", "bTag", nameOf(scope.to)));
    b.appendChild(top);
    if (n.definition) b.appendChild(el("div", "bDef", n.definition));
    var meta = el("div", "bMeta", n.id + (n.version && n.version.number ? " · v" + n.version.number : ""));
    var st = statusOf(n);
    if (st) meta.appendChild(badge(st));
    b.appendChild(meta);
    b.addEventListener("click", function () { go("mat", n.id); });
    return b;
  }
  function badge(st) {
    var b = el("span", "bBadge " + st, st === "added" ? "proposed addition" : words(st));
    if (st === "added") b.title = "From the next-gen-schema additions, not yet in the reviewer's base graph";
    return b;
  }

  // ---------- mat: one concept and its links ----------
  function renderMat(body, id) {
    var n = node(id);
    $("bTitle").textContent = "Card";
    if (!n) {
      var miss = el("div", "bNote");
      miss.textContent = nameOf(id) + " is not in RSNA's canonical graph. The 3D map adds RadLex anatomy around the concepts the graph references, for context.";
      body.appendChild(miss);
      return;
    }
    var eff = C.effective(g, id);
    var card = el("article", "mat"); card.style.borderTopColor = accent(n.node);
    var head = el("div", "matHead");
    head.appendChild(el("h2", "matName", n.name));
    var kind = el("div", "matKind", (KIND[n.node] || n.node) + " · " + id);
    var st = statusOf(n); if (st) kind.appendChild(badge(st));
    head.appendChild(kind);
    card.appendChild(head);

    var actions = el("div", "matActions");
    if (hasTree(id)) actions.appendChild(action("Tree", function () { go("tree", id); }));
    if (hooks.mapNode && hooks.mapNode(id)) actions.appendChild(action("Show on map", function () { var x = id; close(); hooks.showOnMap(x); }));
    if (actions.children.length) card.appendChild(actions);

    // Anatomic scope, own and inherited
    var scope = eff ? eff.scope : C.out(g, id, "SCOPED_TO").map(function (e) { return { edge: e, inherited_from: null }; });
    if (scope.length) {
      var sc = el("div", "matScope");
      scope.forEach(function (s) {
        var p = s.edge.props, bits = [p.strength, p.kind].filter(Boolean).map(words);
        var line = el("div", null, "⌂ " + nameOf(s.edge.to) + " (" + s.edge.to + ")" + (bits.length ? " · " + bits.join(" · ") : ""));
        if (s.inherited_from) line.appendChild(el("span", "from", " from " + nameOf(s.inherited_from)));
        sc.appendChild(line);
      });
      card.appendChild(sc);
    }
    if (n.definition) card.appendChild(el("p", "matDef", n.definition));
    if (n.synonyms && n.synonyms.length) card.appendChild(el("div", "matSyn", "synonyms: " + n.synonyms.map(function (s) { return s.term; }).join(" · ")));
    if (n.note) card.appendChild(el("div", "matSyn", "note: " + n.note));

    if (eff) {
      var cons = eff.value_constraints;
      if (cons.length) {
        var cb = el("div", "matBadges");
        cons.forEach(function (c) {
          var owner = C.valueOwner(g, c.edge.to);
          var t = (owner ? nameOf(owner) : words(c.edge.props.element || "")) + " = " + nameOf(c.edge.to) + (c.edge.props.defining ? " (defining)" : " (fixed)");
          var bd = el("span", "matBadge", t); if (c.inherited_from) bd.title = "from " + nameOf(c.inherited_from);
          cb.appendChild(bd);
        });
        card.appendChild(cb);
      }
      if (eff.elements.length) card.appendChild(elementsSection(eff));
      if (eff.measurements.length) card.appendChild(measurementsSection(eff.measurements));
      containerRows(id).forEach(function (r) { card.appendChild(container(r[0], r[1])); });
    } else {
      hubRows(n).forEach(function (r) { card.appendChild(container(r[0], r[1])); });
    }
    if (n.node === "AssessmentScheme" && Array.isArray(n.categories)) card.appendChild(categoriesSection(n));
    if (n.node === "Measurement") {
      var mq = [n.quantity_kind, (n.permitted_units || []).join(", ")].filter(Boolean).join(" · ");
      if (mq || n.method) card.insertBefore(el("div", "matSyn", [mq, n.method].filter(Boolean).join(" · ")), card.querySelector(".matCont"));
    }
    var codes = (n.bindings || []).map(function (b) {
      return (CODE_SYSTEMS[b.system] || b.system) + " " + b.code + (b.source_label ? " “" + b.source_label + "”" : "") + (MATCH_WORDS[b.match] || "");
    });
    if (codes.length) card.appendChild(el("div", "matCodes", codes.join(" · ")));
    if (eff) card.appendChild(contextStrip(id, eff));
    body.appendChild(card);
  }
  function action(label, fn) { var b = el("button", "btn", label); b.type = "button"; b.addEventListener("click", fn); return b; }

  function elementsSection(eff) {
    var sec = el("section", "matSec"); sec.appendChild(el("h3", null, "Elements"));
    eff.elements.forEach(function (it) {
      var de = node(it.edge.to); if (!de) return;
      var row = el("div", "matItem");
      var t = el("button", "matLink", de.name); t.type = "button"; t.addEventListener("click", function () { go("mat", de.id); });
      row.appendChild(t);
      row.appendChild(el("span", "matId", " " + de.id + (de.select_cardinality ? " · " + de.select_cardinality + "-select" : "")));
      if (it.inherited_from) row.appendChild(el("span", "from", " from " + nameOf(it.inherited_from)));
      var narrow = it.edge.props.narrow, vals = C.values(g, de.id);
      if (Array.isArray(narrow) && narrow.length) vals = vals.filter(function (v) { return narrow.indexOf(v.id) !== -1; });
      var fixed = eff.value_constraints.filter(function (c) { return C.valueOwner(g, c.edge.to) === de.id; })[0];
      var vtxt = fixed ? "= " + nameOf(fixed.edge.to) + (fixed.edge.props.defining ? " (defining)" : " (fixed)") : vals.map(function (v) { return v.name; }).join(" · ");
      if (vtxt) row.appendChild(el("div", "matVals", vtxt + (!fixed && Array.isArray(narrow) && narrow.length ? "  (narrowed)" : "")));
      var mods = it.edge.props.modality; if (Array.isArray(mods) && mods.length) row.appendChild(el("div", "matVals", "on " + mods.join(", ")));
      sec.appendChild(row);
    });
    return sec;
  }
  function measurementsSection(items) {
    var sec = el("section", "matSec"); sec.appendChild(el("h3", null, "Measurements"));
    items.forEach(function (it) {
      var ms = node(it.edge.to); if (!ms) return;
      var row = el("div", "matItem");
      var t = el("button", "matLink", ms.name); t.type = "button"; t.addEventListener("click", function () { go("mat", ms.id); });
      row.appendChild(t);
      row.appendChild(el("span", "matId", " " + ms.id + (ms.quantity_kind ? " · " + ms.quantity_kind : "")));
      if (it.inherited_from) row.appendChild(el("span", "from", " from " + nameOf(it.inherited_from)));
      var detail = [(ms.permitted_units || []).join(", "), ms.method].filter(Boolean).join(" · ");
      if (detail) row.appendChild(el("div", "matVals", detail));
      sec.appendChild(row);
    });
    return sec;
  }
  function categoriesSection(n) {
    var sec = el("section", "matSec");
    sec.appendChild(el("h3", null, "Categories" + (n.issuing_authority ? " · " + n.issuing_authority : "") + (n.scheme_version ? " " + n.scheme_version : "")));
    n.categories.slice().sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); }).forEach(function (c) {
      sec.appendChild(el("div", "matItem", (c.rank != null ? c.rank + ". " : "") + c.name));
    });
    return sec;
  }

  // Direct links of a class, in RSNA's container order
  function containerRows(id) {
    var rows = [];
    CONTAINERS.forEach(function (c) {
      var items = {};
      if (c[2] !== "in") C.out(g, id, c[1]).forEach(function (e) { items[e.to] = e; });
      if (c[2] !== "out") C.inn(g, id, c[1]).forEach(function (e) { items[e.from] = e; });
      var list = Object.keys(items).map(function (k) { return [k, items[k]]; });
      if (list.length) rows.push([c[0], list]);
    });
    return rows;
  }
  // Containers for elements, values, measurements, anatomy and the other kinds of concept
  function hubRows(n) {
    var rows = [], id = n.id;
    function add(label, list) { if (list.length) rows.push([label, list]); }
    function from(type) { return C.inn(g, id, type).map(function (e) { return [e.from, e]; }); }
    function to(type) { return C.out(g, id, type).map(function (e) { return [e.to, e]; }); }
    if (n.node === "DataElement") {
      add("Values", to("HAS_VALUE"));
      add("Bound by", from("HAS_DATA_ELEMENT"));
      var fixed = []; C.out(g, id, "HAS_VALUE").forEach(function (v) { C.inn(g, v.to, "HAS_VALUE_CONSTRAINT").forEach(function (e) { fixed.push([e.from, e]); }); });
      add("Fixed by", fixed);
      add("Scoped to", to("SCOPED_TO")); add("Seen on", to("SEEN_ON"));
    } else if (n.node === "Value") {
      add("Value of", from("HAS_VALUE")); add("Fixed by", from("HAS_VALUE_CONSTRAINT"));
    } else if (n.node === "Measurement") {
      var parents = C.out(g, id, "SUBTYPE_OF");
      add("A kind of", to("SUBTYPE_OF")); add("Kinds of", from("SUBTYPE_OF"));
      var sib = []; parents.forEach(function (p) { C.inn(g, p.to, "SUBTYPE_OF").forEach(function (e) { if (e.from !== id) sib.push([e.from, e]); }); });
      add("Siblings", sib);
      add("Bound by", from("HAS_MEASUREMENT")); add("Interpreted by", from("INTERPRETED_FROM"));
      add("Has measurement component", to("HAS_MEASUREMENT_COMPONENT")); add("Derived from", to("DERIVED_FROM_MEASUREMENT"));
      add("Scoped to", to("SCOPED_TO"));
    } else if (n.node === "AnatomicLocation") {
      var scoped = from("SCOPED_TO");
      [["Findings scoped here", "FindingClass"], ["Diagnoses scoped here", "Diagnosis"], ["Groupings scoped here", "Grouping"],
        ["Elements scoped here", "DataElement"], ["Measurements scoped here", "Measurement"]].forEach(function (k) {
        add(k[0], scoped.filter(function (x) { return typeOf(x[0]) === k[1]; }));
      });
      add("Refinement rules", from("REFINES_SCOPE").concat(from("TARGET_TAXONOMY_ROOT")));
    } else {
      var byEdge = {};
      C.inn(g, id).forEach(function (e) { (byEdge[e.edge] = byEdge[e.edge] || []).push([e.from, e]); });
      Object.keys(byEdge).sort().forEach(function (k) { add(LINKED_BY[k] || "Linked by “" + words(k).toLowerCase() + "”", byEdge[k]); });
      add("Scoped to", to("SCOPED_TO"));
    }
    return rows;
  }
  function container(label, items) {
    var box = el("section", "matCont"); box.appendChild(el("h3", null, label + " (" + items.length + ")"));
    var grid = el("div", "matGrid");
    items.sort(function (a, b) { return nameOf(a[0]).localeCompare(nameOf(b[0])); }).forEach(function (it) { grid.appendChild(mini(it[0], it[1])); });
    box.appendChild(grid);
    return box;
  }
  function mini(id, edge) {
    var type = typeOf(id), b = el("button", "mini"); b.type = "button"; b.style.borderLeftColor = accent(type);
    b.appendChild(el("span", "miniName", nameOf(id)));
    b.appendChild(el("span", "miniKind", (KIND[type] || type.toUpperCase()) + " · " + id));
    var p = edge && edge.props || {}, bits = ["typicality", "specificity", "frequency", "min_count", "strength", "kind"].filter(function (k) { return p[k] != null; })
      .map(function (k) { return k === "min_count" ? "at least " + p[k] : words(p[k]); });
    if (edge && (edge._added || C.status(edge) === "proposed-to-reviewer")) bits.push("proposed addition");
    if (bits.length) b.appendChild(el("span", "miniProps", bits.join(" · ")));
    b.addEventListener("click", function () { go("mat", id); });
    return b;
  }
  // The bottom strip of a class card: where and how it applies
  function contextStrip(id, eff) {
    var strip = el("div", "matContext");
    function cell(label, items) {
      var c = el("div", "ctx"); c.appendChild(el("b", null, label));
      c.appendChild(el("span", null, items.length ? items.join(" · ") : "—"));
      strip.appendChild(c);
    }
    function named(list) {
      return list.map(function (x) {
        var n = node(x.edge.to), t = n ? (n.node === "Subspecialty" && n.definition ? n.definition : n.name) : x.edge.to;
        return t + (x.inherited_from ? " (from " + nameOf(x.inherited_from) + ")" : "");
      });
    }
    function direct(type) {
      var line = C.lineage(g, id).slice().reverse();
      for (var i = 0; i < line.length; i++) {
        var es = C.out(g, line[i], type);
        if (es.length) return es.map(function (e) { return nameOf(e.to) + (line[i] !== id ? " (from " + nameOf(line[i]) + ")" : ""); });
      }
      return [];
    }
    cell("Modality", named(eff.modalities));
    cell("Subspecialty", named(eff.subspecialty));
    cell("Sex", direct("SEX")); cell("Age", direct("AGE_APPLICABILITY")); cell("Course", direct("TIME_COURSE"));
    cell("Etiology", named(eff.etiology));
    return strip;
  }

  // ---------- tree: the is-a outline ----------
  function parentsOf(id) { return C.out(g, id, "SUBTYPE_OF").map(function (e) { return e.to; }).filter(function (p) { return node(p); }); }
  function childrenOf(id) { return C.inn(g, id, "SUBTYPE_OF").map(function (e) { return e.from; }).filter(function (c) { return node(c); }); }
  function hasTree(id) { return parentsOf(id).length > 0 || childrenOf(id).length > 0; }
  function rootsOf(id) {
    var roots = {}, seen = {}, stackIds = [id];
    while (stackIds.length) {
      var x = stackIds.pop(); if (seen[x]) continue; seen[x] = true;
      var ps = parentsOf(x);
      if (!ps.length) roots[x] = true; else ps.forEach(function (p) { stackIds.push(p); });
    }
    return Object.keys(roots).sort(function (a, b) { return nameOf(a).localeCompare(nameOf(b)); });
  }
  function renderTree(body, id) {
    $("bTitle").textContent = "Tree";
    body.appendChild(el("div", "bNote", "“Is a kind of” outline around " + nameOf(id) + ". Tap a concept to open its card."));
    rootsOf(id).forEach(function (r) {
      var box = el("div", "tree"); var count = { n: 0 };
      outline(box, r, 0, {}, id, count);
      box.insertBefore(el("div", "treeHead", nameOf(r) + " · is-a outline · " + count.n + (count.n === 1 ? " concept" : " concepts")), box.firstChild);
      body.appendChild(box);
    });
  }
  function outline(box, id, depth, seen, current, count) {
    if (seen[id]) return; seen[id] = true; count.n++;
    var row = mini(id, null); row.classList.add("treeRow"); row.style.marginLeft = Math.min(depth, 6) * 16 + "px";
    if (id === current) row.classList.add("current");
    box.appendChild(row);
    childrenOf(id).sort(function (a, b) { return nameOf(a).localeCompare(nameOf(b)); }).forEach(function (c) { outline(box, c, depth + 1, seen, current, count); });
  }

  // ---------- wiring ----------
  function init(h) {
    hooks = h || {};
    $("bBack").addEventListener("click", function () {
      if (!stack.length) return close();
      state = null; show(stack.pop(), false);
      $("bBack").textContent = stack.length ? "‹ Back" : "‹ Map";
    });
    $("bListBtn").addEventListener("click", function () { go("list"); });
  }
  window.CDEBrowse = { init: init, open: open, close: close, load: load };
})();
