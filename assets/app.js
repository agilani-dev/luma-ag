/* ==========================================================================
   Luma-style Demo Store — app.js (Adobe Launch friendly)
   ========================================================================== */

(() => {
  /* -----------------------------
   * 0) Utilities
   * ----------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  };

  const now = () => Date.now();

  /* -----------------------------
   * 1) Adobe Launch / Data Layer
   * ----------------------------- */
  window.adobeDataLayer = window.adobeDataLayer || [];

  function track(eventName, data = {}) {
    const payload = {
      event: eventName,
      ...data,
      ts: now(),
      page: {
        url: location.href,
        path: location.pathname,
        title: document.title
      }
    };

    try { window.adobeDataLayer.push(payload); } catch {}
    try {
      if (window._satellite && typeof window._satellite.track === "function") {
        window._satellite.track(eventName, data);
      }
    } catch {}

    return payload;
  }

  window.track = track;

  /* -----------------------------
   * 2) Alloy readiness helper
   * ----------------------------- */
  function waitForAlloyAndRun(callback, timeoutMs = 4000) {
    const start = Date.now();
    (function check() {
      if (typeof window.alloy === "function") {
        callback();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        console.error("Timed out waiting for Alloy");
        return;
      }
      setTimeout(check, 50);
    })();
  }

  function isHomepage() {
    return (
      location.pathname === "/" ||
      location.pathname.endsWith("/index.html") ||
      location.pathname.endsWith("/luma-ag/")
    );
  }

  /* -----------------------------
   * 3) Product rendering
   * ----------------------------- */
  function productCard(p) {
    const badge =
      p.tags?.includes("sale") ? `<span class="badge sale">Sale</span>` :
      p.tags?.includes("featured") ? `<span class="badge">Featured</span>` : "";

    // ✅ NEW: product decision scope (hero scope untouched)
    const scopeAttr = p.decisionScope
      ? `data-decision-scope="${p.decisionScope}"`
      : "";

    return `
      <article class="product" data-product="${p.id}" ${scopeAttr}>
        <div class="product-top">
          ${badge}
          <div class="product-img" aria-hidden="true">${p.name[0]}</div>
        </div>
        <h3 class="product-name">${p.name}</h3>
        <p class="muted small">${p.desc}</p>
        <div class="product-row">
          <strong>${money(p.price)}</strong>
          <div class="product-actions">
            <button class="btn sm primary" data-add="${p.id}">Add</button>
          </div>
        </div>
      </article>`;
  }

  function initHomeFeatured() {
    const grid = $("[data-featured-grid]");
    if (!grid || !window.LUMA_PRODUCTS) return;
    const featured = window.LUMA_PRODUCTS.filter(p => p.tags?.includes("featured"));
    grid.innerHTML = featured.map(productCard).join("");
  }

  /* -----------------------------
   * 4) 🔥 Decision scope helpers
   * ----------------------------- */

  // Collect hero + product scopes dynamically
  function getHomepageDecisionScopes() {
    return Array.from(
      document.querySelectorAll("[data-decision-scope]")
    ).map(el => el.getAttribute("data-decision-scope"));
  }

  function applyHtmlOffer(scope, propositions) {
    const el = document.querySelector(`[data-decision-scope="${scope}"]`);
    if (!el) return;

    const prop = propositions.find(p => p.scope === scope);
    if (!prop) return;

    const htmlItem = prop.items?.find(
      i => i.schema === "https://ns.adobe.com/personalization/html-content-item"
    );
    if (!htmlItem) return;

    el.innerHTML = htmlItem.data.content;
  }

  /* -----------------------------
   * 5) ✅ UPDATED: Homepage decisioning
   *     hp.hero.art is preserved
   * ----------------------------- */
  function deliverHomepageDecisions() {
    const scopes = getHomepageDecisionScopes();

    if (!scopes.includes("hp.hero.art")) {
      console.warn("hp.hero.art scope missing from DOM");
    }

    window.alloy("sendEvent", {
      type: "decisioning.propositionFetch",
      renderDecisions: true,
      decisionScopes: scopes,
      data: {
        __adobe: {
          target: { pageType: "homepage" }
        }
      }
    })
    .then(({ propositions = [] }) => {
      scopes.forEach(scope => applyHtmlOffer(scope, propositions));
    })
    .catch(err => console.error("Target decisioning error", err));
  }

  /* -----------------------------
   * 6) Boot sequence
   * ----------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initHomeFeatured();

    if (isHomepage()) {
      waitForAlloyAndRun(() => {
        requestAnimationFrame(deliverHomepageDecisions);
      });
    }

    track("page_view", { referrer: document.referrer || null });
  });

})();
``
