// ============================================
// APP CONTROLLER - Matching reference image
// ============================================

const Storage = {
    get(key, defaultVal = null) {
        try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : defaultVal; }
        catch { return defaultVal; }
    },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    remove(key) { localStorage.removeItem(key); }
};

const AppState = {
    cart: Storage.get('cart', []),
    wishlist: Storage.get('wishlist', []),
    orders: [],
    recentlyViewed: Storage.get('recentlyViewed', []),
    notifications: Storage.get('notifications', []),
    addresses: Storage.get('addresses', []),
    user: Storage.get('user', { name: '', email: '', phone: '' }),
    theme: Storage.get('theme', 'light'),
    currentPage: 'home',
    selectedProduct: null,
    selectedColor: null,
    selectedSize: null,
    selectedAddress: 1,
    selectedPayment: 'card',
    searchFilter: 'all'
};

// Toast
function showToast(title, message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle' };
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${icons[type] || icons.success}"></i></div>
        <div class="toast-content"><h4>${title}</h4><p>${message}</p></div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 250); }, duration);
}

// Cart
function getCartCount() { return AppState.cart.reduce((sum, item) => sum + item.qty, 0); }
function getCartTotal() { return AppState.cart.reduce((sum, item) => sum + (item.price * item.qty), 0); }

function addToCart(productId, qty = 1, color = null, size = null) {
    const product = getProductById(productId);
    if (!product) return;
    if (product.stock <= 0) { showToast('Out of Stock', `${product.name} is currently unavailable.`, 'error'); return; }
    const inCart = AppState.cart.filter(i => i.id === productId).reduce((s, i) => s + i.qty, 0);
    if (inCart + qty > product.stock) { showToast('Limited Stock', `Only ${product.stock} available.`, 'warning'); return; }
    const existing = AppState.cart.find(item => _sameLine(item, productId, color, size));
    if (existing) { existing.qty += qty; }
    else { AppState.cart.push({ id: productId, name: product.name, price: product.price, image: variantImage(product, color), qty, color, size }); }
    Storage.set('cart', AppState.cart);
    updateCartBadge();
    showToast('Added to Cart', `${product.name} has been added to your cart.`, 'success');
}

function _nz(v) { return (v === undefined || v === null || v === 'null' || v === 'undefined' || v === '') ? null : v; }
function _sameLine(item, productId, color, size) { return item.id === productId && _nz(item.color) === _nz(color) && _nz(item.size) === _nz(size); }
function removeFromCart(productId, color, size) {
    AppState.cart = AppState.cart.filter(item => !_sameLine(item, productId, color, size));
    Storage.set('cart', AppState.cart);
    updateCartBadge();
    renderCart();
}

function updateCartQty(productId, color, size, delta) {
    const item = AppState.cart.find(i => _sameLine(i, productId, color, size));
    if (!item) return;
    const p = getProductById(productId);
    if (delta > 0 && p && item.qty + delta > p.stock) { showToast('Limited Stock', `Only ${p.stock} available.`, 'warning'); return; }
    item.qty += delta;
    if (item.qty <= 0) { removeFromCart(productId, color, size); return; }
    Storage.set('cart', AppState.cart);
    updateCartBadge();
    renderCart();
}

function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = getCartCount();
    badges.forEach(badge => { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; });
    const cartCountText = document.getElementById('cartCountText');
    if (cartCountText) cartCountText.textContent = `${count} item${count !== 1 ? 's' : ''}`;
}

// Wishlist
function toggleWishlist(productId) {
    const index = AppState.wishlist.indexOf(productId);
    const product = getProductById(productId);
    if (index > -1) {
        AppState.wishlist.splice(index, 1);
        showToast('Removed', `${product.name} removed from wishlist.`, 'warning');
    } else {
        AppState.wishlist.push(productId);
        showToast('Added to Wishlist', `${product.name} has been saved.`, 'success');
    }
    Storage.set('wishlist', AppState.wishlist);
    updateWishlistButtons();
    if (AppState.currentPage === 'wishlist') renderWishlist();
}

function isInWishlist(productId) { return AppState.wishlist.includes(productId); }

function updateWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const pid = parseInt(btn.dataset.id);
        if (isInWishlist(pid)) { btn.classList.add('active'); btn.innerHTML = '<i class="fas fa-heart"></i>'; }
        else { btn.classList.remove('active'); btn.innerHTML = '<i class="far fa-heart"></i>'; }
    });
}

function addToRecentlyViewed(productId) {
    AppState.recentlyViewed = AppState.recentlyViewed.filter(id => id !== productId);
    AppState.recentlyViewed.unshift(productId);
    if (AppState.recentlyViewed.length > 10) AppState.recentlyViewed.pop();
    Storage.set('recentlyViewed', AppState.recentlyViewed);
}

function addNotification(title, message, type = 'cart') {
    AppState.notifications.unshift({ id: Date.now(), title, message, type, time: new Date().toISOString(), read: false });
    if (AppState.notifications.length > 50) AppState.notifications.pop();
    Storage.set('notifications', AppState.notifications);
}

// Theme
function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark-mode', AppState.theme === 'dark');
    Storage.set('theme', AppState.theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.classList.toggle('active', AppState.theme === 'dark');
}

function initTheme() {
    if (AppState.theme === 'dark') document.body.classList.add('dark-mode');
}

// Navigation
function navigateTo(page, params = {}) {
    if (page !== 'chat' && typeof chatUnsub !== 'undefined' && chatUnsub) { chatUnsub(); chatUnsub = null; }
    hideSuggest();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    AppState.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navMap = { home: 'nav-home', categories: 'nav-categories', wishlist: 'nav-wishlist', orders: 'nav-orders', profile: 'nav-profile' };
    const navId = navMap[page];
    if (navId) { const nav = document.getElementById(navId); if (nav) nav.classList.add('active'); }
    window.scrollTo(0, 0);
    switch(page) {
        case 'home': renderHome(); break;
        case 'categories': renderCategories(); break;
        case 'search': renderSearch(params.query || ''); break;
        case 'product': renderProductDetail(params.id); break;
        case 'cart': renderCart(); break;
        case 'wishlist': renderWishlist(); break;
        case 'checkout': renderCheckout(); break;
        case 'orders': renderOrders(); break;
        case 'profile': renderProfile(); break;
        case 'notifications': renderNotifications(); break;
        case 'auth': setAuthMode('in'); break;
        case 'chat': renderChat(params.topic); break;
    }
}

// Product Card
function createProductCard(product, isFlash = false) {
    const inWishlist = isInWishlist(product.id);
    return `
        <div class="product-card ${isFlash ? 'flash-card' : ''}" onclick="navigateTo('product', {id: ${product.id}})">
            <div class="product-image-wrap">
                <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
                <button class="wishlist-btn ${inWishlist ? 'active' : ''}" data-id="${product.id}" onclick="event.stopPropagation(); toggleWishlist(${product.id})" aria-label="Wishlist">
                    <i class="${inWishlist ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price-row">
                    <span class="current-price">${formatPrice(product.price)}</span>
                    <button class="add-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id}); this.classList.add('added'); setTimeout(()=>this.classList.remove('added'), 400)" aria-label="Add to cart">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>`;
}

function createFlashCard(product) {
    const inWishlist = isInWishlist(product.id);
    const discount = getDiscountPercent(product.oldPrice, product.price);
    const left = Math.max(0, Number(product.flashStock || product.stock) || 0);
    const pct = Math.max(8, Math.min(100, left * 5));
    return `
        <div class="product-card flash-card" onclick="navigateTo('product', {id: ${product.id}})">
            <div class="product-image-wrap flash-img">
                <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
                ${discount > 0 ? `<span class="flash-off">-${discount}%</span>` : ''}
                <button class="wishlist-btn ${inWishlist ? 'active' : ''}" data-id="${product.id}" onclick="event.stopPropagation(); toggleWishlist(${product.id})" aria-label="Wishlist">
                    <i class="${inWishlist ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="flash-prices">
                    <div>
                        <span class="current-price">${formatPrice(product.price)}</span>
                        ${product.oldPrice > product.price ? `<span class="flash-old">${formatPrice(product.oldPrice)}</span>` : ''}
                    </div>
                    <button class="add-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id}); this.classList.add('added'); setTimeout(()=>this.classList.remove('added'), 400)" aria-label="Add to cart">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
                <div class="flash-stock"><div class="flash-stock-fill" style="width:${pct}%"></div></div>
                <div class="flash-left">${left > 0 ? (left <= 20 ? `Only ${left} left` : 'Selling fast') : 'Sold out'}</div>
            </div>
        </div>`;
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) html += '<i class="fas fa-star"></i>';
        else if (i === Math.ceil(rating) && !Number.isInteger(rating)) html += '<i class="fas fa-star-half-alt"></i>';
        else html += '<i class="far fa-star empty"></i>';
    }
    return html;
}

// Home
function renderHome() {
    const catContainer = document.getElementById('homeCategories');
    if (catContainer) {
        catContainer.innerHTML = categories.map(cat => `
            <button class="category-card ${cat.id === 'all' ? 'active' : ''}" onclick="shopCategory('${cat.id === 'all' ? 'all' : cat.id}')">
                <div class="category-icon"><i class="fas ${cat.icon}"></i></div>
                <span class="category-name">${cat.name}</span>
            </button>
        `).join('');
        const more = document.getElementById('catFade');
        if (more) more.style.display = categories.length > 4 ? '' : 'none';
    }
    const featured = products.filter(p => p.isFeatured);
    const featList = (featured.length ? featured : products).slice(0, 6);
    const featuredContainer = document.getElementById('homeFeatured');
    if (featuredContainer) featuredContainer.innerHTML = featList.length ? featList.map(p => createProductCard(p)).join('') : '<p class="text-muted" style="grid-column:1/-1;">Products are coming soon.</p>';

    const flashContainer = document.getElementById('homeFlash');
    const flashSec = document.getElementById('flashSection');
    if (flashContainer) {
        const flash = getFlashProducts();
        flashContainer.innerHTML = flash.map(p => createFlashCard(p)).join('');
        if (!flashContainer._bound) { flashContainer._bound = true; flashContainer.addEventListener('scroll', updateFlashArrows, { passive: true }); window.addEventListener('resize', updateFlashArrows); }
        flashContainer.scrollLeft = 0; setTimeout(updateFlashArrows, 50);
        if (flashSec) flashSec.style.display = flash.length ? '' : 'none';
        const t = document.querySelector('#flashSection .flash-title h2');
        if (t && AppState.flash && AppState.flash.title) t.textContent = AppState.flash.title;
    }

    const shown = new Set(featList.map(p => p.id));
    const restList = products.filter(p => !shown.has(p.id));
    const recContainer = document.getElementById('homeRecommended');
    if (recContainer) recContainer.innerHTML = (restList.length ? restList : products).slice(0, 6).map(p => createProductCard(p)).join('');

    const recentContainer = document.getElementById('homeRecent');
    const recentSection = document.getElementById('recentSection');
    if (recentContainer && recentSection) {
        if (AppState.recentlyViewed.length === 0) { recentSection.classList.add('hidden'); }
        else {
            recentSection.classList.remove('hidden');
            recentContainer.innerHTML = AppState.recentlyViewed.map(id => getProductById(id)).filter(Boolean).map(p => createProductCard(p)).join('');
        }
    }
    updateWishlistButtons();
}

// Categories
function renderCategories() {
    const catContainer = document.getElementById('catCategories');
    if (catContainer) {
        catContainer.innerHTML = categories.map(cat => `
            <button class="category-card" onclick="filterByCategory('${cat.id}')">
                <div class="category-icon"><i class="fas ${cat.icon}"></i></div>
                <span class="category-name">${cat.name}</span>
            </button>
        `).join('');
    }
    filterByCategory('all');
}

function shopCategory(name) {
    const n = String(name || 'all').toLowerCase().trim();
    if (n === 'all') { navigateTo('categories'); filterByCategory('all'); return; }
    let cat = categories.find(c => c.id.toLowerCase() === n || c.name.toLowerCase() === n)
        || categories.find(c => c.id !== 'all' && (c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase())));
    if (!cat) { navigateTo('search', { query: name }); return; }
    navigateTo('categories');
    filterByCategory(cat.id);
    const el = document.getElementById('catProducts');
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function filterByCategory(category) {
    const grid = document.getElementById('catProducts');
    if (!grid) return;
    const filtered = getProductsByCategory(category);
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon"><i class="fas fa-box-open"></i></div><h3>No products found</h3><p>No products in this category yet.</p></div>`;
    } else {
        grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
    }
    document.querySelectorAll('#catCategories .category-card').forEach(card => {
        const name = card.querySelector('.category-name').textContent;
        card.classList.toggle('active', name === (category === 'all' ? 'All' : category));
    });
    updateWishlistButtons();
}

// Search
function sortBySearchFilter(list) {
    const f = AppState.searchFilter;
    if (f === 'price-low') list.sort((a, b) => a.price - b.price);
    else if (f === 'price-high') list.sort((a, b) => b.price - a.price);
    else if (f === 'rating') list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    return list;
}
function renderSearch(query = '') {
    const input = document.getElementById('searchInput');
    if (input && query) input.value = query;
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    const searchQuery = query || (input ? input.value : '');
    if (!searchQuery.trim()) {
        const f = AppState.searchFilter;
        if (f === 'all') {
            resultsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3>Search Products</h3><p>Search for products, brands, or categories.</p></div>${relatedBlock(null, '', [])}`;
            updateWishlistButtons(); return;
        }
        const all = sortBySearchFilter([...products]);
        const label = { 'price-low': 'Lowest price first', 'price-high': 'Highest price first', 'rating': 'Top rated first' }[f];
        resultsContainer.innerHTML = `<p class="text-muted" style="margin:4px 0 10px;">${all.length} product${all.length === 1 ? '' : 's'} · ${label}</p><div class="products-grid">${all.map(p => createProductCard(p)).join('')}</div>`;
        updateWishlistButtons(); return;
    }
    let results = searchProducts(searchQuery);
    results = sortBySearchFilter(results);

    if (results.length === 0) {
        resultsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3>No products found</h3><p>We couldn't find an exact match for "${esc(searchQuery)}". Try these instead:</p></div>${relatedBlock(null, searchQuery, [])}`;
    } else {
        resultsContainer.innerHTML = `<p class="text-muted" style="margin:4px 0 10px;">${results.length} result${results.length === 1 ? '' : 's'} for "${esc(searchQuery)}"</p><div class="products-grid">${results.map(p => createProductCard(p)).join('')}</div>${relatedBlock(results, searchQuery, results)}`;
    }
    updateWishlistButtons();
}

function setSearchFilter(el, filter) {
    AppState.searchFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderSearch();
}

function handleSearch(e) {
    if (e.key === 'Enter') navigateTo('search', { query: e.target.value });
}

// Product Detail
function safeUrl(u) { return /^https:\/\//i.test(u || '') || /^\.?\/?images\//.test(u || '') ? String(u).replace(/"/g, '%22').replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E') : ''; }
function galleryFor(p, color) {
    const v = (p.variants || []).find(x => x.color.toLowerCase() === String(color || '').toLowerCase());
    if (v && v.images.length) return v.images;
    return p.images && p.images.length ? p.images : [p.image];
}
function variantImage(p, color) { return galleryFor(p, color)[0] || p.image; }
function paintGallery(i = 0) {
    const imgs = AppState.gallery || [];
    const main = document.getElementById('detailMainImg');
    if (main && imgs[i]) main.src = imgs[i];
    const th = document.getElementById('detailThumbs');
    if (th) th.innerHTML = imgs.length > 1 ? imgs.map((u, k) => `<button class="dthumb ${k === i ? 'active' : ''}" onclick="paintGallery(${k})"><img src="${u}" alt=""></button>`).join('') : '';
}
function renderProductDetail(productId) {
    const product = getProductById(productId);
    if (!product) return;
    AppState.selectedProduct = product;
    const firstColor = (product.variants && product.variants[0] && product.variants[0].color) || (product.colors && product.colors[0]) || null;
    AppState.selectedColor = firstColor;
    AppState.selectedSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : null;
    AppState.gallery = galleryFor(product, firstColor);
    addToRecentlyViewed(product.id);
    const container = document.getElementById('productDetail');
    if (!container) return;
    const discount = getDiscountPercent(product.oldPrice, product.price);
    const inWishlist = isInWishlist(product.id);
    let stockClass = 'in-stock', stockText = `In Stock (${product.stock} available)`;
    if (product.stock <= 5) { stockClass = 'low-stock'; stockText = `Only ${product.stock} left - Order soon!`; }
    if (product.stock === 0) { stockClass = 'out-stock'; stockText = 'Out of Stock'; }
    const swatches = (product.variants && product.variants.length) ? product.variants.map(v => ({ c: v.color, n: v.name })) : (product.colors || []).map(c => ({ c, n: '' }));

    container.innerHTML = `
        <div class="product-detail-img">
            <img src="${AppState.gallery[0] || product.image}" alt="${product.name}" id="detailMainImg">
            <button class="back-btn" onclick="navigateTo('home')" aria-label="Back"><i class="fas fa-arrow-left"></i></button>
            <button class="detail-wishlist-btn ${inWishlist ? 'active' : ''}" onclick="toggleWishlist(${product.id})" aria-label="Wishlist"><i class="${inWishlist ? 'fas' : 'far'} fa-heart"></i></button>
        </div>
        <div class="detail-thumbs" id="detailThumbs"></div>
        <div class="product-detail-info">
            <h1 class="product-detail-name">${product.name}</h1>
            <div class="product-detail-rating">
                <div class="stars">${renderStars(product.rating)}</div>
                <span class="text-muted">${product.reviews ? `${Number(product.rating).toFixed(1)} (${product.reviews} review${product.reviews === 1 ? '' : 's'})` : 'No reviews yet'}</span>
            </div>
            <div class="product-detail-price">
                <span class="current">${formatPrice(product.price)}</span>
                ${product.oldPrice > product.price ? `<span class="old">${formatPrice(product.oldPrice)}</span>` : ''}
                ${discount > 0 ? `<span class="discount">-${discount}%</span>` : ''}
            </div>
            ${product.flashOn ? '<div class="flash-tag"><i class="fas fa-bolt"></i> Flash sale price</div>' : ''}
            <div class="stock-status ${stockClass}"><i class="fas fa-circle" style="font-size:0.5rem;"></i> ${stockText}</div>
            <div class="delivery-info mt-3"><i class="fas fa-truck"></i><span>Free delivery within Lagos. 2-3 business days.</span></div>
            ${swatches.length ? `
                <div class="detail-section"><h3>Color <span class="color-name" id="colorName">${swatches[0].n}</span></h3><div class="color-options">${swatches.map((s, i) => `<div class="color-option ${i === 0 ? 'active' : ''}" title="${s.n}" style="background:${s.c}" onclick="selectColor('${s.c}', this)"></div>`).join('')}</div></div>
            ` : ''}
            ${product.sizes && product.sizes.length > 0 ? `
                <div class="detail-section"><h3>Size / Option</h3><div class="size-options">${product.sizes.map((s, i) => `<button class="size-option ${i === 0 ? 'active' : ''}" onclick="selectSize('${s}', this)">${s}</button>`).join('')}</div></div>
            ` : ''}
            <div class="detail-section"><h3>Quantity</h3><div class="qty-selector"><button class="qty-btn" onclick="updateDetailQty(-1)"><i class="fas fa-minus"></i></button><span class="qty-value" id="detailQty">1</span><button class="qty-btn" onclick="updateDetailQty(1)"><i class="fas fa-plus"></i></button></div></div>
            <div class="detail-section"><h3>Description</h3><p>${product.description}</p></div>
            <div class="detail-section"><h3>Customer Reviews</h3><div id="productReviews"></div></div>
            <div class="detail-section"><h3>You may also like</h3><div class="related-scroll" id="relatedProducts"></div></div>
        </div>
        <div class="sticky-action">
            <button class="neu-btn neu-btn-secondary" onclick="addToCart(${product.id}, parseInt(document.getElementById('detailQty').textContent), AppState.selectedColor, AppState.selectedSize)"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
            <button class="neu-btn neu-btn-primary" onclick="buyNow(${product.id})">Buy Now</button>
        </div>`;

    paintGallery(0);
    loadProductReviews(product);
    const relatedContainer = document.getElementById('relatedProducts');
    if (relatedContainer) {
        const related = getRelatedProducts(product.id);
        relatedContainer.innerHTML = related.length > 0 ? related.map(p => createProductCard(p)).join('') : '<p class="text-muted">No related products.</p>';
    }
    updateWishlistButtons();
}

function selectColor(color, el) {
    AppState.selectedColor = color;
    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const p = AppState.selectedProduct;
    if (!p) return;
    AppState.gallery = galleryFor(p, color);
    paintGallery(0);
    const v = (p.variants || []).find(x => x.color.toLowerCase() === color.toLowerCase());
    const n = document.getElementById('colorName');
    if (n) n.textContent = v ? v.name : '';
}
function selectSize(size, el) { AppState.selectedSize = size; document.querySelectorAll('.size-option').forEach(s => s.classList.remove('active')); el.classList.add('active'); }

// ---------- Reviews (verified buyers only) ----------
function canReview(pid) {
    return !!(window.FB && FB.user && AppState.orders.some(o => o.paymentStatus === 'Paid' && o.status !== 'Cancelled' && (o.items || []).some(i => Number(i.id) === Number(pid))));
}
async function loadProductReviews(product) {
    const box = document.getElementById('productReviews');
    if (!box) return;
    if (!(window.FB && FB.enabled)) { box.innerHTML = '<p class="text-muted">Reviews appear here once the store is live.</p>'; return; }
    box.innerHTML = '<p class="text-muted">Loading reviews…</p>';
    let list = [];
    try { list = await FB.loadReviews(product.id); } catch (e) {}
    if (!document.getElementById('productReviews') || AppState.selectedProduct?.id !== product.id) return;
    const mine = FB.user && list.find(r => r.uid === FB.user.uid);
    let action;
    if (!FB.user) action = `<button class="neu-btn neu-btn-secondary" onclick="AppState.afterAuth='product';navigateTo('auth')"><i class="fas fa-user"></i> Sign in to review</button>`;
    else if (canReview(product.id)) action = `<button class="neu-btn neu-btn-primary" onclick="openReview(${product.id})"><i class="fas fa-star"></i> ${mine ? 'Edit your review' : 'Write a review'}</button>`;
    else action = `<p class="text-muted review-note"><i class="fas fa-shield-alt"></i> Only customers who bought this product can review it.</p>`;
    const avg = list.length ? (list.reduce((s, r) => s + r.rating, 0) / list.length) : 0;
    const dist = [5, 4, 3, 2, 1].map(n => list.filter(r => r.rating === n).length);
    const card = r => `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${esc(r.name).charAt(0).toUpperCase()}</div>
                <div class="review-meta"><div class="review-name">${esc(r.name)}</div><div class="review-date">${new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                <div class="stars">${renderStars(r.rating)}</div>
            </div>
            <p class="review-text">${esc(r.text)}</p>
            <span class="verified"><i class="fas fa-check-circle"></i> Verified buyer</span>
        </div>`;
    box.innerHTML = `
        <div class="rv-summary">
            <div class="rv-score"><div class="review-avg">${list.length ? avg.toFixed(1) : '—'}</div><div class="stars">${renderStars(avg)}</div><div class="rv-count">${list.length ? list.length + ' verified review' + (list.length === 1 ? '' : 's') : 'No reviews yet'}</div></div>
            <div class="rv-bars">${dist.map((c, i) => `<div class="rv-row"><span>${5 - i}★</span><div class="rv-bar"><i style="width:${list.length ? Math.round(c / list.length * 100) : 0}%"></i></div><span>${c}</span></div>`).join('')}</div>
        </div>
        <div class="rv-action">${action}</div>
        ${list.length ? `<div class="rv-list" id="rvList">${list.map((r, i) => `<div class="${i >= 3 ? 'rv-extra' : ''}">${card(r)}</div>`).join('')}</div>
        ${list.length > 3 ? `<button class="rv-more" id="rvMore" onclick="toggleReviews()">See all ${list.length} reviews <i class="fas fa-chevron-down"></i></button>` : ''}`
        : '<div class="rv-empty"><i class="far fa-comment-dots"></i><p>Be the first to share your experience after you buy this product.</p></div>'}`;
}
function toggleReviews() {
    const l = document.getElementById('rvList'), b = document.getElementById('rvMore');
    if (!l || !b) return;
    const open = l.classList.toggle('show-all');
    b.innerHTML = open ? 'Show less <i class="fas fa-chevron-up"></i>' : `See all ${l.children.length} reviews <i class="fas fa-chevron-down"></i>`;
}
function openReview(pid) {
    const p = getProductById(pid); if (!p) return;
    AppState.revRating = 0;
    const modal = document.getElementById('reviewModal'), c = document.getElementById('reviewContent');
    c.innerHTML = `<div class="modal-header"><h2>Rate this product</h2><button class="modal-close" onclick="closeModal('reviewModal')"><i class="fas fa-times"></i></button></div>
        <p class="text-muted" style="margin-bottom:10px;">${p.name}</p>
        <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map(n => `<button type="button" onclick="setRevRating(${n})" aria-label="${n} stars"><i class="far fa-star"></i></button>`).join('')}</div>
        <textarea class="form-input" id="reviewText" rows="4" maxlength="500" placeholder="Tell others what you think (quality, delivery, value…)" style="margin-top:12px;"></textarea>
        <p id="reviewMsg" class="auth-msg"></p>
        <button class="neu-btn neu-btn-primary w-full" id="reviewSubmit" onclick="submitReviewForm(${pid})">Submit review</button>`;
    modal.classList.add('active');
}
function setRevRating(n) {
    AppState.revRating = n;
    document.querySelectorAll('#starPick i').forEach((i, k) => { i.className = (k < n ? 'fas' : 'far') + ' fa-star'; });
}
async function submitReviewForm(pid) {
    const text = document.getElementById('reviewText').value.trim(), msg = document.getElementById('reviewMsg'), btn = document.getElementById('reviewSubmit');
    if (!AppState.revRating) { msg.textContent = 'Please choose a star rating.'; return; }
    if (text.length < 3) { msg.textContent = 'Please write a short review.'; return; }
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
        await FB.submitReview(pid, AppState.revRating, text);
        closeModal('reviewModal'); showToast('Thank you! ⭐', 'Your review has been posted.', 'success');
        if (AppState.selectedProduct) loadProductReviews(AppState.selectedProduct);
    } catch (e) { msg.textContent = e && e.message ? e.message : 'Could not submit review.'; btn.disabled = false; btn.textContent = 'Submit review'; }
}

function updateDetailQty(delta) {
    const el = document.getElementById('detailQty');
    if (!el) return;
    let val = parseInt(el.textContent) + delta;
    if (val < 1) val = 1;
    if (AppState.selectedProduct && val > AppState.selectedProduct.stock) { val = AppState.selectedProduct.stock; showToast('Maximum Stock', `Only ${AppState.selectedProduct.stock} available.`, 'warning'); }
    el.textContent = val;
}

function buyNow(productId) {
    const qty = parseInt(document.getElementById('detailQty')?.textContent || 1);
    addToCart(productId, qty, AppState.selectedColor, AppState.selectedSize);
    navigateTo('checkout');
}

// Cart
function renderCart() {
    const container = document.getElementById('cartItems');
    const summaryContainer = document.getElementById('cartSummary');
    if (!container) return;
    if (AppState.cart.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div><h3>Your cart is empty</h3><p>Discover amazing products and start shopping.</p><button class="neu-btn neu-btn-primary" onclick="navigateTo('home')"><i class="fas fa-shopping-bag"></i> Start Shopping</button></div>`;
        if (summaryContainer) summaryContainer.classList.add('hidden');
        return;
    }
    if (summaryContainer) summaryContainer.classList.remove('hidden');
    container.innerHTML = AppState.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-img"><img src="${item.image}" alt="${item.name}"></div>
            <div class="cart-item-details">
                <div>
                    <div class="cart-item-name">${item.name}</div>
                    ${item.color ? `<div class="text-muted" style="font-size:0.7rem;margin-top:2px;">Color: <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};vertical-align:middle;border:1px solid var(--border);"></span></div>` : ''}
                    ${item.size ? `<div class="text-muted" style="font-size:0.7rem;">Size: ${item.size}</div>` : ''}
                </div>
                <div class="cart-item-actions">
                    <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="qty-selector"><button class="qty-btn" onclick="updateCartQty(${item.id}, '${item.color}', '${item.size}', -1)"><i class="fas fa-minus"></i></button><span class="qty-value">${item.qty}</span><button class="qty-btn" onclick="updateCartQty(${item.id}, '${item.color}', '${item.size}', 1)"><i class="fas fa-plus"></i></button></div>
                        <button class="cart-item-remove" onclick="removeFromCart(${item.id}, '${item.color}', '${item.size}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`).join('');

    const subtotal = getCartTotal();
    const delivery = subtotal > 50000 ? 0 : 2500;
    const discount = subtotal > 100000 ? Math.round(subtotal * 0.05) : 0;
    const total = subtotal + delivery - discount;
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
            <div class="summary-row"><span>Delivery Fee</span><span>${delivery === 0 ? 'FREE' : formatPrice(delivery)}</span></div>
            ${discount > 0 ? `<div class="summary-row"><span>Discount (5%)</span><span class="text-success">-${formatPrice(discount)}</span></div>` : ''}
            <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
            <button class="neu-btn neu-btn-primary w-full mt-3" onclick="navigateTo('checkout')"><i class="fas fa-credit-card"></i> Proceed to Checkout</button>`;
    }
}

// Wishlist
function renderWishlist() {
    const container = document.getElementById('wishlistItems');
    if (!container) return;
    const countText = document.getElementById('wishlistCountText');
    if (countText) countText.textContent = `${AppState.wishlist.length} item${AppState.wishlist.length !== 1 ? 's' : ''} saved`;
    if (AppState.wishlist.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-heart"></i></div><h3>Your wishlist is empty</h3><p>Save your favorite items and buy them later.</p><button class="neu-btn neu-btn-primary" onclick="navigateTo('home')"><i class="fas fa-shopping-bag"></i> Browse Products</button></div>`;
        return;
    }
    const wishlistProducts = AppState.wishlist.map(id => getProductById(id)).filter(Boolean);
    container.innerHTML = `<div class="products-grid">${wishlistProducts.map(p => createProductCard(p)).join('')}</div>`;
    updateWishlistButtons();
}

// Checkout
function renderCheckout() {
    const container = document.getElementById('checkoutContent');
    if (!container) return;
    if (AppState.cart.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div><h3>Your cart is empty</h3><p>Add items to your cart before checkout.</p><button class="neu-btn neu-btn-primary" onclick="navigateTo('home')">Continue Shopping</button></div>`;
        return;
    }
    const subtotal = getCartTotal();
    const sig = AppState.cart.map(i => i.id + ':' + i.qty + ':' + i.color + ':' + i.size).join('|');
    if (AppState._couponSig !== sig) { AppState.coupon = null; AppState._couponSig = sig; }
    const cp = AppState.coupon, couponDisc = cp ? cp.discount : 0;
    const delivery = ((cp && cp.freeShipping) || subtotal > 50000) ? 0 : 2500;
    const discount = subtotal > 100000 ? Math.round(subtotal * 0.05) : 0;
    const total = Math.max(100, subtotal + delivery - discount - couponDisc);

    container.innerHTML = `
        <div class="checkout-step">
            <h3><span class="step-number">1</span> Delivery Address</h3>
            <div class="form-group"><label class="form-label">Address type</label><select class="form-select" id="checkoutAddrType"><option ${(AppState.addresses[0]?.type||'Home')==='Home'?'selected':''}>Home</option><option ${AppState.addresses[0]?.type==='Office'?'selected':''}>Office</option><option ${AppState.addresses[0]?.type==='Other'?'selected':''}>Other</option></select></div>
            <div class="form-group"><label class="form-label">Full delivery address</label><textarea class="form-input" id="checkoutAddress" rows="2" maxlength="300" placeholder="House no., street, area, city, state">${esc(AppState.addresses[0]?.text||'')}</textarea></div>
        </div>
        <div class="checkout-step">
            <h3><span class="step-number">2</span> Contact Information</h3>
            <div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-input" value="${esc(AppState.user.name)}" id="checkoutName" maxlength="80"></div>
            <div class="form-group"><label class="form-label">Phone Number</label><input type="tel" class="form-input" value="${esc(AppState.user.phone)}" id="checkoutPhone" maxlength="20"></div>
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" value="${esc(AppState.user.email)}" id="checkoutEmail" maxlength="120"></div>
        </div>
        <div class="checkout-step">
            <h3><span class="step-number">3</span> Delivery Method</h3>
            <div class="payment-method active"><input type="radio" name="delivery" checked><div class="payment-icon"><i class="fas fa-truck"></i></div><div><div class="fw-semibold">Standard Delivery</div><div class="text-muted" style="font-size:0.75rem;">2-3 business days</div></div><span class="fw-bold" style="margin-left:auto;font-size:0.85rem;">${delivery === 0 ? 'FREE' : formatPrice(delivery)}</span></div>
            <div class="payment-method"><input type="radio" name="delivery"><div class="payment-icon"><i class="fas fa-shipping-fast"></i></div><div><div class="fw-semibold">Express Delivery</div><div class="text-muted" style="font-size:0.75rem;">Same day (Lagos only)</div></div><span class="fw-bold" style="margin-left:auto;font-size:0.85rem;">${formatPrice(5000)}</span></div>
        </div>
        <div class="checkout-step">
            <h3><span class="step-number">4</span> Order Summary</h3>
            ${AppState.cart.map(item => `<div class="summary-row"><span>${item.name} x${item.qty}</span><span>${formatPrice(item.price * item.qty)}</span></div>`).join('')}
            <div class="coupon-row"><input class="form-input" id="couponInput" placeholder="Coupon code" maxlength="20" autocomplete="off" value="${cp ? esc(cp.code) : ''}" ${cp ? 'readonly' : ''}><button class="neu-btn neu-btn-secondary" onclick="${cp ? 'removeCoupon()' : 'applyCoupon()'}">${cp ? 'Remove' : 'Apply'}</button></div>
            <p id="couponMsg" class="auth-msg ${cp ? 'ok' : ''}">${cp ? '✓ ' + esc(cp.label) : ''}</p>
            <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
            <div class="summary-row"><span>Delivery</span><span>${delivery === 0 ? 'FREE' : formatPrice(delivery)}</span></div>
            ${discount > 0 ? `<div class="summary-row"><span>Discount</span><span class="text-success">-${formatPrice(discount)}</span></div>` : ''}
            ${couponDisc > 0 ? `<div class="summary-row"><span>Coupon (${esc(cp.code)})</span><span class="text-success">-${formatPrice(couponDisc)}</span></div>` : ''}
            <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
        </div>
        <div class="checkout-step">
            <h3><span class="step-number">5</span> Payment Method</h3>
            <div class="payment-method ${AppState.selectedPayment === 'card' ? 'active' : ''}" onclick="selectPayment('card', this)"><input type="radio" name="payment" ${AppState.selectedPayment === 'card' ? 'checked' : ''}><div class="payment-icon"><i class="fas fa-credit-card"></i></div><div><div class="fw-semibold">Credit/Debit Card</div><div class="text-muted" style="font-size:0.75rem;">Secure checkout by Paystack</div></div></div>
            <div class="payment-method ${AppState.selectedPayment === 'transfer' ? 'active' : ''}" onclick="selectPayment('transfer', this)"><input type="radio" name="payment" ${AppState.selectedPayment === 'transfer' ? 'checked' : ''}><div class="payment-icon"><i class="fas fa-university"></i></div><div><div class="fw-semibold">Bank Transfer</div><div class="text-muted" style="font-size:0.75rem;">Instant bank transfer via Paystack</div></div></div>
            <div class="payment-method ${AppState.selectedPayment === 'cod' ? 'active' : ''}" onclick="selectPayment('cod', this)"><input type="radio" name="payment" ${AppState.selectedPayment === 'cod' ? 'checked' : ''}><div class="payment-icon"><i class="fas fa-money-bill-wave"></i></div><div><div class="fw-semibold">Cash on Delivery</div><div class="text-muted" style="font-size:0.75rem;">Pay when you receive</div></div></div>
        </div>
        <button class="neu-btn neu-btn-primary w-full" onclick="placeOrder()" style="margin-bottom:24px;"><i class="fas fa-lock"></i> Place Order - ${formatPrice(total)}</button>`;
}

function selectAddress(id) {
    AppState.selectedAddress = id;
    document.querySelectorAll('.address-card').forEach(card => {
        const type = card.querySelector('.address-type').textContent;
        card.classList.toggle('active', AppState.addresses.find(a => a.id === id)?.type === type);
    });
}

function selectPayment(method, el) {
    AppState.selectedPayment = method;
    document.querySelectorAll('.payment-method').forEach(pm => pm.classList.remove('active'));
    el.classList.add('active');
    el.querySelector('input').checked = true;
}

let _paying = false;
function setPayBtn(busy, text) {
    const b = document.querySelector('#checkoutContent .neu-btn-primary.w-full');
    if (!b) return;
    b.disabled = busy; b.style.opacity = busy ? '.7' : '';
    if (busy) { b.dataset.old = b.dataset.old || b.innerHTML; b.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text || 'Please wait…'}`; }
    else if (b.dataset.old) { b.innerHTML = b.dataset.old; delete b.dataset.old; }
}
async function placeOrder() {
    if (_paying) return;
    if (!window.FB || !FB.enabled) { showToast('Store offline', 'Online checkout is not set up yet.', 'error'); return; }
    if (!FB.user) { AppState.afterAuth = 'checkout'; showToast('Sign in required', 'Please sign in to complete your order.', 'warning'); navigateTo('auth'); return; }
    const name = document.getElementById('checkoutName')?.value?.trim();
    const phone = document.getElementById('checkoutPhone')?.value?.trim();
    const email = document.getElementById('checkoutEmail')?.value?.trim();
    const addrText = document.getElementById('checkoutAddress')?.value?.trim();
    const addrType = document.getElementById('checkoutAddrType')?.value || 'Home';
    if (!name || !phone || !email) { showToast('Missing Info', 'Please fill in all contact details.', 'error'); return; }
    if (!/^[+\d][\d\s\-()]{6,19}$/.test(phone)) { showToast('Invalid Phone', 'Please enter a valid phone number.', 'error'); return; }
    if (!addrText || addrText.length < 10) { showToast('Address needed', 'Enter your full delivery address.', 'error'); return; }
    _paying = true; setPayBtn(true, 'Preparing secure checkout…');
    try {
        const r = await FB.createOrder({
            items: AppState.cart.map(i => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })),
            name, phone, email, address: { type: addrType, text: addrText }, paymentMethod: AppState.selectedPayment,
            couponCode: AppState.coupon ? AppState.coupon.code : ''
        });
        AppState.user.name = name.split(' ')[0]; AppState.user.phone = phone; AppState.user.email = email; Storage.set('user', AppState.user);
        AppState.addresses = [{ id: 1, type: addrType, text: addrText }]; Storage.set('addresses', AppState.addresses);
        if (FB.updatePhone) FB.updatePhone(phone).catch(() => {});
        AppState.coupon = null;
        if (r.cod) { finishOrder(r.orderId, true); return; }
        if (typeof PaystackPop === 'undefined') throw new Error('Payment window could not load. Check your connection and try again.');
        let settled = false;
        const handler = PaystackPop.setup({
            key: window.SHOP_CONFIG.paystackPublicKey, email: r.email, amount: r.amountKobo, currency: 'NGN', ref: r.reference,
            channels: ['card', 'bank_transfer', 'bank', 'ussd'], metadata: { orderId: r.orderId },
            callback: function () { settled = true; confirmPayment(r.orderId); },
            onClose: function () { if (settled) return; _paying = false; setPayBtn(false); showToast('Payment cancelled', 'Your cart is saved — you can try again.', 'warning'); }
        });
        setPayBtn(true, 'Waiting for payment…');
        handler.openIframe();
    } catch (e) {
        _paying = false; setPayBtn(false);
        showToast('Could not place order', esc(e && e.message ? e.message : 'Please try again.'), 'error', 5000);
    }
}
async function confirmPayment(orderId) {
    setPayBtn(true, 'Confirming payment…');
    for (let i = 0; i < 5; i++) {
        try { const v = await FB.verifyPayment(orderId); if (v && v.paid) { finishOrder(orderId, false); return; } } catch (_) {}
        await new Promise(r => setTimeout(r, 2000));
    }
    AppState.cart = []; Storage.set('cart', AppState.cart); updateCartBadge();
    _paying = false; setPayBtn(false);
    showToast('Payment received', 'We are confirming it with Paystack — your order will update shortly.', 'warning', 6000);
    navigateTo('orders');
}
function finishOrder(orderId, cod) {
    AppState.cart = []; Storage.set('cart', AppState.cart); updateCartBadge();
    _paying = false;
    addNotification('Order Placed', `Your order ${orderId} has been ${cod ? 'placed (pay on delivery)' : 'paid and confirmed'}!`, 'order');
    showToast('Order Confirmed 🎉', `Order ${orderId} is ${cod ? 'placed' : 'paid'}. Thank you!`, 'success', 5000);
    navigateTo('orders');
}

// Orders
function renderOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    if (window.FB && FB.enabled && !FB.user) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-user-lock"></i></div><h3>Sign in to see your orders</h3><p>Your purchases are saved to your account.</p><button class="neu-btn neu-btn-primary" onclick="navigateTo('auth')"><i class="fas fa-sign-in-alt"></i> Sign In</button></div>`;
        return;
    }
    if (AppState.orders.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-box"></i></div><h3>No orders yet</h3><p>You haven't placed any orders yet. Start shopping!</p><button class="neu-btn neu-btn-primary" onclick="navigateTo('home')"><i class="fas fa-shopping-bag"></i> Start Shopping</button></div>`;
        return;
    }
    container.innerHTML = AppState.orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div><div class="order-id">${order.id}</div><div class="order-date">${new Date(order.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                <span class="badge ${order.status === 'Delivered' ? 'badge-success' : order.status === 'Processing' ? 'badge-warning' : 'badge-primary'}">${order.status}</span>
            </div>
            <div class="order-items">${order.items.slice(0, 3).map(item => `<img src="${item.image}" class="order-item-img" alt="${item.name}">`).join('')}${order.items.length > 3 ? `<div class="order-item-img" style="display:flex;align-items:center;justify-content:center;background:var(--border);"><span class="text-muted" style="font-size:0.7rem;font-weight:700;">+${order.items.length - 3}</span></div>` : ''}</div>
            <div class="order-footer">
                <div><div class="text-muted" style="font-size:0.75rem;">${order.items.length} item${order.items.length > 1 ? 's' : ''}</div><div class="order-total">${formatPrice(order.total)}</div></div>
                <div style="display:flex;gap:6px;">
                    <button class="neu-btn neu-btn-secondary" style="padding:8px 14px;font-size:0.75rem;" onclick="viewOrderDetails('${order.id}')"><i class="fas fa-eye"></i> Details</button>
                    ${order.status !== 'Delivered' ? `<button class="neu-btn neu-btn-primary" style="padding:8px 14px;font-size:0.75rem;" onclick="trackOrder('${order.id}')"><i class="fas fa-map-marker-alt"></i> Track</button>` : ''}
                </div>
            </div>
        </div>`).join('');
}

function viewOrderDetails(orderId) {
    const order = AppState.orders.find(o => o.id === orderId);
    if (!order) return;
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    if (!modal || !content) return;
    content.innerHTML = `
        <div class="modal-header"><h2>Order ${order.id}</h2><button class="modal-close" onclick="closeModal('orderDetailModal')"><i class="fas fa-times"></i></button></div>
        <div style="margin-bottom:14px;"><span class="badge ${order.status === 'Delivered' ? 'badge-success' : order.status === 'Processing' ? 'badge-warning' : 'badge-primary'}">${order.status}</span> <span class="badge ${order.paymentStatus === 'Paid' ? 'badge-success' : 'badge-danger'}">${order.paymentStatus}</span></div>
        <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:10px;">Items</h3>
        ${order.items.map(item => `<div class="cart-item" style="margin-bottom:8px;"><div class="cart-item-img"><img src="${item.image}" alt="${item.name}"></div><div class="cart-item-details"><div class="cart-item-name">${item.name}</div><div class="text-muted" style="font-size:0.75rem;">Qty: ${item.qty}</div><div class="cart-item-price">${formatPrice(item.price * item.qty)}</div></div></div>`).join('')}
        <div class="cart-summary" style="margin-top:14px;"><div class="summary-row total"><span>Total</span><span>${formatPrice(order.total)}</span></div></div>
        <div style="margin-top:14px;"><h3 style="font-size:0.9rem;font-weight:700;margin-bottom:6px;">Delivery Address</h3><p style="font-size:0.82rem;color:var(--text-secondary);">${order.address?.text || 'N/A'}</p></div>
        <div style="margin-top:14px;"><h3 style="font-size:0.9rem;font-weight:700;margin-bottom:6px;">Payment Method</h3><p style="font-size:0.82rem;color:var(--text-secondary);">${order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod === 'transfer' ? 'Bank Transfer' : 'Cash on Delivery'}</p></div>`;
    modal.classList.add('active');
}

function trackOrder(orderId) {
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    const order = AppState.orders.find(o => o.id === orderId);
    if (!modal || !content || !order) return;
    const steps = [['Order Placed', 'Your order has been confirmed'], ['Processing', 'Your order is being prepared'], ['Shipped', 'Your order is on the way'], ['Out for Delivery', 'Arriving today'], ['Delivered', 'Package handed to you']];
    const idx = { 'Processing': 1, 'Shipped': 2, 'Out for Delivery': 3, 'Delivered': 4 }[order.status] ?? 1;
    const cancelled = order.status === 'Cancelled';
    content.innerHTML = `
        <div class="modal-header"><h2>Track ${order.id}</h2><button class="modal-close" onclick="closeModal('orderDetailModal')"><i class="fas fa-times"></i></button></div>
        ${cancelled ? '<p class="text-muted" style="margin-bottom:12px;">This order was cancelled.</p>' : ''}
        <div class="track-timeline">${steps.map((s, i) => `<div class="track-step ${cancelled ? '' : i < idx ? 'completed' : i === idx ? 'active' : ''}"><div class="track-dot"></div><h4>${s[0]}</h4><p>${s[1]}</p></div>`).join('')}</div>`;
    modal.classList.add('active');
}

function closeModal(modalId) { document.getElementById(modalId)?.classList.remove('active'); }

// Profile
function renderProfile() {
    const u = window.FB && FB.user;
    const nm = (u && (u.displayName || u.email)) || 'Guest';
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');
    if (nameEl) nameEl.textContent = nm;
    if (emailEl) emailEl.textContent = u ? u.email : 'Sign in to save your orders';
    if (avatarEl) avatarEl.textContent = nm.charAt(0).toUpperCase();
    updatePushUI();
    const lbl = document.getElementById('authMenuLabel');
    if (lbl) lbl.textContent = u ? 'Logout' : 'Sign In / Create Account';
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.classList.toggle('active', AppState.theme === 'dark');
}

// Notifications
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    if (AppState.notifications.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-bell"></i></div><h3>No notifications</h3><p>We'll notify you about orders, deals, and updates.</p></div>`;
        return;
    }
    container.innerHTML = AppState.notifications.map(notif => `
        <div class="notif-item ${notif.read ? '' : 'unread'}" onclick="markNotificationRead(${notif.id})">
            <div class="notif-icon ${notif.type}"><i class="fas ${notif.type === 'cart' ? 'fa-shopping-cart' : notif.type === 'order' ? 'fa-box' : 'fa-tag'}"></i></div>
            <div class="notif-content"><h4>${notif.title}</h4><p>${notif.message}</p></div>
            <div class="notif-time">${new Date(notif.time).toLocaleDateString()}</div>
        </div>`).join('');
}

function markNotificationRead(id) {
    const notif = AppState.notifications.find(n => n.id === id);
    if (notif) { notif.read = true; Storage.set('notifications', AppState.notifications); renderNotifications(); }
}

// Promo Carousel
let promoSlide = 0;
function initPromoCarousel() {
    const slides = document.getElementById('promoSlides');
    if (!slides) return;
    setInterval(() => {
        promoSlide = (promoSlide + 1) % Math.max(1, slides.children.length);
        slides.style.transform = `translateX(-${promoSlide * 100}%)`;
        document.querySelectorAll('.promo-dot').forEach((d, i) => d.classList.toggle('active', i === promoSlide));
    }, 4000);
}

function goToPromo(index) {
    promoSlide = index;
    const slides = document.getElementById('promoSlides');
    if (slides) slides.style.transform = `translateX(-${promoSlide * 100}%)`;
    document.querySelectorAll('.promo-dot').forEach((d, i) => d.classList.toggle('active', i === promoSlide));
}

// Flash Countdown
let _flashWasLive = false;
function initFlashCountdown() {
    const hours = document.getElementById('flashHours'), minutes = document.getElementById('flashMinutes'), seconds = document.getElementById('flashSeconds');
    if (!hours || !minutes || !seconds) return;
    let demo = 4 * 3600 + 32 * 60 + 15;
    setInterval(() => {
        let left;
        if (window.FB && FB.enabled) {
            if (!AppState.flash) return;
            left = Math.max(0, Math.floor((AppState.flash.endsAt - Date.now()) / 1000));
            if (_flashWasLive && left === 0) { _flashWasLive = false; rebuildCatalog(); refreshView(); }
            if (left > 0) _flashWasLive = true;
        } else { demo = demo <= 0 ? 5 * 3600 : demo - 1; left = demo; }
        hours.textContent = String(Math.floor(left / 3600)).padStart(2, '0');
        minutes.textContent = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
        seconds.textContent = String(left % 60).padStart(2, '0');
    }, 1000);
}

// Logout
// ============================================
// Security helpers, catalogue sync, auth UI
// ============================================
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const SAFE_CAT = /^[A-Za-z0-9][A-Za-z0-9 \-]{1,29}$/;
let _rawCat = null;
function flashLive() { return !!(AppState.flash && AppState.flash.active && AppState.flash.endsAt > Date.now()); }
function normProduct(p) {
    const n = Number, base = Math.max(0, Math.round(n(p.price) || 0)), old0 = Math.round(n(p.oldPrice) || base), fp = Math.round(n(p.flashPrice) || 0);
    const flashOn = !!(p.isFlash && flashLive() && fp > 0 && fp < base);
    const price = flashOn ? fp : base, oldPrice = flashOn ? base : (old0 > base ? old0 : base);
    const image = safeUrl(p.image);
    const images = (Array.isArray(p.images) ? p.images : []).map(safeUrl).filter(Boolean);
    const variants = (Array.isArray(p.variants) ? p.variants : []).filter(v => v && /^#[0-9a-f]{6}$/i.test(v.color || ''))
        .map(v => ({ color: v.color.toLowerCase(), name: esc(v.name || ''), images: (v.images || []).map(safeUrl).filter(Boolean) }));
    return {
        id: Math.round(n(p.id)), name: esc(p.name), category: SAFE_CAT.test(p.category || '') ? p.category : 'Other', brand: esc(p.brand || ''),
        price, oldPrice, flashOn, rating: Math.min(5, Math.max(0, n(p.rating) || 0)), reviews: Math.max(0, Math.round(n(p.reviews) || 0)),
        image: image || images[0] || '', images: images.length ? images : (image ? [image] : []), variants,
        description: esc(p.description || ''), stock: Math.max(0, Math.round(n(p.stock) || 0)),
        colors: variants.length ? variants.map(v => v.color) : (p.colors || []).filter(c => /^#[0-9a-f]{3,8}$/i.test(c)),
        sizes: (p.sizes || []).filter(s => /^[A-Za-z0-9.\-\/ ]{1,12}$/.test(s)),
        tags: (p.tags || []).map(t => String(t).toLowerCase().replace(/[^a-z0-9 \-]/g, '')).filter(Boolean),
        isFlash: !!p.isFlash, isFeatured: !!p.isFeatured
    };
}
function rebuildCatalog() {
    if (!_rawCat) return;
    const data = _rawCat;
    const list = data.products.filter(p => p.active !== false && Number.isFinite(Number(p.id))).map(normProduct).filter(p => p.price > 0);
    products.length = 0; list.forEach(p => products.push(p));
    const fromDb = data.categories.filter(c => SAFE_CAT.test(c.name || '')).map(c => ({ id: c.name, name: c.name, icon: /^fa-[a-z0-9-]+$/.test(c.icon || '') ? c.icon : 'fa-tag' }));
    const names = new Set(fromDb.map(c => c.name));
    list.forEach(p => { if (!names.has(p.category)) { names.add(p.category); fromDb.push({ id: p.category, name: p.category, icon: 'fa-tag' }); } });
    categories.length = 0; categories.push({ id: 'all', name: 'All', icon: 'fa-th-large' }); fromDb.forEach(c => categories.push(c));
    AppState.cart = AppState.cart.filter(i => getProductById(i.id)).map(i => { const p = getProductById(i.id); return { ...i, name: p.name, price: p.price, image: variantImage(p, i.color), qty: Math.min(i.qty, Math.max(1, p.stock)) }; });
    AppState.wishlist = AppState.wishlist.filter(id => getProductById(id));
    Storage.set('cart', AppState.cart); Storage.set('wishlist', AppState.wishlist); updateCartBadge();
}
function applyCatalog(data) {
    _rawCat = data;
    AppState.flash = data.flash || null;
    rebuildCatalog();
    renderBanners(data.banners);
}
function renderBanners(list) {
    const box = document.getElementById('promoSlides');
    if (!box || !list || !list.length) return;
    const live = list.filter(b => b.active !== false && safeUrl(b.image)).sort((x, y) => (x.order || 0) - (y.order || 0)).slice(0, 8);
    if (!live.length) return;
    box.innerHTML = live.map(b => {
        const [t1, t2] = String(b.title || '').split('|');
        const title = t2 !== undefined ? `${esc(t1)}<br><span>${esc(t2)}</span>` : esc(t1);
        const cat = SAFE_CAT.test(b.category || '') ? b.category : 'all';
        return `<div class="promo-slide"><div class="promo-content"><div class="promo-label">${esc(b.label || '')}</div><div class="promo-title">${title}</div><div class="promo-subtitle">${esc(b.subtitle || '')}</div><button class="promo-btn" onclick="shopCategory('${cat}')">${esc(b.button || 'Shop Now')} <i class="fas fa-arrow-right"></i></button></div><div class="promo-image"><img class="promo-img" src="${safeUrl(b.image)}" alt="${esc(b.title || 'Promo').replace('|', ' ')}" decoding="async"></div></div>`;
    }).join('');
    const dots = document.querySelector('.promo-dots');
    if (dots) dots.innerHTML = live.map((_, i) => `<button class="promo-dot ${i === 0 ? 'active' : ''}" onclick="goToPromo(${i})"></button>`).join('');
    promoSlide = 0; box.style.transform = 'translateX(0)';
}

// ---------- Smarter search + related products ----------
function _near(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++d > 1) return false;
        if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
}
function scoreProduct(p, tokens) {
    const f = [[p.name, 5], [p.brand, 3], [p.category, 3], [(p.tags || []).join(' '), 3], [p.description, 1]].map(([t, w]) => [String(t || '').toLowerCase().replace(/&amp;|&#39;/g, ' '), w]);
    let total = 0, hit = 0;
    for (const tk of tokens) {
        let best = 0;
        for (const [text, w] of f) {
            if (!text) continue;
            const words = text.split(/\W+/);
            if (text.includes(tk)) best = Math.max(best, w * (words.includes(tk) ? 1.3 : 1));
            else if (tk.length >= 4 && words.some(x => _near(tk, x))) best = Math.max(best, w * 0.6);
        }
        if (best > 0) hit++;
        total += best;
    }
    return { total, hit };
}
function searchProducts(query) {
    const tokens = String(query || '').toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9\-]/g, '')).filter(Boolean);
    if (!tokens.length) return [];
    const scored = products.map(p => ({ p, ...scoreProduct(p, tokens) })).filter(x => x.total > 0);
    let strict = scored.filter(x => x.hit === tokens.length);
    if (!strict.length && tokens.length > 1) strict = scored;
    return strict.sort((a, b) => b.total - a.total).map(x => x.p);
}
function getRelatedProducts(productId, limit = 6) {
    const pr = getProductById(productId); if (!pr) return [];
    return products.filter(p => p.id !== productId).map(p => {
        let s = 0; if (p.category === pr.category) s += 5; if (p.brand && p.brand === pr.brand) s += 3;
        s += (p.tags || []).filter(t => (pr.tags || []).includes(t)).length * 2;
        s += Math.max(0, 2 - Math.abs(p.price - pr.price) / Math.max(1, pr.price) * 2);
        return { p, s };
    }).filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.p);
}
function getFlashProducts() {
    if (window.FB && FB.enabled) return flashLive() ? products.filter(p => p.flashOn) : [];
    return products.filter(p => p.isFlash);
}
function relatedBlock(results, query, exclude) {
    const ex = new Set((exclude || []).map(p => p.id));
    let list = [];
    if (results && results.length) {
        const seen = new Set(); results.slice(0, 3).forEach(r => getRelatedProducts(r.id, 6).forEach(p => { if (!ex.has(p.id) && !seen.has(p.id)) { seen.add(p.id); list.push(p); } }));
    } else {
        const toks = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
        list = products.map(p => ({ p, s: scoreProduct(p, toks).total })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.p);
        if (!list.length) list = products.filter(p => p.isFeatured).concat(products).filter((p, i, arr) => arr.findIndex(q => q.id === p.id) === i);
    }
    list = list.slice(0, 6);
    return list.length ? `<h3 class="related-title">${results && results.length ? 'You may also like' : 'Popular right now'}</h3><div class="products-grid">${list.map(p => createProductCard(p)).join('')}</div>` : '';
}
function hideSuggest() { document.querySelectorAll('.suggest-box').forEach(b => b.remove()); }
function liveSearch(input) {
    if (input.id === 'searchInput') { renderSearch(''); return; }
    hideSuggest();
    const q = input.value.trim();
    if (q.length < 2) return;
    const res = searchProducts(q).slice(0, 6);
    const host = input.closest('.search-section, .app-header'); if (!host) return;
    const box = document.createElement('div'); box.className = 'suggest-box';
    box.innerHTML = (res.length ? res.map(p => `<button class="suggest-item" onclick="hideSuggest();navigateTo('product',{id:${p.id}})"><img src="${p.image}" alt=""><span class="s-name">${p.name}<small>${p.category}</small></span><b>${formatPrice(p.price)}</b></button>`).join('') : '<div class="suggest-empty">No exact match — press search to see similar items</div>')
        + `<button class="suggest-all" onclick="hideSuggest();navigateTo('search',{query:document.getElementById('homeSearchInput').value})"><i class="fas fa-search"></i> See all results for "${esc(q)}"</button>`;
    host.appendChild(box);
}
document.addEventListener('click', e => { if (!e.target.closest('.suggest-box, #homeSearchInput')) hideSuggest(); });

function updateChatBadge(n) {
    AppState.chatUnread = n;
    const txt = n > 0 ? '+' + (n > 99 ? '99' : n) : '';
    const pb = document.getElementById('profileBadge');
    if (pb) { pb.textContent = txt; pb.style.display = n > 0 ? '' : 'none'; }
    document.querySelectorAll('.chat-dot').forEach(d => { d.textContent = txt; d.style.display = n > 0 ? '' : 'none'; });
}

// ---------- Support chat ----------
let chatUnsub = null, chatMetaUnsub = null, chatTag = '';
function renderChat(topic) {
    const box = document.getElementById('chatMessages'), form = document.getElementById('chatForm');
    if (!box) return;
    if (!(window.FB && FB.enabled)) { box.innerHTML = '<div class="empty-state"><h3>Chat unavailable</h3><p>Support chat is not connected yet.</p></div>'; form.style.display = 'none'; return; }
    if (!FB.user) { form.style.display = 'none'; box.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-headset"></i></div><h3>Chat with support</h3><p>Sign in to message our team or report an issue.</p><button class="neu-btn neu-btn-primary" onclick="AppState.afterAuth='chat';navigateTo('auth')">Sign In</button></div>`; return; }
    form.style.display = '';
    setChatTag(topic === 'issue' ? 'Order issue' : '');
    const sel = document.getElementById('chatOrder');
    if (sel) sel.innerHTML = '<option value="">Related order (optional)</option>' + AppState.orders.map(o => `<option value="${esc(o.id)}">${esc(o.id)}</option>`).join('');
    if (chatUnsub) chatUnsub();
    chatUnsub = FB.watchChat(list => {
        box.innerHTML = list.length ? list.map(m => `<div class="cmsg ${m.from === 'user' ? 'me' : ''}"><div>${esc(m.text).replace(/\n/g, '<br>')}</div><small>${m.type === 'issue' ? '⚠ Issue · ' : ''}${m.orderId ? esc(m.orderId) + ' · ' : ''}${m.from === 'admin' ? 'Support · ' : ''}${new Date(m.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')
            : '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments"></i></div><h3>How can we help?</h3><p>Send us a message or pick a topic below to report an issue.</p></div>';
        box.scrollTop = box.scrollHeight;
        if (list.length && list[list.length - 1].from === 'admin') FB.markChatRead();
    });
    FB.markChatRead();
}
function setChatTag(tag) {
    chatTag = tag;
    document.querySelectorAll('#chatTags button').forEach(b => b.classList.toggle('active', b.dataset.tag === tag));
    const o = document.getElementById('chatOrder'); if (o) o.style.display = tag ? '' : 'none';
}
async function sendChat() {
    const inp = document.getElementById('chatInput'), btn = document.getElementById('chatSend');
    let text = inp.value.trim(); if (!text) return;
    if (text.length > 900) { showToast('Too long', 'Please keep messages under 900 characters.', 'warning'); return; }
    const order = chatTag ? (document.getElementById('chatOrder')?.value || '') : '';
    if (chatTag) text = `[${chatTag}] ` + text;
    btn.disabled = true;
    try { await FB.sendChat(text, chatTag ? 'issue' : 'chat', order); inp.value = ''; setTimeout(() => maybeAskPush('chat'), 800); }
    catch (e) { showToast('Could not send', esc(e && e.message ? e.message : 'Try again.'), 'error'); }
    btn.disabled = false;
}

function refreshView() {
    const p = AppState.currentPage;
    if (p === 'home') renderHome(); else if (p === 'categories') renderCategories(); else if (p === 'wishlist') renderWishlist(); else if (p === 'cart') renderCart();
}
function updateGreeting() {
    const u = window.FB && FB.user;
    const el = document.getElementById('greetName');
    if (el) el.textContent = u && u.displayName ? u.displayName.split(' ')[0] : 'there';
}

// Auth UI
let authMode = 'in';
function setAuthMode(m) {
    authMode = m;
    document.getElementById('tabIn').classList.toggle('active', m === 'in');
    document.getElementById('tabUp').classList.toggle('active', m === 'up');
    document.getElementById('nameGroup').style.display = m === 'up' ? '' : 'none';
    document.getElementById('authSubmit').textContent = m === 'up' ? 'Create Account' : 'Sign In';
    document.getElementById('authPass').autocomplete = m === 'up' ? 'new-password' : 'current-password';
    document.getElementById('authMsg').textContent = '';
}
function authMsg(t, ok) { const el = document.getElementById('authMsg'); if (el) { el.textContent = t; el.className = 'auth-msg' + (ok ? ' ok' : ''); } }
async function submitAuth(ev) {
    ev.preventDefault();
    if (!window.FB || !FB.enabled) { authMsg('Accounts are not set up yet.'); return false; }
    const email = document.getElementById('authEmail').value.trim(), pass = document.getElementById('authPass').value, name = document.getElementById('authName').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authMsg('Enter a valid email address.'); return false; }
    if (pass.length < 8) { authMsg('Password must be at least 8 characters.'); return false; }
    if (authMode === 'up' && name.length < 2) { authMsg('Enter your full name.'); return false; }
    const btn = document.getElementById('authSubmit'); btn.disabled = true;
    try {
        if (authMode === 'up') { await FB.signUp(name, email, pass); showToast('Welcome! 🎉', 'Account created. Check your email to verify it.', 'success', 4500); }
        else await FB.signIn(email, pass);
        document.getElementById('authPass').value = '';
    } catch (e) { authMsg(FB.friendly(e)); }
    btn.disabled = false; return false;
}
async function googleAuth() { try { await FB.google(); } catch (e) { authMsg(FB.friendly(e)); } }
async function forgotPassword() {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) { authMsg('Enter your email above first.'); return; }
    try { await FB.reset(email); authMsg('Password reset link sent — check your email.', true); } catch (e) { authMsg(FB.friendly(e)); }
}
function authMenuClick() {
    if (window.FB && FB.user) {
        if (confirm('Are you sure you want to logout?')) { FB.signOut(); showToast('Logged Out', 'You have been logged out.', 'success'); navigateTo('home'); }
    } else navigateTo('auth');
}
function handleUser(u) {
    updateGreeting();
    if (u) {
        AppState.user.name = (u.displayName || '').split(' ')[0] || AppState.user.name; AppState.user.email = u.email || AppState.user.email;
        FB.watchMyOrders(list => {
            AppState.orders = list.map(o => ({ ...o, customerName: esc(o.customerName), address: { type: esc(o.address?.type), text: esc(o.address?.text) },
                items: (o.items || []).map(i => ({ ...i, name: esc(i.name), image: /^https:\/\//i.test(i.image || '') ? i.image.replace(/"/g, '%22') : '' })) }));
            if (AppState.currentPage === 'orders') renderOrders();
        });
        if (AppState.currentPage === 'auth') { const go = AppState.afterAuth || 'home'; AppState.afterAuth = null; navigateTo(go); }
        FB.syncPush && FB.syncPush('user'); setTimeout(maybeAskPush, 3000);
    } else { AppState.orders = []; if (AppState.currentPage === 'orders') renderOrders(); }
    if (chatMetaUnsub) { chatMetaUnsub(); chatMetaUnsub = null; }
    if (u) chatMetaUnsub = FB.watchChatMeta(m => updateChatBadge(m ? (typeof m.unreadCount === 'number' ? m.unreadCount : (m.unreadUser ? 1 : 0)) : 0));
    else updateChatBadge(0);
    if (AppState.currentPage === 'profile') renderProfile();
}

// Init
async function initApp() {
    initTheme();
    updateCartBadge();
    initPromoCarousel();
    initFlashCountdown();
    if (window.FB && FB.enabled) {
        await Promise.race([FB.ready, new Promise(r => setTimeout(r, 6000))]);
        try {
            applyCatalog(await FB.loadCatalog());
            FB.watchCatalog(d => { applyCatalog(d); refreshView(); });
        } catch (e) { console.warn('Catalogue unavailable', e); }
        FB.onUser(handleUser);
        FB.onPush = d => showToast(esc(d.title || 'ShopNG'), esc(d.body || ''), 'success', 6000);
    }
    const qs = new URLSearchParams(location.search), pid = Number(qs.get('p')), open = qs.get('open');
    if (pid && getProductById(pid)) navigateTo('product', { id: pid });
    else if (open === 'chat' || open === 'orders') navigateTo(open);
    else navigateTo('home');
    if (qs.has('p') || qs.has('open')) history.replaceState(null, '', location.pathname);
}

function updateFlashArrows() {
    const sc = document.getElementById('homeFlash'), tr = document.getElementById('flashTrack');
    if (!sc || !tr) return;
    tr.classList.toggle('at-start', sc.scrollLeft < 8);
    tr.classList.toggle('at-end', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 8);
    tr.classList.toggle('no-scroll', sc.scrollWidth <= sc.clientWidth + 8);
}
function slideFlash(dir) {
    const sc = document.getElementById('homeFlash');
    if (!sc) return;
    const card = sc.querySelector('.flash-card');
    const step = (card ? card.offsetWidth + 14 : 200) * 1.6;
    sc.scrollBy({ left: dir * step, behavior: 'smooth' });
}
function toggleCats() {
    const w = document.getElementById('catWrap'), b = document.getElementById('catFade');
    if (!w) return;
    const open = w.classList.toggle('expanded');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('homeCategories').scrollLeft = 0;
}

// ---------- Coupons ----------
function keepCheckoutForm() {
    const ids = ['checkoutAddress', 'checkoutAddrType', 'checkoutName', 'checkoutPhone', 'checkoutEmail'], v = {};
    ids.forEach(i => { const e = document.getElementById(i); if (e) v[i] = e.value; });
    renderCheckout();
    ids.forEach(i => { const e = document.getElementById(i); if (e && v[i] !== undefined) e.value = v[i]; });
}
async function applyCoupon() {
    const code = document.getElementById('couponInput').value.trim(), msg = document.getElementById('couponMsg');
    if (!code) { msg.className = 'auth-msg'; msg.textContent = 'Enter a coupon code.'; return; }
    if (!window.FB || !FB.enabled) { msg.className = 'auth-msg'; msg.textContent = 'Coupons are not available right now.'; return; }
    if (!FB.user) { msg.className = 'auth-msg'; msg.textContent = 'Please sign in to use a coupon.'; return; }
    msg.className = 'auth-msg ok'; msg.textContent = 'Checking coupon…';
    try {
        const r = await FB.validateCoupon(code, AppState.cart.map(i => ({ id: i.id, qty: i.qty, color: i.color, size: i.size })));
        AppState.coupon = { code: r.code, discount: r.discount, freeShipping: r.freeShipping, label: r.label };
        keepCheckoutForm();
        showToast('Coupon applied 🎉', esc(r.label), 'success');
    } catch (e) { msg.className = 'auth-msg'; msg.textContent = e && e.message ? e.message : 'Could not apply coupon.'; }
}
function removeCoupon() { AppState.coupon = null; keepCheckoutForm(); }

// ---------- Push notifications ----------
async function updatePushUI() {
    const lab = document.getElementById('pushLabel'), tg = document.getElementById('pushToggle');
    if (!lab || !(window.FB && FB.enabled)) { if (lab) lab.textContent = 'Unavailable'; return; }
    const st = await FB.pushStatus();
    lab.textContent = { on: 'On', off: 'Off', blocked: 'Blocked in browser', unsupported: 'Not supported here' }[st] || 'Off';
    if (tg) tg.classList.toggle('active', st === 'on');
}
async function togglePush() {
    if (!(window.FB && FB.enabled)) return;
    if (!FB.user) { AppState.afterAuth = 'profile'; showToast('Sign in first', 'Sign in to get notifications.', 'warning'); navigateTo('auth'); return; }
    const st = await FB.pushStatus();
    try {
        if (st === 'on') { await FB.disablePush('user'); showToast('Notifications off', 'You will no longer get alerts.', 'warning'); }
        else { await FB.enablePush('user'); showToast('Notifications on 🔔', 'You will hear about new products and order updates.', 'success'); }
    } catch (e) { showToast('Notifications', esc(e && e.message ? e.message : 'Could not enable.'), 'error', 5000); }
    updatePushUI();
}
async function maybeAskPush(reason) {
    if (!(window.FB && FB.enabled && FB.user)) return;
    const key = reason === 'chat' ? 'pushAskedChat' : 'pushAsked';
    if (localStorage.getItem(key) || document.querySelector('.push-banner')) return;
    if ((await FB.pushStatus()) !== 'off' || Notification.permission !== 'default') return;
    const b = document.createElement('div'); b.className = 'push-banner';
    b.innerHTML = reason === 'chat'
        ? '<div class="pb-icon"><i class="fas fa-comment-dots"></i></div><div class="pb-text"><b>Get support replies on your phone</b><span>We\'ll notify you like a normal message when support answers.</span></div><div class="pb-actions"><button class="pb-yes">Turn on</button><button class="pb-no">Later</button></div>'
        : '<div class="pb-icon"><i class="fas fa-bell"></i></div><div class="pb-text"><b>Never miss a deal</b><span>Get alerts for new products, order updates and support replies.</span></div><div class="pb-actions"><button class="pb-yes">Turn on</button><button class="pb-no">Later</button></div>';
    document.body.appendChild(b);
    const close = () => { localStorage.setItem(key, '1'); b.remove(); };
    b.querySelector('.pb-no').onclick = close;
    b.querySelector('.pb-yes').onclick = async () => { close(); await togglePush(); };
}
if (window.FB) FB.onPush = d => showToast(esc(d.title || 'ShopNG'), esc(d.body || ''), 'success', 6000);

function hideSplash() {
    const sp = document.getElementById('splash');
    if (!sp || sp.dataset.done) return;
    sp.dataset.done = '1';
    const wait = Math.max(0, 1600 - performance.now());
    setTimeout(() => { sp.classList.add('hide'); setTimeout(() => sp.remove(), 700); }, wait);
}
window.addEventListener('load', () => setTimeout(hideSplash, 6000));
document.addEventListener('DOMContentLoaded', () => { initApp().catch(() => {}).finally(hideSplash); });
