/**
 * ShopNG secure backend (Firebase Cloud Functions, 2nd gen).
 * - createOrder / validateCoupon: prices, stock, coupons and totals are computed HERE, never trusted from the browser.
 * - verifyPayment + paystackWebhook: payments are confirmed with Paystack's API (secret key) and the amount must match.
 * - submitReview: only customers with a PAID order for the product can review it.
 * - Push notifications (FCM): new products -> customers, orders & chats -> admin, replies/status -> customer.
 */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
const PAYSTACK_SECRET = defineSecret("PAYSTACK_SECRET");

// >>> KEEP IN SYNC: region = your Firestore location group; must equal functionsRegion in firebase-config.js
const REGION = "us-central1";
// >>> CHANGE to your admin email(s) (same as in firestore.rules). Must be a VERIFIED email.
const ADMIN_EMAILS = ["YOUR_ADMIN_EMAIL@gmail.com"];

const base = { region: REGION, maxInstances: 20 };
const FV = admin.firestore.FieldValue;
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
const isAdminToken = (t) => !!(t && t.email_verified === true && t.email && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(String(t.email).toLowerCase()));
const naira = (n) => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");

/* ---------------- pricing helpers ---------------- */
async function flashState() {
  const s = await db.collection("settings").doc("flash").get();
  const d = s.exists ? s.data() : null;
  const ends = d && d.endsAt && d.endsAt.toMillis ? d.endsAt.toMillis() : 0;
  return { active: !!(d && d.active && ends > Date.now()) };
}
function priceOf(p, flash) {
  const base = Math.round(Number(p.price));
  const fp = Math.round(Number(p.flashPrice) || 0);
  return (flash.active && p.isFlash && fp > 0 && fp < base) ? fp : base;
}
function imageFor(p, color) {
  const v = (p.variants || []).find(x => x && x.color && color && String(x.color).toLowerCase() === String(color).toLowerCase());
  return String((v && v.images && v.images[0]) || (p.images && p.images[0]) || p.image || "");
}
const feeFor = (subtotal) => ({
  delivery: subtotal > 50000 ? 0 : 2500,
  discount: subtotal > 100000 ? Math.round(subtotal * 0.05) : 0,
});

async function priceItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, 30) : [];
  if (!items.length) throw new HttpsError("invalid-argument", "Your cart is empty.");
  const wanted = new Map();
  for (const it of items) {
    const id = Number(it.id), qty = Math.floor(Number(it.qty));
    if (!Number.isSafeInteger(id) || id <= 0 || !(qty >= 1 && qty <= 20)) throw new HttpsError("invalid-argument", "Invalid cart item.");
    const key = id + "|" + clean(it.color, 12) + "|" + clean(it.size, 12);
    const cur = wanted.get(key) || { id, qty: 0, color: clean(it.color, 12) || null, size: clean(it.size, 12) || null };
    cur.qty += qty; wanted.set(key, cur);
  }
  const lines = [...wanted.values()];
  const refs = [...new Set(lines.map(l => l.id))].map(id => db.collection("products").doc(String(id)));
  const snaps = await db.getAll(...refs);
  const prod = new Map(); snaps.forEach(s => { if (s.exists) prod.set(Number(s.id), s.data()); });
  const flash = await flashState();
  let subtotal = 0; const out = [];
  for (const l of lines) {
    const p = prod.get(l.id);
    if (!p || p.active === false) throw new HttpsError("failed-precondition", "An item in your cart is no longer available.");
    const totalQty = lines.filter(x => x.id === l.id).reduce((a, x) => a + x.qty, 0);
    if (Number(p.stock) < totalQty) throw new HttpsError("failed-precondition", `Only ${Math.max(0, Number(p.stock))} left of ${p.name}.`);
    const price = priceOf(p, flash);
    if (!(price > 0)) throw new HttpsError("failed-precondition", "Invalid product price.");
    subtotal += price * l.qty;
    out.push({ id: l.id, name: String(p.name), price, image: imageFor(p, l.color), qty: l.qty, color: l.color, size: l.size });
  }
  return { out, subtotal };
}

/* ---------------- coupons ---------------- */
const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 20);
async function couponFor(codeRaw, uid, subtotal) {
  const code = cleanCode(codeRaw);
  if (code.length < 3) throw new HttpsError("invalid-argument", "Enter a valid coupon code.");
  const snap = await db.collection("coupons").doc(code).get();
  if (!snap.exists || snap.data().active === false) throw new HttpsError("failed-precondition", "This coupon code is not valid.");
  const c = snap.data();
  if (c.expiresAt && c.expiresAt.toMillis && c.expiresAt.toMillis() < Date.now()) throw new HttpsError("failed-precondition", "This coupon has expired.");
  if (Number(c.minOrder) > subtotal) throw new HttpsError("failed-precondition", `Spend at least ${naira(c.minOrder)} to use this coupon.`);
  // usage = real orders (paid, pay-on-delivery, or unpaid within the last 30 minutes) that used this code
  const used = await db.collection("orders").where("couponCode", "==", code).limit(3000).get();
  const live = used.docs.map(d => d.data()).filter(o => o.status !== "Cancelled" && (o.paymentStatus === "Paid" || o.paymentStatus === "Pay on Delivery" ||
    (o.paymentStatus === "Unpaid" && o.createdAt && o.createdAt.toMillis && Date.now() - o.createdAt.toMillis() < 30 * 60 * 1000)));
  if (Number(c.usageLimit) > 0 && live.length >= Number(c.usageLimit)) throw new HttpsError("failed-precondition", "This coupon has reached its usage limit.");
  const per = Number(c.perUser) > 0 ? Number(c.perUser) : 1;
  if (live.filter(o => o.uid === uid).length >= per) throw new HttpsError("failed-precondition", "You have already used this coupon.");
  let discount = 0, freeShipping = false, label = "";
  if (c.type === "percent") {
    discount = Math.round(subtotal * Math.min(100, Number(c.value)) / 100);
    if (Number(c.maxDiscount) > 0) discount = Math.min(discount, Number(c.maxDiscount));
    label = `${c.value}% off`;
  } else if (c.type === "fixed") { discount = Math.min(Math.round(Number(c.value)), subtotal); label = `${naira(c.value)} off`; }
  else if (c.type === "shipping") { freeShipping = true; label = "Free delivery"; }
  else throw new HttpsError("failed-precondition", "This coupon is not valid.");
  return { code, discount, freeShipping, label: `${code} · ${label}` };
}

exports.validateCoupon = onCall(base, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in to use a coupon.");
  const { subtotal } = await priceItems(req.data && req.data.items);
  const c = await couponFor(req.data && req.data.code, req.auth.uid, subtotal);
  return { valid: true, code: c.code, discount: c.discount, freeShipping: c.freeShipping, label: c.label };
});

/* ---------------- orders ---------------- */
exports.createOrder = onCall({ ...base, enforceAppCheck: false }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in to place an order.");
  const d = req.data || {};
  const method = ["card", "transfer", "cod"].includes(d.paymentMethod) ? d.paymentMethod : null;
  if (!method) throw new HttpsError("invalid-argument", "Invalid payment method.");
  const name = clean(d.name, 80), phone = clean(d.phone, 20), email = clean(d.email, 120);
  if (name.length < 2) throw new HttpsError("invalid-argument", "Enter your full name.");
  if (!/^[+\d][\d\s\-()]{6,19}$/.test(phone)) throw new HttpsError("invalid-argument", "Enter a valid phone number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email.");
  const address = { type: clean(d.address && d.address.type, 20) || "Home", text: clean(d.address && d.address.text, 300) };
  if (address.text.length < 5) throw new HttpsError("invalid-argument", "Choose a delivery address.");

  const { out, subtotal } = await priceItems(d.items);
  let { delivery, discount } = feeFor(subtotal);
  let couponCode = null, couponDiscount = 0;
  if (d.couponCode) {
    const c = await couponFor(d.couponCode, req.auth.uid, subtotal);
    couponCode = c.code; couponDiscount = c.discount; if (c.freeShipping) delivery = 0;
  }
  let total = subtotal + delivery - discount - couponDiscount;
  if (total < 100) { couponDiscount = Math.max(0, couponDiscount - (100 - total)); total = 100; }

  let orderId, ref;
  for (let i = 0; i < 5; i++) {
    orderId = "ORD-" + String(crypto.randomInt(10000000, 99999999));
    ref = db.collection("orders").doc(orderId);
    if (!(await ref.get()).exists) break;
  }
  const isCod = method === "cod";
  const reference = orderId + "-" + crypto.randomBytes(4).toString("hex");
  await ref.create({
    uid: req.auth.uid, items: out, subtotal, delivery, discount, couponCode, couponDiscount, total, amountKobo: total * 100,
    address, paymentMethod: method, customerName: name, customerPhone: phone, customerEmail: email,
    status: isCod ? "Processing" : "Pending Payment",
    paymentStatus: isCod ? "Pay on Delivery" : "Unpaid",
    paystackRef: isCod ? null : reference,
    createdAt: FV.serverTimestamp(),
  });
  if (isCod) await decrementStock(out);
  await db.collection("users").doc(req.auth.uid).set({ name, phone, lastOrderAt: FV.serverTimestamp() }, { merge: true });
  return { orderId, reference, amountKobo: total * 100, total, email, cod: isCod };
});

async function decrementStock(items) {
  const batch = db.batch();
  const agg = {}; items.forEach(i => { agg[i.id] = (agg[i.id] || 0) + i.qty; });
  Object.entries(agg).forEach(([id, q]) => batch.update(db.collection("products").doc(id), { stock: FV.increment(-q) }));
  await batch.commit().catch(() => {});
}

async function finalizePaid(orderId, tx) {
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) throw new HttpsError("not-found", "Order not found.");
    const o = s.data();
    if (o.paymentStatus === "Paid") return;
    const ids = [...new Set(o.items.map(i => i.id))];
    const psnaps = await Promise.all(ids.map(id => t.get(db.collection("products").doc(String(id)))));
    let stockIssue = false;
    psnaps.forEach(ps => {
      if (!ps.exists) return;
      const q = o.items.filter(i => String(i.id) === ps.id).reduce((a, i) => a + i.qty, 0);
      const left = Number(ps.data().stock) - q;
      if (left < 0) stockIssue = true;
      t.update(ps.ref, { stock: Math.max(0, left) });
    });
    t.update(ref, { paymentStatus: "Paid", status: "Processing", stockIssue, paidAt: FV.serverTimestamp(), paystackTransactionId: String(tx.id), paymentChannel: String(tx.channel || "") });
  });
}

async function paystackVerify(reference, secret) {
  const r = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), { headers: { Authorization: "Bearer " + secret } });
  const j = await r.json().catch(() => ({}));
  return j && j.status ? j.data : null;
}

exports.verifyPayment = onCall({ ...base, secrets: [PAYSTACK_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const orderId = clean(req.data && req.data.orderId, 30);
  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const o = snap.data();
  if (o.uid !== req.auth.uid) throw new HttpsError("permission-denied", "Not your order.");
  if (o.paymentStatus === "Paid") return { paid: true };
  const tx = await paystackVerify(o.paystackRef, PAYSTACK_SECRET.value());
  if (tx && tx.status === "success" && tx.amount === o.amountKobo && tx.currency === "NGN" && tx.reference === o.paystackRef) {
    await finalizePaid(orderId, tx);
    return { paid: true };
  }
  return { paid: false, message: tx && tx.gateway_response ? String(tx.gateway_response) : "Payment not confirmed yet." };
});

exports.paystackWebhook = onRequest({ ...base, secrets: [PAYSTACK_SECRET], cors: false }, async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("no");
    const sig = String(req.headers["x-paystack-signature"] || "");
    const mac = crypto.createHmac("sha512", PAYSTACK_SECRET.value()).update(req.rawBody).digest("hex");
    const a = Buffer.from(mac), b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).send("bad signature");
    const ev = req.body || {};
    if (ev.event === "charge.success" && ev.data && ev.data.reference) {
      const q = await db.collection("orders").where("paystackRef", "==", String(ev.data.reference)).limit(1).get();
      if (!q.empty) {
        const o = q.docs[0].data();
        const tx = await paystackVerify(ev.data.reference, PAYSTACK_SECRET.value());
        if (tx && tx.status === "success" && tx.amount === o.amountKobo && tx.currency === "NGN") await finalizePaid(q.docs[0].id, tx);
      }
    }
    return res.status(200).send("ok");
  } catch (e) { console.error(e); return res.status(500).send("error"); }
});

/* ---------------- reviews ---------------- */
exports.submitReview = onCall(base, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in to review.");
  const productId = Number(req.data && req.data.productId);
  const rating = Math.round(Number(req.data && req.data.rating));
  const text = clean(req.data && req.data.text, 500);
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new HttpsError("invalid-argument", "Invalid product.");
  if (!(rating >= 1 && rating <= 5)) throw new HttpsError("invalid-argument", "Choose a rating from 1 to 5 stars.");
  if (text.length < 3) throw new HttpsError("invalid-argument", "Please write a short review.");
  const orders = await db.collection("orders").where("uid", "==", req.auth.uid).get();
  const bought = orders.docs.some(d => { const o = d.data(); return o.paymentStatus === "Paid" && o.status !== "Cancelled" && (o.items || []).some(i => Number(i.id) === productId); });
  if (!bought) throw new HttpsError("permission-denied", "Only customers who bought this product can review it.");
  const user = await db.collection("users").doc(req.auth.uid).get();
  const name = clean((user.exists && user.data().name) || req.auth.token.name || "Customer", 40).split(" ")[0] || "Customer";
  await db.collection("reviews").doc(productId + "_" + req.auth.uid).set({ productId, uid: req.auth.uid, name, rating, text, createdAt: FV.serverTimestamp() });
  const all = await db.collection("reviews").where("productId", "==", productId).get();
  const n = all.size, avg = n ? all.docs.reduce((a, d) => a + d.data().rating, 0) / n : 0;
  await db.collection("products").doc(String(productId)).update({ rating: Math.round(avg * 10) / 10, reviews: n }).catch(() => {});
  return { ok: true, rating: Math.round(avg * 10) / 10, reviews: n };
});

/* ---------------- push notifications ---------------- */
const tokenId = (t) => crypto.createHash("sha256").update(t).digest("hex");
const dataOf = (p) => ({ title: String(p.title || "").slice(0, 100), body: String(p.body || "").slice(0, 200), image: String(p.image || ""), url: String(p.url || "./"), tag: String(p.tag || "shopng") });
const webpush = { headers: { Urgency: "high", TTL: "86400" } };

async function pushTopic(topic, payload) {
  try { await admin.messaging().send({ topic, data: dataOf(payload), webpush }); } catch (e) { console.error("topic push failed", e.message); }
}
async function pushUser(uid, payload) {
  try {
    const q = await db.collection("pushTokens").where("uid", "==", uid).get();
    const tokens = q.docs.map(d => d.data().token).filter(Boolean);
    if (!tokens.length) return;
    const r = await admin.messaging().sendEachForMulticast({ tokens, data: dataOf(payload), webpush });
    const dead = []; r.responses.forEach((x, i) => { if (!x.success && /registration-token-not-registered|invalid-registration-token/.test((x.error && x.error.code) || "")) dead.push(tokens[i]); });
    await Promise.all(dead.map(t => db.collection("pushTokens").doc(tokenId(t)).delete().catch(() => {})));
  } catch (e) { console.error("user push failed", e.message); }
}

exports.registerPush = onCall(base, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in to enable notifications.");
  const token = clean(req.data && req.data.token, 400), role = req.data && req.data.role === "admin" ? "admin" : "user";
  if (token.length < 50) throw new HttpsError("invalid-argument", "Invalid device token.");
  if (role === "admin" && !isAdminToken(req.auth.token)) throw new HttpsError("permission-denied", "Not an admin account.");
  await admin.messaging().subscribeToTopic(token, role === "admin" ? "admin" : "products");
  await db.collection("pushTokens").doc(tokenId(token)).set({ token, uid: req.auth.uid, roles: FV.arrayUnion(role), updatedAt: FV.serverTimestamp() }, { merge: true });
  return { ok: true };
});

exports.unregisterPush = onCall(base, async (req) => {
  if (!req.auth) return { ok: true };
  const token = clean(req.data && req.data.token, 400), role = req.data && req.data.role === "admin" ? "admin" : "user";
  if (token.length < 50) return { ok: true };
  try { await admin.messaging().unsubscribeFromTopic(token, role === "admin" ? "admin" : "products"); } catch (_) {}
  const ref = db.collection("pushTokens").doc(tokenId(token));
  const s = await ref.get();
  if (s.exists && s.data().uid === req.auth.uid) {
    const roles = (s.data().roles || []).filter(r => r !== role);
    if (roles.length) await ref.update({ roles }); else await ref.delete();
  }
  return { ok: true };
});

// New / re-announced product -> every subscribed customer
exports.onProductWrite = onDocumentWritten({ document: "products/{id}", region: REGION }, async (ev) => {
  const a = ev.data.after.exists ? ev.data.after.data() : null, b = ev.data.before.exists ? ev.data.before.data() : null;
  if (!a || a.notify !== true || a.active === false) return;
  const ms = (x) => (x && x.toMillis ? x.toMillis() : 0);
  if (b && ms(b.notifyAt) === ms(a.notifyAt)) return; // already announced
  await pushTopic("products", { title: "New arrival 🛍️", body: `${a.name} — ${naira(a.price)}`, image: a.image, url: "./?p=" + a.id, tag: "p" + a.id });
});

// Orders: admin gets new-order alerts, customers get status updates
exports.onOrderWrite = onDocumentWritten({ document: "orders/{id}", region: REGION }, async (ev) => {
  const id = ev.params.id;
  const a = ev.data.after.exists ? ev.data.after.data() : null, b = ev.data.before.exists ? ev.data.before.data() : null;
  if (!a) return;
  const first = (a.items && a.items[0]) || {};
  const nItems = (a.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const becamePaid = a.paymentStatus === "Paid" && (!b || b.paymentStatus !== "Paid");
  const newCod = !b && a.paymentMethod === "cod";
  if (becamePaid || newCod) {
    await pushTopic("admin", { title: `🛒 New order ${id}`, body: `${a.customerName} · ${naira(a.total)} · ${nItems} item${nItems === 1 ? "" : "s"}${newCod ? " · pay on delivery" : ""}`, image: first.image, url: "./admin.html", tag: "o" + id });
    if (becamePaid) await pushUser(a.uid, { title: "Payment confirmed ✅", body: `Order ${id} is confirmed. Total ${naira(a.total)}.`, image: first.image, url: "./?open=orders", tag: "o" + id });
  }
  if (b && a.status !== b.status && a.status !== "Pending Payment" && b.status !== "Pending Payment") {
    const msg = { Processing: "is being prepared", Shipped: "has been shipped 📦", "Out for Delivery": "is out for delivery 🚚", Delivered: "was delivered 🎉", Cancelled: "was cancelled" }[a.status];
    if (msg) await pushUser(a.uid, { title: `Order ${id}`, body: `Your order ${msg}`, image: first.image, url: "./?open=orders", tag: "o" + id });
  }
});

// Chat: customer message -> admin; admin reply -> that customer
exports.onChatMessage = onDocumentCreated({ document: "chats/{uid}/messages/{mid}", region: REGION }, async (ev) => {
  const m = ev.data.data(), uid = ev.params.uid;
  if (m.from === "user") {
    const chat = await db.collection("chats").doc(uid).get();
    const nm = (chat.exists && chat.data().name) || "Customer";
    await pushTopic("admin", { title: m.type === "issue" ? `⚠️ Issue reported by ${nm}` : `💬 Message from ${nm}`, body: m.text, url: "./admin.html", tag: "c" + uid });
  } else if (m.from === "admin") {
    await pushUser(uid, { title: "Support replied 💬", body: m.text, url: "./?open=chat", tag: "chat" });
  }
});
