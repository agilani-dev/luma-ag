// assets/app.js
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const money = (n) => `$${n.toFixed(2)}`;
const yearEl = $("[data-year]");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

// --- CART ---
const CART_KEY = "luma_demo_cart";
const getCart = () => storage.get(CART_KEY, []);
const setCart = (cart) => storage.set(CART_KEY, cart);

function cartCount(cart = getCart()) {
  return cart.reduce((sum, it) => sum + it.qty, 0);
}
function cartSubtotal(cart = getCart()) {
  const products = window.LUMA_PRODUCTS || [];
  const map = new Map(products.map(p => [p.id, p]));
  return cart.reduce((sum, it) => sum + (map.get(it.id)?.price || 0) * it.qty, 0);
}
function updateCartBadges() {
  $$("[data-cart-count]").forEach(el => el.textContent = cartCount());
}
updateCartBadges();

function addToCart(id, qty = 1) {
  const cart = getCart();
  const found = cart.find(x => x.id === id);
  if (found) found.qty += qty;
  else cart.push({ id, qty });
  setCart(cart);
  updateCartBadges();
  renderCartDrawer();
}

function removeFromCart(id) {
  const cart = getCart().filter(x => x.id !== id);
  setCart(cart);
  updateCartBadges();
  renderCartDrawer();
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

// Drawer open/close
const drawer = $("[data-cart-drawer]");
function openDrawer() {
  if (!drawer) return;
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("open");
  renderCartDrawer();
}
function closeDrawer() {
  if (!drawer) return;
  drawer.setAttribute("aria-hidden", "true");
  drawer.classList.remove("open");
}
$$("[data-open-cart]").forEach(btn => btn.addEventListener("click", openDrawer));
$$("[data-close-cart]").forEach(btn => btn.addEventListener("click", closeDrawer));

function renderCartDrawer() {
  if (!drawer) return;
  const itemsEl = $("[data-cart-items]");
  const subtotalEl = $("[data-cart-subtotal]");
  const cart = getCart();
  const products = window.LUMA_PRODUCTS || [];
  const map = new Map(products.map(p => [p.id, p]));

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
    inp.addEventListener("change", (e) => setQty(inp.dataset.qty, parseInt(e.target.value || "1", 10)));
  });
  $$("button[data-remove]", drawer).forEach(btn => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.remove));
  });
}

$("[data-clear-cart]")?.addEventListener("click", () => { setCart([]); updateCartBadges(); renderCartDrawer(); });
$("[data-checkout]")?.addEventListener("click", () => alert("Demo checkout — wire this to your enablement flow / analytics events."));

// --- MODAL ---
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
$$("[data-modal-close]").forEach(x => x.addEventListener("click", closeModal));

// --- PRODUCT RENDERING ---
function productCard(p) {
  const badge = p.tags?.includes("sale") ? `<span class="badge sale">Sale</span>` :
                p.tags?.includes("featured") ? `<span class="badge">Featured</span>` : "";
  return `
    <article class="product" data-product="${p.id}">
      <div class="product-top">
        ${badge}
        <div class="product-img" aria-hidden="true">${p.name.slice(0,1)}</div>
      </div>
      <h3 class="product-name">${p.name}</h3>
      <p class="muted small">${p.desc}</p>
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
  $$("[data-add]", root).forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add, 1)));
  $$("[data-quick]", root).forEach(btn => btn.addEventListener("click", () => {
    const p = (window.LUMA_PRODUCTS || []).find(x => x.id === btn.dataset.quick);
    if (!p) return;
    openModal(`
      <h2>${p.name}</h2>
      <p class="muted">${p.category} • ${money(p.price)}</p>
      <p>${p.desc}</p>
      <div class="row gap">
        <button class="btn primary" type="button" data-add="${p.id}">Add to cart</button>
        <button class="btn" type="button" data-modal-close>Close</button>
      </div>
    `);
    bindProductActions(modal);
    $$("[data-modal-close]", modal).forEach(x => x.addEventListener("click", closeModal));
  }));
}

// Home featured
const featuredGrid = $("[data-featured-grid]");
if (featuredGrid && window.LUMA_PRODUCTS) {
  const featured = window.LUMA_PRODUCTS.filter(p => p.tags?.includes("featured")).slice(0, 6);
  featuredGrid.innerHTML = featured.map(productCard).join("");
  bindProductActions(featuredGrid);
}

// Products page
const productsGrid = $("[data-products-grid]");
if (productsGrid && window.LUMA_PRODUCTS) {
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

    if (cat) list = list.filter(p => p.category.toLowerCase() === cat);
    if (q) list = list.filter(p => (p.name + " " + p.desc).toLowerCase().includes(q));

    if (sort === "price-asc") list.sort((a,b) => a.price - b.price);
    if (sort === "price-desc") list.sort((a,b) => b.price - a.price);
    if (sort === "name-asc") list.sort((a,b) => a.name.localeCompare(b.name));
    if (sort === "featured") list.sort((a,b) => (b.tags?.includes("featured")?1:0) - (a.tags?.includes("featured")?1:0));

    productsGrid.innerHTML = list.map(productCard).join("");
    bindProductActions(productsGrid);

    if (titleEl) titleEl.textContent = cat ? `${cat.toUpperCase()} Products` : "All Products";
  }

  [searchEl, catEl, sortEl].forEach(el => el?.addEventListener("input", apply));
  apply();
}

// Newsletter
$("[data-newsletter]")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = $("[data-newsletter-msg]");
  if (msg) msg.textContent = "Thanks! You’re subscribed (demo).";
  e.target.reset();
});

// Demo auth
function setSession(user) { storage.set("luma_demo_user", user); }
$("[data-auth='signin']")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  setSession({ email: fd.get("email"), ts: Date.now() });
  const msg = $("[data-auth-msg]");
  if (msg) msg.textContent = "Signed in (demo). Redirecting to Home…";
  setTimeout(() => location.href = "./index.html", 400);
});

$("[data-auth='signup']")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = fd.get("password");
  const cp = fd.get("confirmPassword");
  const msg = $("[data-auth-msg]");
  if (p !== cp) { if (msg) msg.textContent = "Passwords do not match."; return; }
  setSession({ email: fd.get("email"), name: `${fd.get("firstName")} ${fd.get("lastName")}`, ts: Date.now() });
  if (msg) msg.textContent = "Account created (demo). Redirecting to Home…";
  setTimeout(() => location.href = "./index.html", 400);
});

$("[data-forgot]")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Demo: password reset flow would start here.");
});
