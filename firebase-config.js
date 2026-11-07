/* ShopNG configuration — fill these in (see SETUP.md). None of these values are secrets:
   the Firebase web config and the Paystack PUBLIC key are meant to be in the browser.
   NEVER put your Paystack SECRET key here — it lives only in Firebase Functions secrets. */
const _G = typeof window !== "undefined" ? window : self;
_G.SHOP_CONFIG = {
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },
  vapidKey: "YOUR_WEB_PUSH_VAPID_KEY",   // Firebase console → Project settings → Cloud Messaging → Web Push certificates
  paystackPublicKey: "pk_test_YOUR_PAYSTACK_PUBLIC_KEY",
  functionsRegion: "us-central1",
  adminEmail: "YOUR_ADMIN_EMAIL@gmail.com"   // only used to show/hide admin UI; real enforcement is in firestore.rules
};
_G.SHOP_CONFIG.enabled = !/YOUR_/.test(_G.SHOP_CONFIG.firebase.apiKey + _G.SHOP_CONFIG.firebase.projectId);
