/* QuizletLocal bookmarklet — readable source.
   Minified version lives in public/index.html / app.js as the draggable link.
   Runs on a quizlet.com set page (already past Cloudflare in the real
   browser), extracts ALL cards, and POSTs them to the local server.

   Term data is found in this order of reliability:
     1. Quizlet's internal studiable-item API (paginated) — complete.
     2. The embedded Redux state in __NEXT_DATA__ — up to ~100 items.
     3. JSON-LD Quiz markup — first ~10 items only (last resort). */
(function () {
  var ENDPOINT = "http://localhost:4321/api/cards";

  function sideText(side) {
    if (!side) return "";
    var media = side.media || [];
    var m = null;
    for (var i = 0; i < media.length; i++) {
      if (media[i] && (media[i].plainText || media[i].text)) { m = media[i]; break; }
    }
    if (!m) m = media[0];
    return m ? (m.plainText || m.text || "") : "";
  }

  function pairFromCardSides(sides) {
    sides = sides || [];
    var w = null, d = null;
    for (var i = 0; i < sides.length; i++) {
      if (sides[i].label === "word") w = sides[i];
      if (sides[i].label === "definition") d = sides[i];
    }
    if (!w) w = sides[0];
    if (!d) d = sides[1];
    return { term: sideText(w).trim(), definition: sideText(d).trim() };
  }

  function setId() {
    var seg = location.pathname.split("/").filter(Boolean)[0];
    return /^\d+$/.test(seg) ? seg : null;
  }

  // --- Source 1: internal API (complete, paginated) ---
  function fetchViaApi() {
    var id = setId();
    if (!id) return Promise.resolve([]);
    var all = [];
    function page(p, token) {
      var u =
        "https://quizlet.com/webapi/3.4/studiable-item-documents" +
        "?filters%5BstudiableContainerId%5D=" + id +
        "&filters%5BstudiableContainerType%5D=1&perPage=200&page=" + p;
      if (token) u += "&pagingToken=" + encodeURIComponent(token);
      return fetch(u, { headers: { Accept: "application/json" }, credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return all;
          var resp = j.responses && j.responses[0];
          var items = (resp && resp.models && resp.models.studiableItem) || [];
          all = all.concat(items);
          var tok = resp && resp.paging && resp.paging.token;
          if (tok && items.length && p < 40) return page(p + 1, tok);
          return all;
        })
        .catch(function () { return all; });
    }
    return page(1, null).then(function (items) {
      return items.map(function (it) { return pairFromCardSides(it.cardSides); });
    });
  }

  // --- Source 2: embedded Redux state ---
  function fromRedux() {
    try {
      var nd = JSON.parse(document.getElementById("__NEXT_DATA__").textContent);
      var redux = JSON.parse(nd.props.pageProps.dehydratedReduxStateKey);
      var items = redux.studyModesCommon.studiableData.studiableItems || [];
      return items.map(function (it) { return pairFromCardSides(it.cardSides); });
    } catch (e) { return []; }
  }

  // --- Source 3: JSON-LD Quiz markup ---
  function fromJsonLd() {
    var out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      try {
        var d = JSON.parse(s.textContent);
        var parts = d.hasPart || (d["@graph"] || []).reduce(function (a, x) {
          return a.concat(x.hasPart || []);
        }, []);
        (parts || []).forEach(function (q) {
          var term = q.text || q.name;
          var ans = q.acceptedAnswer || {};
          var def = ans.text || ans.name;
          if (term && def) out.push({ term: String(term).trim(), definition: String(def).trim() });
        });
      } catch (e) {}
    });
    return out;
  }

  function titleOf() {
    return (document.title || "Imported set")
      .replace(/\s*\|\s*Quizlet.*$/i, "")
      .replace(/\s+Flashcards\s*$/i, "")
      .trim();
  }

  fetchViaApi()
    .then(function (cards) {
      cards = (cards || []).filter(function (c) { return c.term || c.definition; });
      if (cards.length === 0) cards = fromRedux().filter(function (c) { return c.term || c.definition; });
      if (cards.length === 0) cards = fromJsonLd();
      if (cards.length === 0) {
        alert("QuizletLocal: couldn't find terms on this page. Make sure you're on a Quizlet set page and it's fully loaded.");
        return;
      }
      var title = titleOf();
      if (!confirm('QuizletLocal found ' + cards.length + ' cards in "' + title + '".\n\nSend them to your local app?')) return;
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, cards: cards }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) alert("Saved “" + d.title + "” — " + d.count + " cards to QuizletLocal.");
          else alert("QuizletLocal error: " + ((d && d.error) || "unknown"));
        })
        .catch(function () {
          alert("Couldn't reach QuizletLocal. Make sure the app is running at " + ENDPOINT + " (run: node server.js).");
        });
    });
})();
