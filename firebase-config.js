/* ShopNG configuration — fill these in (see SETUP.md). None of these values are secrets:
   the Firebase web config and the Paystack PUBLIC key are meant to be in the browser.
   NEVER put your Paystack SECRET key here — it lives only in Firebase Functions secrets. */
const _G = typeof window !== "undefined" ? window : self;
_G.SHOP_CONFIG = {
  firebase: {
  apiKey: "AIzaSyABUZjD-t71MRMeEdg-bV8DJcDBkbtK_AQ",
  authDomain: "shopng-3e645.firebaseapp.com",
  projectId: "shopng-3e645",
  storageBucket: "shopng-3e645.firebasestorage.app",
  messagingSenderId: "407335196136",
  appId: "1:407335196136:web:df62d1f2de93304c6f405d"
},
  vapidKey: "YOUR_WEB_PUSH_VAPID_KEY",   // Firebase console → Project settings → Cloud Messaging → Web Push certificates
  paystackPublicKey: "pk_test_12dc23595b033fcd963cdef7a632b7760f534b3e",
  functionsRegion: "us-central1",
  adminEmail: "shoplift.ng@gmail.com"   // only used to show/hide admin UI; real enforcement is in firestore.rules
};
_G.SHOP_CONFIG.enabled = !/YOUR_/.test(_G.SHOP_CONFIG.firebase.apiKey + _G.SHOP_CONFIG.firebase.projectId);
