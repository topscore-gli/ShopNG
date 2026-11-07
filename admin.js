import { enabled, CFG, app, auth, db, storage, functions } from "./fb-core.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, orderBy, Timestamp, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const naira = n => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");
const STATUSES = ["Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
const S = { tab: "overview", products: [], categories: [], orders: [], users: [], banners: [], chats: [], coupons: [], flash: null, pq: "", pcat: "all", ofilter: "all", cq: "", unsubs: [], threadUnsub: null };
let F = null; // product form state
const toDate = v => v && v.toDate ? v.toDate() : (v ? new Date(v) : null);
const fmt = d => d ? d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const toast = (m, t = "ok") => { const e = document.createElement("div"); e.className = "toast " + t; e.textContent = m; $("#toasts").appendChild(e); setTimeout(() => e.remove(), 3800); };
const isAdminUser = u => u && u.emailVerified && u.email && u.email.toLowerCase() === String(CFG.adminEmail).toLowerCase();

/* ---------- gate ---------- */
function gate(html) { $("#app").hidden = true; $("#gate").hidden = false; $("#gate").innerHTML = `<div class="gate-box">${html}</div>`; }
function showSetup() { gate(`<h1>Setup needed</h1><p>Fill in <b>firebase-config.js</b> with your Firebase project settings, then reload. See SETUP.md.</p>`); }
function showLogin(err = "") {
  gate(`<h1><i class="fas fa-gem"></i> Admin sign in</h1><p>Authorised administrators only.</p>
  <label>Email</label><input id="lE" type="email" autocomplete="username"><label>Password</label><input id="lP" type="password" autocomplete="current-password">
  <p class="sm" style="color:var(--bad);min-height:18px;margin:10px 0">${esc(err)}</p>
  <button class="btn w" data-act="login">Sign in</button>
  <button class="btn ghost w" style="margin-top:10px" data-act="google"><i class="fab fa-google"></i> Continue with Google</button>
  <p class="sm mut" style="margin-top:14px;text-align:center"><a href="#" data-act="reset" style="color:var(--p2)">Forgot password?</a></p>`);
}
function showDenied(u) {
  gate(`<h1>No admin access</h1><p>${esc(u.email)} ${u.emailVerified ? "is not the admin account." : "is not verified yet. Check your inbox for the verification email, then sign in again."}</p>
  ${u.emailVerified ? "" : `<button class="btn w" data-act="resend">Resend verification email</button>`}
  <button class="btn ghost w" style="margin-top:10px" data-act="signout">Sign out</button>`);
}

/* ---------- data ---------- */
function startData() {
  stopData();
  const sub = (name, key, mapper) => S.unsubs.push(onSnapshot(collection(db, name), s => { S[key] = s.docs.map(d => mapper ? mapper(d) : d.data()); render(); }, e => toast("Cannot read " + name + ": " + e.code, "err")));
  sub("products", "products"); sub("categories", "categories");
  sub("orders", "orders", d => ({ ...d.data(), id: d.id }));
  sub("users", "users", d => ({ ...d.data(), uid: d.id }));
  sub("banners", "banners");
  sub("coupons", "coupons");
  sub("chats", "chats", d => ({ ...d.data(), uid: d.id }));
  S.unsubs.push(onSnapshot(doc(db, "settings", "flash"), s => { S.flash = s.exists() ? s.data() : null; render(); }, () => {}));
}
function stopData() { S.unsubs.forEach(f => f()); S.unsubs = []; }

/* ---------- views ---------- */
const orderStatusBadge = s => `<span class="badge ${s === "Delivered" ? "ok" : s === "Cancelled" ? "bad" : s === "Pending Payment" ? "warn" : ""}">${esc(s)}</span>`;
const payBadge = s => `<span class="badge ${s === "Paid" ? "ok" : s === "Unpaid" ? "warn" : ""}">${esc(s)}</span>`;
const realOrders = () => S.orders.filter(o => o.status !== "Pending Payment").sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));

function vOverview() {
  const paid = S.orders.filter(o => o.paymentStatus === "Paid");
  const rev = paid.reduce((a, o) => a + (o.total || 0), 0);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const sums = days.map(d => paid.filter(o => { const x = toDate(o.paidAt || o.createdAt); return x && x >= d && x < new Date(d.getTime() + 864e5); }).reduce((a, o) => a + o.total, 0));
  const max = Math.max(...sums, 1);
  const low = S.products.filter(p => Number(p.stock) <= 5);
  const recent = realOrders().slice(0, 5);
  return `<div class="grid g4"><div class="stat"><small>Revenue (paid)</small><b>${naira(rev)}</b></div><div class="stat"><small>Orders</small><b>${realOrders().length}</b></div><div class="stat"><small>Customers</small><b>${S.users.length}</b></div><div class="stat"><small>Products</small><b>${S.products.length}</b></div></div>
  <h2>Last 7 days</h2><div class="card bars">${sums.map((v, i) => `<div><i style="height:${Math.max(4, (v / max) * 80)}px" title="${naira(v)}"></i>${days[i].toLocaleDateString("en-NG", { weekday: "short" })}</div>`).join("")}</div>
  <h2>Low stock (${low.length})</h2>${low.length ? low.map(p => `<div class="row"><img src="${esc(p.image)}" alt=""><div class="info"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.category)}</div></div><span class="badge bad">${Number(p.stock)} left</span></div>`).join("") : `<div class="card empty">All products are well stocked.</div>`}
  <h2>Recent orders</h2>${recent.length ? recent.map(orderRow).join("") : `<div class="card empty">No orders yet.</div>`}`;
}
const orderRow = o => `<div class="row"><div class="info"><div class="t">${esc(o.id)} · ${esc(o.customerName)}</div><div class="s">${fmt(toDate(o.createdAt))}</div></div><div style="text-align:right"><div class="price">${naira(o.total)}</div>${payBadge(o.paymentStatus)} ${orderStatusBadge(o.status)}</div></div>`;

function vProducts() {
  const cats = S.categories.map(c => c.name);
  const list = S.products.filter(p => (S.pcat === "all" || p.category === S.pcat) && (!S.pq || (p.name + " " + p.brand).toLowerCase().includes(S.pq.toLowerCase()))).sort((a, b) => (b.createdAt?.seconds || b.id) - (a.createdAt?.seconds || a.id));
  return `<div class="bar"><input id="pq" placeholder="Search products…" value="${esc(S.pq)}" style="flex:1;min-width:160px"><button class="btn" data-act="addp"><i class="fas fa-plus"></i> Add product</button></div>
  <div class="chips"><button data-pcat="all" class="${S.pcat === "all" ? "on" : ""}">All (${S.products.length})</button>${cats.map(c => `<button data-pcat="${esc(c)}" class="${S.pcat === c ? "on" : ""}">${esc(c)} (${S.products.filter(p => p.category === c).length})</button>`).join("")}</div>
  ${S.products.length === 0 ? `<div class="card empty">No products yet.<br><br><button class="btn" data-act="addp">Add your first product</button> <button class="btn ghost" data-act="seed">Import sample data</button></div>` : ""}
  ${list.map(p => `<div class="row"><img src="${esc(p.image)}" alt=""><div class="info"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.category)} · ${esc(p.brand || "—")} · stock ${Number(p.stock)}${p.isFeatured ? " · ★ featured" : ""}${p.isFlash ? " · ⚡ flash" : ""}${p.active === false ? " · hidden" : ""}${(p.variants || []).length ? " · " + p.variants.length + " colours" : ""}</div><div class="price">${naira(p.price)}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn ghost sm" data-act="editp" data-id="${p.id}"><i class="fas fa-pen"></i></button><button class="btn bad sm" data-act="delp" data-id="${p.id}"><i class="fas fa-trash"></i></button></div></div>`).join("")}`;
}

function vOrders() {
  const all = S.ofilter === "abandoned" ? S.orders.filter(o => o.status === "Pending Payment") : realOrders().filter(o => S.ofilter === "all" || o.status === S.ofilter);
  const chips = ["all", ...STATUSES, "abandoned"];
  return `<div class="bar"><button class="btn ghost sm" data-act="csv"><i class="fas fa-file-csv"></i> Export CSV</button></div>
  <div class="chips">${chips.map(c => `<button data-of="${c}" class="${S.ofilter === c ? "on" : ""}">${c === "all" ? "All orders" : c === "abandoned" ? "Unpaid / abandoned" : c}</button>`).join("")}</div>
  ${all.length ? all.map(o => `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(o.id)}</b><div class="s mut sm">${fmt(toDate(o.createdAt))}</div></div><div style="text-align:right"><div class="price">${naira(o.total)}</div>${payBadge(o.paymentStatus)}</div></div>
    <div class="kv"><span>Customer</span><span>${esc(o.customerName)}</span></div><div class="kv"><span>Phone</span><span><a style="color:var(--p2)" href="tel:${esc(o.customerPhone)}">${esc(o.customerPhone)}</a></span></div><div class="kv"><span>Email</span><span>${esc(o.customerEmail)}</span></div>
    <div class="kv"><span>Address</span><span style="text-align:right">${esc(o.address?.text)}</span></div>${o.couponCode ? `<div class="kv"><span>Coupon</span><span>${esc(o.couponCode)} (−${naira(o.couponDiscount)})</span></div>` : ""}<div class="kv"><span>Payment</span><span>${esc(o.paymentMethod)}${o.paystackRef ? " · " + esc(o.paystackRef) : ""}</span></div>
    ${o.stockIssue ? `<div class="kv"><span style="color:var(--warn)">⚠ Stock</span><span>Paid but stock ran short — check inventory</span></div>` : ""}
    <div style="margin:10px 0">${(o.items || []).map(i => `<div class="kv"><span>${esc(i.name)} ×${Number(i.qty)}${i.size ? " · " + esc(i.size) : ""}</span><span>${naira(i.price * i.qty)}</span></div>`).join("")}</div>
    ${o.status === "Pending Payment" ? `<span class="badge warn">Waiting for payment</span>` : `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select data-ost="${esc(o.id)}" style="flex:1;min-width:150px">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select><button class="btn sm" data-act="setst" data-id="${esc(o.id)}">Update</button>${o.paymentMethod === "cod" && o.paymentStatus !== "Paid" ? `<button class="btn ghost sm" data-act="codpaid" data-id="${esc(o.id)}">Mark paid</button>` : ""}</div>`}
  </div>`).join("") : `<div class="card empty">No orders here.</div>`}`;
}

function custStats() {
  const m = new Map(S.users.map(u => [u.uid, { ...u, n: 0, spent: 0, last: null }]));
  S.orders.forEach(o => { const c = m.get(o.uid); if (!c || o.status === "Pending Payment") return; c.n++; if (o.paymentStatus === "Paid") c.spent += o.total || 0; const d = toDate(o.createdAt); if (d && (!c.last || d > c.last)) c.last = d; });
  return [...m.values()].sort((a, b) => b.spent - a.spent);
}
function vCustomers() {
  const list = custStats().filter(c => !S.cq || ((c.name || "") + (c.email || "") + (c.phone || "")).toLowerCase().includes(S.cq.toLowerCase()));
  return `<div class="bar"><input id="cq" placeholder="Search customers…" value="${esc(S.cq)}"></div>
  ${list.length ? list.map(c => `<div class="row" data-act="cust" data-id="${esc(c.uid)}" style="cursor:pointer"><div class="info"><div class="t">${esc(c.name || "Unnamed")}</div><div class="s">${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}</div><div class="s">Joined ${fmt(toDate(c.createdAt))}</div></div><div style="text-align:right"><div class="price">${naira(c.spent)}</div><div class="s mut">${c.n} order${c.n === 1 ? "" : "s"}</div></div></div>`).join("") : `<div class="card empty">No customers yet.</div>`}`;
}
function vCategories() {
  return `<div class="card"><h3 style="margin:0 0 6px">Add category</h3><div class="two"><div><label>Name</label><input id="cn" maxlength="30" placeholder="e.g. Gaming"></div><div><label>Icon (Font Awesome)</label><input id="ci" value="fa-tag" maxlength="30"></div></div><button class="btn w" style="margin-top:14px" data-act="addc">Add category</button></div>
  <h2>Categories</h2>${S.categories.length ? S.categories.map(c => `<div class="row"><div class="info"><div class="t"><i class="fas ${esc(c.icon)}"></i> ${esc(c.name)}</div><div class="s">${S.products.filter(p => p.category === c.name).length} products</div></div><button class="btn bad sm" data-act="delc" data-id="${esc(c.id)}"><i class="fas fa-trash"></i></button></div>`).join("") : `<div class="card empty">No categories yet. <button class="btn ghost sm" data-act="seed">Import defaults + sample products</button></div>`}`;
}

const toLocal = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 16); };
function vFlash() {
  const f = S.flash || {}, ends = f.endsAt ? toDate(f.endsAt) : null, live = f.active && ends && ends > new Date();
  const fl = S.products.filter(p => p.isFlash);
  return `<div class="card"><h3 style="margin:0 0 4px">Flash sale timer ${live ? '<span class="badge ok">LIVE</span>' : '<span class="badge warn">OFF</span>'}</h3><p class="mut sm" style="margin:0 0 6px">Customers see a countdown to the end time. When it ends, flash prices stop automatically and the section disappears.</p>
  <label>Title</label><input id="ft" maxlength="30" value="${esc(f.title || "Flash Sale")}">
  <label>Sale ends on</label><input id="fe" type="datetime-local" value="${ends ? toLocal(ends) : ""}">
  <div class="chips" style="margin:10px 0 0">${[["1", "+1 hour"], ["6", "+6 hours"], ["24", "+1 day"], ["72", "+3 days"], ["168", "+1 week"]].map(([h, t]) => `<button data-act="fplus" data-h="${h}">${t}</button>`).join("")}</div>
  <label>Status</label><select id="fa"><option value="1" ${f.active ? "selected" : ""}>Running</option><option value="0" ${!f.active ? "selected" : ""}>Stopped</option></select>
  <button class="btn w" style="margin-top:14px" data-act="savef">Save flash sale</button></div>
  <h2>Products in the flash sale (${fl.length})</h2>${fl.length ? fl.map(p => `<div class="row"><img src="${esc(p.image)}" alt=""><div class="info"><div class="t">${esc(p.name)}</div><div class="s">Normal ${naira(p.price)}</div><div class="price">Flash ${naira(p.flashPrice)}</div></div><button class="btn ghost sm" data-act="editp" data-id="${p.id}"><i class="fas fa-pen"></i></button></div>`).join("") : `<div class="card empty">No products yet. Edit a product and set <b>In flash sale = Yes</b> with a flash price.</div>`}`;
}
function vBanners() {
  const list = [...S.banners].sort((a, b) => (a.order || 0) - (b.order || 0));
  return `<div class="bar"><button class="btn" data-act="addb"><i class="fas fa-plus"></i> Add banner</button></div><p class="mut sm">Homepage hero banners. Each button opens the category you choose. Use transparent PNG images for the cleanest look.</p>
  ${list.length ? list.map(b => `<div class="row"><img src="${esc(b.image)}" alt="" style="object-fit:contain;background:rgba(255,255,255,.12)"><div class="info"><div class="t">${esc((b.title || "").replace("|", " "))}</div><div class="s">${esc(b.button)} → ${esc(b.category || "All")} · ${b.active === false ? "hidden" : "live"}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn ghost sm" data-act="editb" data-id="${b.id}"><i class="fas fa-pen"></i></button><button class="btn bad sm" data-act="delb" data-id="${b.id}"><i class="fas fa-trash"></i></button></div></div>`).join("") : `<div class="card empty">No custom banners — the shop shows its 3 built-in banners. Add yours to replace them.</div>`}`;
}
function bannerForm(b) {
  b = b || {}; F = { img: { url: b.image || "", file: null, preview: "" } };
  const cats = ["All", ...S.categories.map(c => c.name)];
  openSheet(`<h3>${b.id ? "Edit banner" : "Add banner"}</h3><label>Banner image</label><div class="slots"><div class="slot big"><label class="sp" style="background-image:url('${esc(b.image || "")}');background-size:contain"><input type="file" accept="image/png,image/jpeg,image/webp" data-slot="b" hidden>${b.image ? "" : "<span>＋</span>"}</label></div></div>
  <div class="two"><div><label>Small label</label><input id="bl" maxlength="24" value="${esc(b.label || "")}" placeholder="NEW ARRIVALS"></div><div><label>Order (1,2,3…)</label><input id="bo" type="number" min="1" value="${b.order || S.banners.length + 1}"></div></div>
  <label>Title — put | before the highlighted part</label><input id="bt" maxlength="40" value="${esc(b.title || "")}" placeholder="Latest|Phones">
  <label>Subtitle</label><input id="bs" maxlength="70" value="${esc(b.subtitle || "")}" placeholder="iPhones, AirPods &amp; watches.">
  <div class="two"><div><label>Button text</label><input id="bb" maxlength="20" value="${esc(b.button || "Shop Now")}"></div><div><label>Button opens category</label><select id="bc">${cats.map(c => `<option ${c === (b.category || "All") ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div></div>
  <label>Visibility</label><select id="ba"><option value="1">Live</option><option value="0" ${b.active === false ? "selected" : ""}>Hidden</option></select>
  <div style="display:flex;gap:10px;margin-top:18px"><button class="btn ghost" style="flex:1" data-act="close">Cancel</button><button class="btn" style="flex:2" id="saveB" data-act="saveb" data-id="${b.id || ""}">Save banner</button></div>`);
}
async function saveBanner(idStr) {
  const v = id => $("#" + id).value.trim();
  if (v("bt").length < 2) return toast("Enter a title", "err");
  const btn = $("#saveB"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const id = idStr ? Number(idStr) : Date.now();
    const image = await uploadSlot(F.img, id, "banner-");
    if (!/^https:\/\//i.test(image)) throw new Error("Add a banner image");
    await setDoc(doc(db, "banners", String(id)), { id, label: v("bl"), title: v("bt"), subtitle: v("bs"), button: v("bb") || "Shop Now", category: v("bc"), image, order: Number(v("bo")) || 1, active: v("ba") === "1" });
    toast("Banner saved ✔"); closeSheet();
  } catch (e) { toast(e.message || "Could not save", "err"); btn.disabled = false; btn.textContent = "Save banner"; }
}
const unreadCount = () => S.chats.filter(c => c.unreadAdmin).length;
function vSupport() {
  const list = [...S.chats].sort((a, b) => (toDate(b.lastAt) || 0) - (toDate(a.lastAt) || 0));
  return list.length ? list.map(c => `<div class="row" data-act="thread" data-id="${esc(c.uid)}" style="cursor:pointer"><div class="info"><div class="t">${c.unreadAdmin ? "● " : ""}${esc(c.name || "Customer")}</div><div class="s">${esc(c.email)}</div><div class="s">${esc(c.lastMessage)}</div></div><div style="text-align:right"><span class="badge ${c.topic === "issue" ? "bad" : ""}">${c.topic === "issue" ? "Issue" : "Chat"}</span><div class="s mut" style="margin-top:4px">${fmt(toDate(c.lastAt))}</div>${c.status === "resolved" ? '<span class="badge ok">Resolved</span>' : ""}</div></div>`).join("") : `<div class="card empty">No customer messages yet.</div>`;
}
function openThread(uid) {
  const c = S.chats.find(x => x.uid === uid); if (!c) return;
  openSheet(`<h3>${esc(c.name || "Customer")}</h3><p class="mut sm" style="margin:0 0 8px">${esc(c.email)}</p><div class="thread" id="thread"><div class="empty">Loading…</div></div>
  <div style="display:flex;gap:8px;margin-top:10px"><input id="rep" maxlength="1000" placeholder="Type a reply…" autocomplete="off"><button class="btn" data-act="reply" data-id="${esc(uid)}"><i class="fas fa-paper-plane"></i></button></div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost sm" data-act="resolve" data-id="${esc(uid)}">${c.status === "resolved" ? "Reopen" : "Mark resolved"}</button><button class="btn ghost sm" data-act="close">Close</button></div>`);
  setDoc(doc(db, "chats", uid), { unreadAdmin: false }, { merge: true }).catch(() => {});
  S.threadUnsub = onSnapshot(query(collection(db, "chats", uid, "messages"), orderBy("createdAt", "asc")), s => {
    const el = $("#thread"); if (!el) return;
    el.innerHTML = s.docs.map(d => { const m = d.data(); return `<div class="msg ${m.from === "admin" ? "me" : ""}"><div>${esc(m.text)}</div><small>${m.type === "issue" ? "⚠ Issue · " : ""}${m.orderId ? esc(m.orderId) + " · " : ""}${fmt(toDate(m.createdAt))}</small></div>`; }).join("") || '<div class="empty">No messages</div>';
    el.scrollTop = el.scrollHeight;
  });
}
async function sendReply(uid) {
  const el = $("#rep"), text = el.value.trim(); if (!text) return;
  el.value = "";
  try {
    const b = writeBatch(db);
    b.set(doc(db, "chats", uid), { unreadUser: true, unreadCount: increment(1), unreadAdmin: false, lastMessage: "You: " + text.slice(0, 110), lastAt: serverTimestamp(), status: "open" }, { merge: true });
    b.set(doc(collection(db, "chats", uid, "messages")), { from: "admin", text, type: "chat", createdAt: serverTimestamp() });
    await b.commit();
  } catch (e) { toast("Could not send: " + e.code, "err"); el.value = text; }
}

const couponUses = c => S.orders.filter(o => o.couponCode === c.code && o.status !== "Cancelled" && (o.paymentStatus === "Paid" || o.paymentStatus === "Pay on Delivery")).length;
function vCoupons() {
  const list = [...S.coupons].sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
  return `<div class="bar"><button class="btn" data-act="addcp"><i class="fas fa-plus"></i> New coupon</button></div>
  <p class="mut sm">Customers enter a code at checkout. Discounts are checked on the server, so codes can't be faked.</p>
  ${list.length ? list.map(c => { const ex = c.expiresAt ? toDate(c.expiresAt) : null, expired = ex && ex < new Date(), off = c.type === "percent" ? c.value + "% off" + (c.maxDiscount ? " (max " + naira(c.maxDiscount) + ")" : "") : c.type === "fixed" ? naira(c.value) + " off" : "Free delivery";
    return `<div class="row"><div class="info"><div class="t" style="font-family:monospace;font-size:1rem">${esc(c.code)}</div><div class="s">${esc(off)}${c.minOrder ? " · min " + naira(c.minOrder) : ""}</div><div class="s">Used ${couponUses(c)}${c.usageLimit ? " / " + c.usageLimit : ""} · ${c.perUser || 1} per customer${ex ? " · " + (expired ? "expired " : "ends ") + fmt(ex) : ""}</div>${c.description ? `<div class="s">${esc(c.description)}</div>` : ""}</div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="badge ${c.active === false || expired ? "bad" : "ok"}">${c.active === false ? "Off" : expired ? "Expired" : "Live"}</span><div style="display:flex;gap:6px"><button class="btn ghost sm" data-act="editcp" data-id="${esc(c.code)}"><i class="fas fa-pen"></i></button><button class="btn bad sm" data-act="delcp" data-id="${esc(c.code)}"><i class="fas fa-trash"></i></button></div></div></div>`; }).join("") : `<div class="card empty">No coupons yet. Create one to boost sales.</div>`}`;
}
function couponForm(c) {
  c = c || {}; const ex = c.expiresAt ? toLocal(toDate(c.expiresAt)) : "";
  openSheet(`<h3>${c.code ? "Edit coupon" : "New coupon"}</h3>
  <label>Code (letters, numbers, dash)</label><div style="display:flex;gap:8px"><input id="cc" maxlength="20" value="${esc(c.code || "")}" ${c.code ? "disabled" : ""} placeholder="WELCOME10" style="text-transform:uppercase"><button type="button" class="btn ghost sm" data-act="gencode" ${c.code ? "hidden" : ""}>Generate</button></div>
  <div class="two"><div><label>Type</label><select id="ct"><option value="percent" ${c.type === "percent" ? "selected" : ""}>Percent off</option><option value="fixed" ${c.type === "fixed" ? "selected" : ""}>Fixed amount (₦)</option><option value="shipping" ${c.type === "shipping" ? "selected" : ""}>Free delivery</option></select></div><div><label>Value (% or ₦)</label><input id="cv" type="number" min="0" inputmode="numeric" value="${c.value || ""}"></div></div>
  <div class="two"><div><label>Minimum order (₦)</label><input id="cm" type="number" min="0" inputmode="numeric" value="${c.minOrder || 0}"></div><div><label>Max discount (₦, for % codes)</label><input id="cx" type="number" min="0" inputmode="numeric" value="${c.maxDiscount || 0}"></div></div>
  <div class="two"><div><label>Total uses (0 = unlimited)</label><input id="cu" type="number" min="0" inputmode="numeric" value="${c.usageLimit || 0}"></div><div><label>Uses per customer</label><input id="cp" type="number" min="1" inputmode="numeric" value="${c.perUser || 1}"></div></div>
  <label>Expires (optional)</label><input id="ce" type="datetime-local" value="${ex}">
  <label>Note (only you see this)</label><input id="cd" maxlength="80" value="${esc(c.description || "")}">
  <label>Status</label><select id="ca"><option value="1">Live</option><option value="0" ${c.active === false ? "selected" : ""}>Switched off</option></select>
  <div style="display:flex;gap:10px;margin-top:18px"><button class="btn ghost" style="flex:1" data-act="close">Cancel</button><button class="btn" style="flex:2" id="saveC" data-act="savecp">Save coupon</button></div>`);
}
async function saveCoupon() {
  const v = id => $("#" + id).value.trim();
  const code = v("cc").toUpperCase().replace(/[^A-Z0-9\-]/g, ""), type = v("ct"), value = Math.round(Number(v("cv")) || 0);
  if (code.length < 3) return toast("Code must be 3–20 letters/numbers", "err");
  if (type === "percent" && !(value >= 1 && value <= 100)) return toast("Percent must be between 1 and 100", "err");
  if (type === "fixed" && !(value > 0)) return toast("Enter the amount off", "err");
  const ex = v("ce") ? new Date(v("ce")) : null;
  const prev = S.coupons.find(x => x.code === code) || {};
  const btn = $("#saveC"); btn.disabled = true;
  try {
    await setDoc(doc(db, "coupons", code), { code, type, value: type === "shipping" ? 0 : value, minOrder: Math.round(Number(v("cm")) || 0), maxDiscount: type === "percent" ? Math.round(Number(v("cx")) || 0) : 0,
      usageLimit: Math.round(Number(v("cu")) || 0), perUser: Math.max(1, Math.round(Number(v("cp")) || 1)), expiresAt: ex ? Timestamp.fromDate(ex) : null, description: v("cd"), active: v("ca") === "1", createdAt: prev.createdAt || serverTimestamp() });
    toast("Coupon saved ✔"); closeSheet();
  } catch (e) { toast("Failed: " + e.code, "err"); btn.disabled = false; }
}
/* ---- push alerts for the admin's phone/computer ---- */
const callF = n => httpsCallable(functions, n);
async function alertsStatus() { try { if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) return "unsupported"; } catch (_) { return "unsupported"; } return Notification.permission === "denied" ? "blocked" : (Notification.permission === "granted" && localStorage.getItem("push_admin") ? "on" : "off"); }
async function enableAlerts(silent) {
  const st = await alertsStatus();
  if (st === "unsupported") return silent || toast("This browser can't show notifications (on iPhone: Share → Add to Home Screen first).", "err");
  if (!CFG.vapidKey || /YOUR_/.test(CFG.vapidKey)) return silent || toast("Add your vapidKey in firebase-config.js first", "err");
  try {
    if (Notification.permission !== "granted") { if (silent) return; const p = await Notification.requestPermission(); if (p !== "granted") return toast("Notifications are blocked in your browser settings", "err"); }
    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js"); await navigator.serviceWorker.ready;
    const m = getMessaging(app), token = await getToken(m, { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
    await callF("registerPush")({ token, role: "admin" }); localStorage.setItem("push_admin", token);
    onMessage(m, p => { const d = p.data || {}; toast("🔔 " + (d.title || "") + " — " + (d.body || "")); });
    if (!silent) toast("Alerts are ON — you'll be notified of new orders, issues and messages 🔔");
    refreshBell();
  } catch (e) { if (!silent) toast(e.message || "Could not enable alerts", "err"); }
}
async function disableAlerts() { const t = localStorage.getItem("push_admin"); localStorage.removeItem("push_admin"); if (t) { try { await callF("unregisterPush")({ token: t, role: "admin" }); } catch (_) {} } }
async function refreshBell() { const b = $("#bell"); if (!b) return; const st = await alertsStatus(); b.className = "btn sm " + (st === "on" ? "" : "ghost"); b.innerHTML = st === "on" ? '<i class="fas fa-bell"></i> Alerts on' : '<i class="fas fa-bell-slash"></i> Enable alerts'; }

function render() {
  if ($("#app").hidden) return;
  const v = { overview: vOverview, products: vProducts, orders: vOrders, customers: vCustomers, categories: vCategories, flash: vFlash, banners: vBanners, coupons: vCoupons, support: vSupport }[S.tab]();
  const sb = $("#supBadge"); if (sb) { const n = unreadCount(); sb.textContent = n; sb.hidden = !n; }
  const act = document.activeElement, keep = act && act.id, pos = act && act.selectionStart;
  $("#view").innerHTML = v;
  if (keep && $("#" + keep)) { const el = $("#" + keep); el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} }
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
}

/* ---------- modal helpers ---------- */
const openSheet = html => { $("#sheet").innerHTML = html; $("#modal").hidden = false; };
const closeSheet = () => { if (S.threadUnsub) { S.threadUnsub(); S.threadUnsub = null; } $("#modal").hidden = true; $("#sheet").innerHTML = ""; };
const MAXG = 4, MAXV = 6, MAXVI = 3;
const slotOf = key => key[0] === "g" ? F.images[+key.slice(1)] : (([v, i]) => F.variants[v].images[i])(key.slice(1).split("-").map(Number));
const slotHtml = (s, key) => `<div class="slot"><label class="sp" style="background-image:url('${esc(s.preview || s.url || "")}')"><input type="file" accept="image/png,image/jpeg,image/webp" data-slot="${key}" hidden>${s.preview || s.url ? "" : "<span>＋</span>"}</label>${s.preview || s.url ? `<button type="button" class="x" data-act="rmslot" data-slot="${key}">×</button>` : ""}</div>`;
function variantsHtml() {
  return F.variants.map((v, vi) => `<div class="vblock"><div class="two"><div><label>Colour</label><input type="color" data-v="${vi}" data-f="color" value="${esc(v.color)}" style="height:46px;padding:4px"></div><div><label>Colour name</label><input data-v="${vi}" data-f="name" maxlength="20" value="${esc(v.name)}" placeholder="e.g. Midnight Black"></div></div>
  <label>Photos of this colour (up to ${MAXVI})</label><div class="slots">${v.images.map((s, si) => slotHtml(s, `v${vi}-${si}`)).join("")}</div><button type="button" class="btn bad sm" data-act="rmv" data-v="${vi}" style="margin-top:8px">Remove colour</button></div>`).join("");
}
const renderVariants = () => { $("#vbox").innerHTML = variantsHtml(); $("#addv").hidden = F.variants.length >= MAXV; };
function productForm(p) {
  p = p || {};
  const cats = S.categories.map(c => c.name);
  if (p.category && !cats.includes(p.category)) cats.push(p.category);
  const imgs = (p.images && p.images.length ? p.images : (p.image ? [p.image] : [])).slice(0, MAXG);
  F = { images: Array.from({ length: MAXG }, (_, i) => ({ url: imgs[i] || "", file: null, preview: "" })),
    variants: (p.variants || []).slice(0, MAXV).map(v => ({ color: v.color, name: v.name || "", images: Array.from({ length: MAXVI }, (_, i) => ({ url: (v.images || [])[i] || "", file: null, preview: "" })) })) };
  const ts = p.tags ? p.tags.join(", ") : "";
  openSheet(`<h3>${p.id ? "Edit product" : "Add product"}</h3><p class="mut sm" style="margin:0 0 8px">Fill in every detail. Photos upload to your store automatically.</p>
  <label>Main product photos (up to ${MAXG}, first one is the cover)</label><div class="slots">${F.images.map((s, i) => slotHtml(s, "g" + i)).join("")}</div>
  <label>Product name</label><input id="pn" maxlength="120" value="${esc(p.name || "")}">
  <div class="two"><div><label>Category</label><select id="pc">${cats.length ? cats.map(c => `<option ${c === p.category ? "selected" : ""}>${esc(c)}</option>`).join("") : "<option value=''>Create a category first</option>"}</select></div><div><label>Brand</label><input id="pb" maxlength="40" value="${esc(p.brand || "")}"></div></div>
  <div class="two"><div><label>Price (₦)</label><input id="pp" type="number" min="1" inputmode="numeric" value="${p.price || ""}"></div><div><label>Old price (₦, optional)</label><input id="po" type="number" min="0" inputmode="numeric" value="${p.oldPrice && p.oldPrice > p.price ? p.oldPrice : ""}"></div></div>
  <div class="two"><div><label>Stock quantity</label><input id="ps" type="number" min="0" inputmode="numeric" value="${p.stock ?? 10}"></div><div><label>Visibility</label><select id="pa"><option value="1">Visible in shop</option><option value="0" ${p.active === false ? "selected" : ""}>Hidden</option></select></div></div>
  <div class="two"><div><label>Featured on homepage</label><select id="pft"><option value="0">No</option><option value="1" ${p.isFeatured ? "selected" : ""}>Yes ★</option></select></div><div><label>In flash sale</label><select id="pfl"><option value="0">No</option><option value="1" ${p.isFlash ? "selected" : ""}>Yes ⚡</option></select></div></div>
  <label>Send push notification to customers?</label><select id="pnt"><option value="1" ${p.id ? "" : "selected"}>Yes — announce this product 🔔</option><option value="0" ${p.id ? "selected" : ""}>No</option></select>
  <label>Flash-sale price (₦) — used only while the flash sale is running</label><input id="pfp" type="number" min="0" inputmode="numeric" value="${p.flashPrice || ""}" placeholder="e.g. 45000">
  <label>Description</label><textarea id="pd" rows="3" maxlength="1000">${esc(p.description || "")}</textarea>
  <div class="two"><div><label>Sizes / options</label><input id="psz" value="${esc((p.sizes || []).join(", "))}" placeholder="S, M, L or 128GB, 256GB"></div><div><label>Search tags</label><input id="ptg" value="${esc(ts)}" placeholder="phone, apple, gift"></div></div>
  <label>Colour options — each colour can have its own photos</label><div id="vbox">${variantsHtml()}</div>
  <button type="button" class="btn ghost sm" id="addv" data-act="addv" ${F.variants.length >= MAXV ? "hidden" : ""} style="margin-top:6px">＋ Add a colour</button>
  <div style="display:flex;gap:10px;margin-top:18px"><button class="btn ghost" style="flex:1" data-act="close">Cancel</button><button class="btn" style="flex:2" id="saveP" data-act="savep" data-id="${p.id || ""}">Save product</button></div>`);
}
async function compress(file) {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(b => r(b), "image/webp", 0.92));
}
async function uploadSlot(s, id, folder) {
  if (!s.file) return s.url || "";
  if (s.file.size > 15 * 1024 * 1024) throw new Error("Image too large (max 15MB)");
  const blob = await compress(s.file);
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const r = ref(storage, `products/${folder}${id}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  await uploadBytes(r, blob, { contentType: blob.type });
  return await getDownloadURL(r);
}
async function saveProduct(idStr) {
  const v = id => $("#" + id).value.trim();
  const name = v("pn"), category = v("pc"), price = Math.round(Number(v("pp"))), old = Math.round(Number(v("po")) || 0), stock = Math.floor(Number(v("ps"))), fp = Math.round(Number(v("pfp")) || 0);
  if (name.length < 2) return toast("Enter a product name", "err");
  if (!category) return toast("Choose a category", "err");
  if (!(price > 0)) return toast("Enter a valid price", "err");
  if (old && old < price) return toast("Old price must be higher than the price", "err");
  if (!(stock >= 0)) return toast("Enter stock quantity", "err");
  if (v("pfl") === "1" && !(fp > 0 && fp < price)) return toast("Flash-sale price must be lower than the normal price", "err");
  const sizes = v("psz").split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9.\-\/ ]{1,12}$/.test(s));
  const tags = v("ptg").toLowerCase().split(",").map(s => s.trim().replace(/[^a-z0-9 \-]/g, "")).filter(Boolean).slice(0, 12);
  const btn = $("#saveP"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const id = idStr ? Number(idStr) : Date.now();
    btn.textContent = "Uploading photos…";
    const images = (await Promise.all(F.images.map(s => uploadSlot(s, id, "")))).filter(u => /^https:\/\//i.test(u));
    const variants = [];
    for (let i = 0; i < F.variants.length; i++) {
      const vr = F.variants[i];
      if (!/^#[0-9a-f]{6}$/i.test(vr.color)) continue;
      const vi = (await Promise.all(vr.images.map(s => uploadSlot(s, id, "c" + i + "-")))).filter(u => /^https:\/\//i.test(u));
      variants.push({ color: vr.color.toLowerCase(), name: (vr.name || "").trim().slice(0, 20), images: vi });
    }
    const cover = images[0] || (variants.find(x => x.images.length) || { images: [] }).images[0];
    if (!cover) throw new Error("Add at least one product photo");
    const prev = S.products.find(p => p.id === id) || {};
    await setDoc(doc(db, "products", String(id)), {
      id, name, category, brand: v("pb"), price, oldPrice: old || price, stock, image: cover, images: images.length ? images : [cover], variants,
      colors: variants.map(x => x.color), sizes, tags, description: v("pd"),
      isFeatured: v("pft") === "1", isFlash: v("pfl") === "1", flashPrice: fp, active: v("pa") === "1",
      notify: v("pnt") === "1" || !!prev.notify, notifyAt: v("pnt") === "1" ? serverTimestamp() : (prev.notifyAt || null),
      rating: prev.rating || 0, reviews: prev.reviews || 0, createdAt: prev.createdAt || serverTimestamp(), updatedAt: serverTimestamp()
    });
    toast("Product saved ✔"); closeSheet();
  } catch (e) { toast(e.message || "Could not save", "err"); btn.disabled = false; btn.textContent = "Save product"; }
}
async function deleteProduct(id) {
  const p = S.products.find(x => String(x.id) === String(id)); if (!p) return;
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  try { await deleteDoc(doc(db, "products", String(id))); if (/firebasestorage|appspot/.test(p.image || "")) { try { await deleteObject(ref(storage, p.image)); } catch (_) {} } toast("Deleted"); }
  catch (e) { toast("Delete failed: " + e.code, "err"); }
}
async function seed() {
  if (!confirm("Import default categories and sample products? Existing items with the same ID are overwritten.")) return;
  try {
    const cats = (typeof categories !== "undefined" ? categories : []).filter(c => c.id !== "all");
    const prods = typeof products !== "undefined" ? products : [];
    const ops = [...cats.map(c => [doc(db, "categories", c.id.toLowerCase()), { id: c.id.toLowerCase(), name: c.name, icon: c.icon }]), ...prods.map(p => [doc(db, "products", String(p.id)), { ...p, active: true, createdAt: serverTimestamp() }])];
    for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(([r, d]) => b.set(r, d)); await b.commit(); }
    toast("Sample data imported ✔");
  } catch (e) { toast("Import failed: " + e.code, "err"); }
}
function csv() {
  const q = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const rows = [["Order", "Date", "Customer", "Phone", "Email", "Total", "Payment", "Status", "Reference", "Items", "Address"]];
  realOrders().forEach(o => rows.push([o.id, fmt(toDate(o.createdAt)), o.customerName, o.customerPhone, o.customerEmail, o.total, o.paymentStatus, o.status, o.paystackRef || "", (o.items || []).map(i => `${i.name} x${i.qty}`).join("; "), o.address?.text]));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" })); a.download = "orders.csv"; a.click();
}

/* ---------- events ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act],[data-tab],[data-pcat],[data-of]"); if (!t) return;
  if (t.dataset.tab) { S.tab = t.dataset.tab; return render(); }
  if (t.dataset.pcat) { S.pcat = t.dataset.pcat; return render(); }
  if (t.dataset.of) { S.ofilter = t.dataset.of; return render(); }
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case "login": try { await signInWithEmailAndPassword(auth, $("#lE").value.trim(), $("#lP").value); } catch (_) { showLogin("Incorrect email or password."); } break;
    case "google": try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (_) { showLogin("Google sign-in was cancelled."); } break;
    case "reset": e.preventDefault(); { const m = $("#lE").value.trim(); if (!m) return showLogin("Enter your email first."); try { await sendPasswordResetEmail(auth, m); showLogin("Reset link sent — check your email."); } catch (_) { showLogin("Could not send reset email."); } } break;
    case "resend": try { await sendEmailVerification(auth.currentUser); toast("Verification email sent"); } catch (_) { toast("Try again later", "err"); } break;
    case "signout": stopData(); await disableAlerts(); await signOut(auth); break;
    case "addp": productForm(); break;
    case "addcp": couponForm(); break;
    case "editcp": couponForm(S.coupons.find(c => c.code === id)); break;
    case "savecp": saveCoupon(); break;
    case "gencode": $("#cc").value = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join(""); break;
    case "delcp": if (confirm("Delete coupon " + id + "?")) { try { await deleteDoc(doc(db, "coupons", id)); toast("Deleted"); } catch (x) { toast("Failed: " + x.code, "err"); } } break;
    case "alerts": enableAlerts(false); break;
    case "addv": F.variants.push({ color: "#111111", name: "", images: Array.from({ length: MAXVI }, () => ({ url: "", file: null, preview: "" })) }); renderVariants(); break;
    case "rmv": F.variants.splice(+t.dataset.v, 1); renderVariants(); break;
    case "rmslot": { const s = slotOf(t.dataset.slot); s.url = ""; s.file = null; s.preview = ""; if (t.dataset.slot[0] === "g") { $("#sheet .slots").outerHTML = `<div class="slots">${F.images.map((x, i) => slotHtml(x, "g" + i)).join("")}</div>`; } else renderVariants(); } break;
    case "fplus": { const d = new Date(Date.now() + Number(t.dataset.h) * 36e5); $("#fe").value = toLocal(d); $("#fa").value = "1"; } break;
    case "savef": { const e = $("#fe").value, d = e ? new Date(e) : null, on = $("#fa").value === "1";
      if (on && (!d || d <= new Date())) return toast("Pick an end time in the future", "err");
      try { await setDoc(doc(db, "settings", "flash"), { active: on, title: $("#ft").value.trim().slice(0, 30) || "Flash Sale", endsAt: d ? Timestamp.fromDate(d) : null }); toast("Flash sale saved ✔"); } catch (x) { toast("Failed: " + x.code, "err"); } } break;
    case "addb": bannerForm(); break;
    case "editb": bannerForm(S.banners.find(b => String(b.id) === id)); break;
    case "saveb": saveBanner(id); break;
    case "delb": if (confirm("Delete this banner?")) { try { await deleteDoc(doc(db, "banners", String(id))); toast("Deleted"); } catch (x) { toast("Failed: " + x.code, "err"); } } break;
    case "thread": openThread(id); break;
    case "reply": sendReply(id); break;
    case "resolve": { const c = S.chats.find(x => x.uid === id); try { await setDoc(doc(db, "chats", id), { status: c.status === "resolved" ? "open" : "resolved" }, { merge: true }); toast("Updated"); closeSheet(); } catch (x) { toast("Failed", "err"); } } break;
    case "editp": productForm(S.products.find(p => String(p.id) === id)); break;
    case "delp": deleteProduct(id); break;
    case "savep": saveProduct(id); break;
    case "close": closeSheet(); break;
    case "seed": seed(); break;
    case "csv": csv(); break;
    case "setst": { const s = document.querySelector(`[data-ost="${CSS.escape(id)}"]`).value; try { await updateDoc(doc(db, "orders", id), { status: s, updatedAt: serverTimestamp() }); toast("Order updated ✔"); } catch (x) { toast("Failed: " + x.code, "err"); } } break;
    case "codpaid": try { await updateDoc(doc(db, "orders", id), { paymentStatus: "Paid", updatedAt: serverTimestamp() }); toast("Marked as paid ✔"); } catch (x) { toast("Failed: " + x.code, "err"); } break;
    case "addc": {
      const name = $("#cn").value.trim(), icon = $("#ci").value.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9 \-]{1,29}$/.test(name)) return toast("Category name: letters, numbers, spaces and hyphens only (2–30 chars)", "err");
      if (!/^fa-[a-z0-9-]+$/.test(icon)) return toast("Icon must look like fa-tag", "err");
      const cid = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      try { await setDoc(doc(db, "categories", cid), { id: cid, name, icon }); $("#cn").value = ""; toast("Category added ✔"); } catch (x) { toast("Failed: " + x.code, "err"); }
    } break;
    case "delc": { const c = S.categories.find(x => x.id === id); if (c && S.products.some(p => p.category === c.name)) return toast("Move or delete its products first", "err"); if (confirm("Delete this category?")) await deleteDoc(doc(db, "categories", id)); } break;
    case "cust": { const c = custStats().find(x => x.uid === id); const os = realOrders().filter(o => o.uid === id);
      openSheet(`<h3>${esc(c.name || "Customer")}</h3><p class="mut sm">${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}</p><div class="kv"><span>Total spent</span><span class="price">${naira(c.spent)}</span></div><div class="kv"><span>Orders</span><span>${c.n}</span></div><div class="kv"><span>Last login</span><span>${fmt(toDate(c.lastLogin))}</span></div><h2>Purchases</h2>${os.length ? os.map(orderRow).join("") : `<div class="empty">No purchases yet.</div>`}<button class="btn ghost w" data-act="close" style="margin-top:12px">Close</button>`); } break;
  }
});
document.addEventListener("input", e => {
  const d = e.target.dataset;
  if (d && d.v !== undefined && F && F.variants) F.variants[+d.v][d.f] = e.target.value;
  if (e.target.id === "pq") { S.pq = e.target.value; render(); }
  if (e.target.id === "cq") { S.cq = e.target.value; render(); }
});
document.addEventListener("change", e => {
  const k = e.target.dataset && e.target.dataset.slot;
  if (k && e.target.files[0]) {
    const f = e.target.files[0], pv = URL.createObjectURL(f);
    if (k === "b") { F.img.file = f; F.img.preview = pv; const sp = e.target.closest(".sp"); sp.style.backgroundImage = `url('${pv}')`; sp.style.backgroundSize = "contain"; const s = sp.querySelector("span"); if (s) s.remove(); return; }
    const s = slotOf(k); s.file = f; s.preview = pv;
    if (k[0] === "g") $("#sheet .slots").outerHTML = `<div class="slots">${F.images.map((x, i) => slotHtml(x, "g" + i)).join("")}</div>`; else renderVariants();
  }
});
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeSheet(); });

/* ---------- boot ---------- */
if (!enabled) showSetup();
else onAuthStateChanged(auth, u => {
  if (!u) { stopData(); return showLogin(); }
  if (!isAdminUser(u)) { stopData(); return showDenied(u); }
  $("#gate").hidden = true; $("#app").hidden = false; $("#whoEmail").textContent = u.email;
  startData(); render(); refreshBell(); enableAlerts(true);
});
