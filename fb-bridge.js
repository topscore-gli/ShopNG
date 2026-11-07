// Bridges Firebase (module) to the classic app.js through window.FB
import { enabled, CFG, app, auth, db, functions } from "./fb-core.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, getDocs, setDoc, serverTimestamp, onSnapshot, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

const FB = { enabled, user: null, userListeners: [], unsubOrders: null };
window.FB = FB;
const iso = v => (v && v.toDate ? v.toDate().toISOString() : (typeof v === "string" ? v : new Date().toISOString()));
const friendly = e => {
  const c = (e && e.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "Incorrect email or password.";
  if (/email-already-in-use/.test(c)) return "An account with this email already exists.";
  if (/weak-password/.test(c)) return "Password must be at least 8 characters.";
  if (/invalid-email/.test(c)) return "Please enter a valid email address.";
  if (/too-many-requests/.test(c)) return "Too many attempts. Please wait a moment and try again.";
  if (/popup-closed|cancelled-popup/.test(c)) return "Sign-in was cancelled.";
  if (/network/.test(c)) return "Network error. Check your connection.";
  return (e && e.message && !/firebase/i.test(e.message)) ? e.message : "Something went wrong. Please try again.";
};
FB.friendly = friendly;

if (!enabled) {
  FB.ready = Promise.resolve();
} else {
  FB.ready = new Promise(res => {
    onAuthStateChanged(auth, u => {
      FB.user = u;
      FB.userListeners.forEach(f => f(u));
      res();
    });
  });
  FB.onUser = f => { FB.userListeners.push(f); if (FB.user !== null) f(FB.user); };
  FB.signUp = async (name, email, pass) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), { name, email, phone: "", createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
    try { await sendEmailVerification(cred.user); } catch (_) {}
    return cred.user;
  };
  FB.signIn = async (email, pass) => { const c = await signInWithEmailAndPassword(auth, email, pass); touch(c.user); return c.user; };
  FB.google = async () => { const c = await signInWithPopup(auth, new GoogleAuthProvider()); await ensureUser(c.user); return c.user; };
  FB.reset = email => sendPasswordResetEmail(auth, email);
  FB.signOut = async () => { try { await FB.disablePush("user"); } catch (_) {} if (FB.unsubOrders) { FB.unsubOrders(); FB.unsubOrders = null; } return signOut(auth); };
  async function ensureUser(u) {
    try { await setDoc(doc(db, "users", u.uid), { name: u.displayName || "", email: u.email || "", lastLogin: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true }); } catch (_) {}
  }
  function touch(u) { setDoc(doc(db, "users", u.uid), { lastLogin: serverTimestamp() }, { merge: true }).catch(() => {}); }
  FB.updatePhone = (phone) => FB.user ? setDoc(doc(db, "users", FB.user.uid), { phone }, { merge: true }) : null;

  FB.loadCatalog = async () => {
    const [p, c, bn, fl] = await Promise.all([getDocs(collection(db, "products")), getDocs(collection(db, "categories")), getDocs(collection(db, "banners")), getDocs(collection(db, "settings"))]);
    const f = fl.docs.find(d => d.id === "flash");
    return { products: p.docs.map(d => d.data()), categories: c.docs.map(d => d.data()), banners: bn.docs.map(d => d.data()), flash: f ? flashOf(f.data()) : null };
  };
  const flashOf = d => ({ active: !!d.active, title: d.title || "Flash Sale", endsAt: d.endsAt && d.endsAt.toMillis ? d.endsAt.toMillis() : 0 });
  FB.watchCatalog = cb => {
    let P = null, C = null, B = [], F = null;
    const fire = () => { if (P && C) cb({ products: P, categories: C, banners: B, flash: F }); };
    const subs = [
      onSnapshot(collection(db, "products"), s => { P = s.docs.map(d => d.data()); fire(); }, () => {}),
      onSnapshot(collection(db, "categories"), s => { C = s.docs.map(d => d.data()); fire(); }, () => {}),
      onSnapshot(collection(db, "banners"), s => { B = s.docs.map(d => d.data()); fire(); }, () => {}),
      onSnapshot(doc(db, "settings", "flash"), s => { F = s.exists() ? flashOf(s.data()) : null; fire(); }, () => {})
    ];
    return () => subs.forEach(u => u());
  };
  FB.loadReviews = async pid => {
    const s = await getDocs(query(collection(db, "reviews"), where("productId", "==", Number(pid))));
    return s.docs.map(d => { const r = d.data(); return { name: r.name, rating: r.rating, text: r.text, uid: r.uid, date: iso(r.createdAt) }; }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  FB.submitReview = async (productId, rating, text) => (await httpsCallable(functions, "submitReview")({ productId, rating, text })).data;

  // ---- support chat ----
  FB.watchChat = cb => {
    if (!FB.user) { cb([]); return () => {}; }
    return onSnapshot(query(collection(db, "chats", FB.user.uid, "messages"), orderBy("createdAt", "asc")), s =>
      cb(s.docs.map(d => { const m = d.data(); return { id: d.id, from: m.from, text: m.text, type: m.type, orderId: m.orderId, date: m.createdAt ? iso(m.createdAt) : new Date().toISOString() }; })), () => cb([]));
  };
  FB.watchChatMeta = cb => {
    if (!FB.user) { cb(null); return () => {}; }
    return onSnapshot(doc(db, "chats", FB.user.uid), s => cb(s.exists() ? s.data() : null), () => cb(null));
  };
  FB.sendChat = async (text, type, orderId) => {
    const u = FB.user; if (!u) throw new Error("Please sign in first.");
    const b = writeBatch(db);
    b.set(doc(db, "chats", u.uid), { uid: u.uid, name: u.displayName || "Customer", email: u.email || "", lastMessage: text.slice(0, 120), lastAt: serverTimestamp(), unreadAdmin: true, unreadUser: false, status: "open", topic: type === "issue" ? "issue" : "chat" }, { merge: true });
    const m = { from: "user", text, type: type === "issue" ? "issue" : "chat", createdAt: serverTimestamp() };
    if (orderId) m.orderId = String(orderId).slice(0, 30);
    b.set(doc(collection(db, "chats", u.uid, "messages")), m);
    await b.commit();
  };
  FB.markChatRead = () => FB.user ? setDoc(doc(db, "chats", FB.user.uid), { uid: FB.user.uid, unreadUser: false }, { merge: true }).catch(() => {}) : null;
  FB.watchMyOrders = cb => {
    if (FB.unsubOrders) FB.unsubOrders();
    if (!FB.user) { cb([]); return; }
    FB.unsubOrders = onSnapshot(query(collection(db, "orders"), where("uid", "==", FB.user.uid)), s => {
      const list = s.docs.map(d => { const o = d.data(); return { ...o, id: d.id, date: iso(o.createdAt), paidAt: o.paidAt ? iso(o.paidAt) : null }; })
        .filter(o => o.status !== "Pending Payment" || (Date.now() - new Date(o.date)) < 2 * 3600 * 1000)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      cb(list);
    }, () => cb([]));
  };
  const call = name => httpsCallable(functions, name);
  FB.createOrder = async payload => (await call("createOrder")(payload)).data;
  FB.verifyPayment = async orderId => (await call("verifyPayment")({ orderId })).data;

  // ---- coupons ----
  FB.validateCoupon = async (code, items) => (await call("validateCoupon")({ code, items })).data;

  // ---- push notifications (FCM web push) ----
  let _fgBound = false;
  FB.pushStatus = async () => {
    try { if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) return "unsupported"; } catch (_) { return "unsupported"; }
    if (Notification.permission === "denied") return "blocked";
    return Notification.permission === "granted" && localStorage.getItem("push_user") ? "on" : "off";
  };
  FB.enablePush = async (role = "user") => {
    if ((await FB.pushStatus()) === "unsupported") throw new Error("This browser can't show notifications. On iPhone, add the app to your Home Screen first.");
    if (!CFG.vapidKey || /YOUR_/.test(CFG.vapidKey)) throw new Error("Notifications are not configured yet.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error("Could not get a device token.");
    await call("registerPush")({ token, role });
    localStorage.setItem("push_" + role, token);
    if (!_fgBound) { _fgBound = true; onMessage(messaging, p => { if (FB.onPush) FB.onPush(p.data || {}); }); }
    return true;
  };
  FB.disablePush = async (role = "user") => {
    const token = localStorage.getItem("push_" + role);
    localStorage.removeItem("push_" + role);
    if (token) { try { await call("unregisterPush")({ token, role }); } catch (_) {} }
  };
  // re-link this device to the signed-in account (no prompt)
  FB.syncPush = async (role = "user") => {
    if (Notification.permission === "granted" && localStorage.getItem("push_" + role)) { try { await FB.enablePush(role); } catch (_) {} }
  };
}
