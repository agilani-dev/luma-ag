/* ==========================================================================
   Luma-style Demo Store — app.js (Adobe Launch friendly)
   - Static site helper: rendering + cart + modal + demo auth
   - Adobe Launch support: adobeDataLayer + track() + optional _satellite.track()
   ========================================================================== */

(() => {
  /* -----------------------------
   * 0) Tiny utilities
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
  // Ensure a data layer exists early; Launch can read from this or you can write rules
  window.adobeDataLayer = window.adobeDataLayer || [];

  /**
   * Push an event to adobeDataLayer and (if present) also call _satellite.track(eventName).
   * Launch loads async; this is safe because pushes accumulate in the array.
   */
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

    // 1) Primary: push into data layer (Launch rules can listen here)
    try { window.adobeDataLayer.push(payload); } catch {}

    // 2) Optional: if Launch _satellite exists, send a direct signal too
    try {
      if (window._satellite && typeof window._satellite.track === "function") {
        window._satellite.track(eventName, data);
      }
    } catch {}

    // 3) Optional: helpful for debugging
    // console.debug("[track]", payload);

    return payload;
  }

  // Expose track globally (handy for console testing)
  window.track = track;

  /* -----------------------------
   * 2) Global initialization
   * ----------------------------- */
  function setYear() {
    const y = $("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  }

  function domReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }
   // Run Target decisioning ONLY on homepage
if (
  location.pathname.endsWith("/index.html") ||
  location.pathname === "/" ||
  location.pathname.endsWith("/luma-ag/")
) {
  deliverHomepageHeroDecision();
}

  /* -----------------------------
   * 3) Cart (localStorage)
   * ----------------------------- */
  const CART_KEY = "luma_demo_cart";

  const getCart = () => storage.get(CART_KEY, []);
  const setCart = (cart) => storage.set(CART_KEY, cart);

  function cartCount(cart = getCart()) {
    return cart.reduce((sum, it) => sum + (it.qty || 0), 0);
  }

  function productMap() {
    const products = window.LUMA_PRODUCTS || [];
    return new Map(products.map(p => [p.id, p]));
  }

  function cartSubtotal(cart = getCart()) {
    const map = productMap();
    return cart.reduce((sum, it) => sum + (map.get(it.id)?.price || 0) * (it.qty || 0), 0);
  }

  function updateCartBadges() {
    $$("[data-cart-count]").forEach(el => el.textContent = cartCount());
  }

  function addToCart(id, qty = 1, source = "unknown") {
    const cart = getCart();
    const found = cart.find(x => x.id === id);
    if (found) found.qty += qty;
    else cart.push({ id, qty });

    setCart(cart);
    updateCartBadges();
    renderCartDrawer();

    const p = (window.LUMA_PRODUCTS || []).find(x => x.id === id);
    track("add_to_cart", {
      source,
      commerce: {
        currency: "USD",
        value: (p?.price || 0) * qty,
        items: [{ item_id: id, item_name: p?.name, item_category: p?.category, price: p?.price, quantity: qty }]
      },
      cart: { count: cartCount(cart), subtotal: cartSubtotal(cart) }
    });
  }

  function removeFromCart(id, source = "unknown") {
    const cartBefore = getCart();
    const itemBefore = cartBefore.find(x => x.id === id);
    const cart = cartBefore.filter(x => x.id !== id);

    setCart(cart);
    updateCartBadges();
    renderCartDrawer();

    const p = (window.LUMA_PRODUCTS || []).find(x => x.id === id);
    track("remove_from_cart", {
      source,
      commerce: {
        currency: "USD",
        value: (p?.price || 0) * (itemBefore?.qty || 1),
        items: [{ item_id: id, item_name: p?.name, item_category: p?.category, price: p?.price, quantity: itemBefore?.qty || 1 }]
      },
      cart: { count: cartCount(cart), subtotal: cartSubtotal(cart) }
    });
  }

  function setQty(id, qty) {
    const cart = getCart();
    const item = cart.find(x => x.id === id);
    if (!item) return;
    item.qty = Math.max(1, qty);
    setCart(cart);
    updateCartBadges();
    renderCartDrawer();
  }

  /* -----------------------------
   * 4) Drawer + Modal
   * ----------------------------- */
  const drawer = $("[data-cart-drawer]");
  function openDrawer() {
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "false");
    drawer.classList.add("open");
    renderCartDrawer();

    track("view_cart", {
      cart: { count: cartCount(), subtotal: cartSubtotal() }
    });
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "true");
    drawer.classList.remove("open");
  }

  function renderCartDrawer() {
    if (!drawer) return;
    const itemsEl = $("[data-cart-items]");
    const subtotalEl = $("[data-cart-subtotal]");
    const cart = getCart();
    const map = productMap();

    if (itemsEl) {
      if (!cart.length) {
        itemsEl.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      } else {
        itemsEl.innerHTML = cart.map(it => {
          const p = map.get(it.id);
          if (!p) return "";
          return `
            <div class="cart-item">
              <div class="cart-meta">
                <div class="cart-name">${p.name}</div>
                <div class="muted small">${p.category}</div>
                <div class="muted small">${money(p.price)} each</div>
              </div>
              <div class="cart-controls">
                <input type="number" min="1" value="${it.qty}" data-qty="${p.id}" />
                <button class="link danger" type="button" data-remove="${p.id}">Remove</button>
              </div>
            </div>`;
        }).join("");
      }
    }

    if (subtotalEl) subtotalEl.textContent = money(cartSubtotal(cart));

    // bind qty/remove
    $$("input[data-qty]", drawer).forEach(inp => {
      inp.addEventListener("change", (e) => {
        setQty(inp.dataset.qty, parseInt(e.target.value || "1", 10));
      });
    });
    $$("button[data-remove]", drawer).forEach(btn => {
      btn.addEventListener("click", () => removeFromCart(btn.dataset.remove, "cart_drawer"));
    });
  }

  // Modal
  const modal = $("[data-modal]");
  function openModal(html) {
    if (!modal) return;
    $("[data-modal-content]").innerHTML = html;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
  }
  function closeModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
  }

  /* -----------------------------
   * 5) Product rendering
   * ----------------------------- */
  function productCard(p) {
    const badge =
      p.tags?.includes("sale") ? `<span class="badge sale">Sale</span>` :
      p.tags?.includes("featured") ? `<span class="badge">Featured</span>` : "";

    return `
      <article class="product" data-product="${p.id}">
        <div class="product-top">
          ${badge}
          <div class="product-img" aria-hidden="true">${(p.name || "?").slice(0,1)}</div>
        </div>
        <h3 class="product-name">${p.name}</h3>
        <p class="muted small">${p.desc || ""}</p>
        <div class="product-row">
          <strong>${money(p.price)}</strong>
          <div class="product-actions">
            <button class="btn sm" type="button" data-quick="${p.id}">Quick view</button>
            <button class="btn sm primary" type="button" data-add="${p.id}">Add</button>
          </div>
        </div>
      </article>`;
  }

  function bindProductActions(root = document) {
    $$("[data-add]", root).forEach(btn => {
      btn.addEventListener("click", () => addToCart(btn.dataset.add, 1, "product_card"));
    });

    $$("[data-quick]", root).forEach(btn => {
      btn.addEventListener("click", () => {
        const p = (window.LUMA_PRODUCTS || []).find(x => x.id === btn.dataset.quick);
        if (!p) return;

        // Track view item
        track("view_item", {
          commerce: {
            currency: "USD",
            value: p.price,
            items: [{ item_id: p.id, item_name: p.name, item_category: p.category, price: p.price, quantity: 1 }]
          }
        });

        openModal(`
          <h2>${p.name}</h2>
          <p class="muted">${p.category} • ${money(p.price)}</p>
          <p>${p.desc || ""}</p>
          <div class="row gap">
            <button class="btn primary" type="button" data-add="${p.id}">Add to cart</button>
            <button class="btn" type="button" data-modal-close>Close</button>
          </div>
        `);

        bindProductActions(modal);
        $$("[data-modal-close]", modal).forEach(x => x.addEventListener("click", closeModal));
      });
    });
  }

  /* -----------------------------
   * 6) Page-specific wiring
   * ----------------------------- */
  function initHomeFeatured() {
    const featuredGrid = $("[data-featured-grid]");
    if (!featuredGrid || !window.LUMA_PRODUCTS) return;

    const featured = window.LUMA_PRODUCTS.filter(p => p.tags?.includes("featured")).slice(0, 6);
    featuredGrid.innerHTML = featured.map(productCard).join("");
    bindProductActions(featuredGrid);

    track("view_item_list", {
      list_name: "featured",
      commerce: {
        currency: "USD",
        items: featured.map(p => ({ item_id: p.id, item_name: p.name, item_category: p.category, price: p.price, quantity: 1 }))
      }
    });
  }

  function initProductsPage() {
    const productsGrid = $("[data-products-grid]");
    if (!productsGrid || !window.LUMA_PRODUCTS) return;

    const titleEl = $("[data-products-title]");
    const params = new URLSearchParams(location.search);
    const initialCat = params.get("cat") || "";

    const searchEl = $("[data-search]");
    const catEl = $("[data-category]");
    const sortEl = $("[data-sort]");

    if (catEl && initialCat) catEl.value = initialCat;

    function apply() {
      let list = [...window.LUMA_PRODUCTS];

      const q = (searchEl?.value || "").trim().toLowerCase();
      const cat = (catEl?.value || "").trim().toLowerCase();
      const sort = sortEl?.value || "featured";

      if (cat) list = list.filter(p => (p.category || "").toLowerCase() === cat);
      if (q) list = list.filter(p => ((p.name || "") + " " + (p.desc || "")).toLowerCase().includes(q));

      if (sort === "price-asc") list.sort((a,b) => a.price - b.price);
      if (sort === "price-desc") list.sort((a,b) => b.price - a.price);
      if (sort === "name-asc") list.sort((a,b) => (a.name || "").localeCompare(b.name || ""));
      if (sort === "featured") list.sort((a,b) => (b.tags?.includes("featured")?1:0) - (a.tags?.includes("featured")?1:0));

      productsGrid.innerHTML = list.map(productCard).join("");
      bindProductActions(productsGrid);

      if (titleEl) titleEl.textContent = cat ? `${cat.toUpperCase()} Products` : "All Products";

      track("view_item_list", {
        list_name: cat || "all_products",
        filters: { q: q || null, category: cat || null, sort },
        commerce: {
          currency: "USD",
          items: list.slice(0, 50).map(p => ({ item_id: p.id, item_name: p.name, item_category: p.category, price: p.price, quantity: 1 }))
        }
      });
    }

    [searchEl, catEl, sortEl].forEach(el => el?.addEventListener("input", apply));
    apply();
  }

  function initNewsletter() {
    const form = $("[data-newsletter]");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = $("[data-newsletter-msg]");
      if (msg) msg.textContent = "Thanks! You’re subscribed (demo).";
      const email = new FormData(form).get("email");

      track("newsletter_subscribe", { email: email ? String(email) : null });

      form.reset();
    });
  }

  function initAuth() {
    // Demo sign-in
    const signInForm = $("[data-auth='signin']");
    if (signInForm) {
      signInForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(signInForm);
        const email = fd.get("email");

        storage.set("luma_demo_user", { email, ts: now() });

        const msg = $("[data-auth-msg]");
        if (msg) msg.textContent = "Signed in (demo). Redirecting to Home…";

        track("login", { email: email ? String(email) : null });

        setTimeout(() => location.href = "./index.html", 400);
      });
    }

    // Demo sign-up
    const signUpForm = $("[data-auth='signup']");
    if (signUpForm) {
      signUpForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(signUpForm);
        const p = fd.get("password");
        const cp = fd.get("confirmPassword");
        const email = fd.get("email");
        const name = `${fd.get("firstName") || ""} ${fd.get("lastName") || ""}`.trim();

        const msg = $("[data-auth-msg]");
        if (p !== cp) { if (msg) msg.textContent = "Passwords do not match."; return; }

        storage.set("luma_demo_user", { email, name, ts: now() });
        if (msg) msg.textContent = "Account created (demo). Redirecting to Home…";

        track("sign_up", { email: email ? String(email) : null, name: name || null });

        setTimeout(() => location.href = "./index.html", 400);
      });
    }

    // Demo forgot link
    $("[data-forgot]")?.addEventListener("click", (e) => {
      e.preventDefault();
      track("password_help", {});
      alert("Demo: password reset flow would start here.");
    });
  }

  function initCartButtons() {
    $$("[data-open-cart]").forEach(btn => btn.addEventListener("click", openDrawer));
    $$("[data-close-cart]").forEach(btn => btn.addEventListener("click", closeDrawer));
    $$("[data-modal-close]").forEach(btn => btn.addEventListener("click", closeModal));

    $("[data-clear-cart]")?.addEventListener("click", () => {
      setCart([]);
      updateCartBadges();
      renderCartDrawer();
      track("clear_cart", {});
    });

    $("[data-checkout]")?.addEventListener("click", () => {
      const cart = getCart();
      const subtotal = cartSubtotal(cart);

      track("begin_checkout", {
        cart: { count: cartCount(cart), subtotal },
        commerce: {
          currency: "USD",
          value: subtotal,
          items: cart.map(it => {
            const p = (window.LUMA_PRODUCTS || []).find(x => x.id === it.id);
            return { item_id: it.id, item_name: p?.name, item_category: p?.category, price: p?.price, quantity: it.qty };
          })
        }
      });

      alert("Demo checkout — wire this to your enablement flow / analytics events.");
    });
  }
function deliverHomepageHeroDecision() {
  // 1. Find the hero container
  const heroEl = document.querySelector(
    '[data-decision-scope="hp.hero.art"]'
  );

  // 2. Safety checks
  if (!heroEl) {
    console.warn("Hero element not found for decision scope");
    return;
  }

  if (typeof window.alloy !== "function") {
    console.warn("Alloy is not available");
    return;
  }

  // 3. Request the decision scope from Target
  window.alloy("sendEvent", {
    type: "decisioning.propositionFetch",

    decisionScopes: [
      "hp.hero.art"
    ],

    data: {
      __adobe: {
        target: {
          pageType: "homepage"
        }
      }
    }
  })
  .then((result) => {
    if (!result || !result.propositions) {
      return;
    }

    // 4. Find our specific scope
    result.propositions.forEach((proposition) => {
      if (proposition.scope !== "hp.hero.art") {
        return;
      }

      // 5. Apply HTML offer
      proposition.items.forEach((item) => {
        if (
          item.schema ===
          "https://ns.adobe.com/personalization/html-content-item"
        ) {
          heroEl.innerHTML = item.data.content;
        }
      });
    });
  })
  .catch((error) => {
    console.error("Target decisioning error", error);
  });
}
  /* -----------------------------
   * 7) Boot sequence
   * ----------------------------- */
  domReady(() => {
    setYear();
    updateCartBadges();
    initCartButtons();
    initHomeFeatured();
    initProductsPage();
    initNewsletter();
    initAuth();

    // Track page view once DOM is ready
    track("page_view", {
      referrer: document.referrer || null
    });
  });

})();
