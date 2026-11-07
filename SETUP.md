# ShopNG — Marketplace setup (about 20 minutes)

## 1. Create the Firebase project
1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started** → enable **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** (production mode).
4. **Build → Storage → Get started** (for product photos).
5. Upgrade to the **Blaze (pay-as-you-go)** plan — required for Cloud Functions + Storage. The free allowance is generous; a small store typically costs ₦0.
6. **Project settings → General → Your apps → Web app (</>)** → copy the config into `firebase-config.js`.
7. **Authentication → Settings → Authorized domains** → add your site domain (e.g. `coachflux.github.io`).

## 2. Make yourself admin
Open `firestore.rules` and `storage.rules` and replace `YOUR_ADMIN_EMAIL@gmail.com` with **your email**.
Also put it in `firebase-config.js` (`adminEmail`). Admin access = that email, **verified**. Sign in with Google (auto-verified) or verify the email link Firebase sends you.

## 3. Paystack
1. https://dashboard.paystack.com → Settings → **API Keys & Webhooks**.
2. Put the **Public key** (`pk_test_…` / `pk_live_…`) in `firebase-config.js`.
3. The **Secret key** never goes in the website. Store it in Firebase:
   ```
   npm i -g firebase-tools
   firebase login
   firebase use YOUR_PROJECT_ID
   firebase functions:secrets:set PAYSTACK_SECRET     # paste sk_test_… / sk_live_…
   ```
4. Deploy backend + rules:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only functions,firestore:rules,storage
   ```
5. In Paystack → Webhook URL set: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/paystackWebhook`

## 4. Publish the site
Upload every file in this folder (except `functions/`, rules and `.md` if you like) to GitHub Pages / any static host.

## 5. Open the admin dashboard
Go to `https://YOUR-SITE/admin.html`, sign in with your admin account, then:
**Products → "Import sample data"** (optional demo catalogue), or **Add product** to upload your own with photos, per category.
Admin is **not linked anywhere in the shop**; it only works for your verified admin email, enforced by Firestore rules.

## How security works
- Prices, stock, delivery fee and totals are computed **on the server** from Firestore — the browser cannot change what it pays.
- Payments are verified with Paystack's API (secret key, server-side) and by signed webhook; the paid amount must equal the order total.
- Customers can only read their own orders and edit their own profile. Only the admin can edit products/categories and update order status.
- Product text is HTML-escaped before display; a Content-Security-Policy limits which scripts/frames can load.
- Test with Paystack **test keys** + test card `4084 0840 8408 4081` before going live.

---
## What's in the admin dashboard
- **Products**: add/edit/delete with up to 4 photos, **colour options with their own photos** (customers tap a colour and the photos change), price, old price, stock, sizes/options, tags (for search), description, **Featured on homepage**, **Flash sale** + flash price, hide/show.
- **Flash Sale**: set the end date/time (or +1h/+6h/+1 day…). Customers see a live countdown; when it ends the flash prices and the section switch off automatically — prices are also enforced on the server.
- **Banners**: control the homepage hero banners (image, text, and which category the button opens).
- **Categories**, **Orders** (update status, export CSV), **Customers** (spend + purchases).
- **Support**: customer chats and issue reports — reply, mark resolved. An unread badge shows on the tab.

## Customer features
- Reviews & ratings: **only customers with a paid order for that product** can review (checked on the server).
- Support chat + "Report an issue" on the Profile page (real-time).
- Smarter search: typo-tolerant, matches names/brands/categories/tags, live suggestions, and related products.

## Re-deploy after updating
```
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,storage
```
(New in this version: `submitReview` function and rules for chats, reviews, settings, banners.)

---
## Final touch: push notifications, coupons, all devices

### Turn on push notifications (one-time, 5 minutes)
1. Firebase console → **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**. Copy the key into `vapidKey` in `firebase-config.js`.
2. Open `functions/index.js` and set **`ADMIN_EMAILS`** to your email (same one as in `firestore.rules`) and **`REGION`** to match your Firestore location.
3. Redeploy: `cd functions && npm install && cd .. && firebase deploy --only functions,firestore:rules,storage`
   (first deploy may ask to enable a few Google APIs — answer **yes**).
4. Upload the new files — especially **`firebase-messaging-sw.js`, `manifest.json` and the `images/` folder** — to the same folder as `index.html`.

**Who gets what**
| Who | Gets a notification when… |
|---|---|
| Customers (after tapping *Turn on* once) | you add or re-announce a product (shows product photo, name and price), their order is paid/shipped/delivered, support replies |
| You (admin) | a customer pays or places a pay-on-delivery order, reports an issue, or sends a message |

- **Admin**: open `admin.html` → tap **Enable alerts** on every phone/computer you want alerts on. They arrive even when the site is closed.
- **Adding products**: the product form has *Send push notification to customers* (on by default for new products). When editing a product, set it to **Yes** to announce it again (e.g. price drop).
- **iPhone/iPad**: Apple only allows web notifications when the site is added to the Home Screen (Share → *Add to Home Screen*). Android and computers work straight from the browser.
- Notifications need HTTPS (GitHub Pages is fine).

### Coupons
Admin → **Coupons**: create percent-off, fixed-amount or free-delivery codes with a minimum order, max discount, total uses, uses per customer and an expiry date. Customers enter the code at checkout; everything is validated and priced on the server.

### Works on every device
Phones, tablets, laptops and big monitors: the layout adapts (multi-column product grids, two-column product page on laptops, centered dialogs). The site can also be **installed like an app** (Add to Home Screen / Install) thanks to `manifest.json`.
