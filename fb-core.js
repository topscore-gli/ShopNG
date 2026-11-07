// Shared Firebase initialisation (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";
export const CFG = window.SHOP_CONFIG;
export const enabled = !!CFG && CFG.enabled;
export let app = null, auth = null, db = null, storage = null, functions = null;
if (enabled) {
  app = initializeApp(CFG.firebase);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, CFG.functionsRegion || "us-central1");
}
