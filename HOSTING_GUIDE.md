# PollSnap — Step-by-Step Hosting Guide
## Deploy as a Free PWA in ~15 minutes

---

## Prerequisites
- A Google account (for Firebase)
- A GitHub account (free at github.com)
- Node.js installed (optional, only for GitHub CLI)

---

## STEP 1 — Set Up Firebase (Free Database)

### 1.1 Create a Firebase Project
1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Add project"**
3. Give it a name (e.g. `pollsnap-app`)
4. Disable Google Analytics (optional), click **"Create project"**

### 1.2 Register a Web App
1. In your project dashboard, click the **`</>`** (Web) icon
2. Enter an app nickname (e.g. `pollsnap`)
3. Click **"Register app"**
4. You'll see a `firebaseConfig` object — **copy it** (you'll need it in Step 2)
5. Click **"Continue to console"**

### 1.3 Create Firestore Database
1. In the left sidebar, click **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll secure it later)
4. Select a region closest to you (e.g. `us-east1`)
5. Click **"Done"**

### 1.4 Set Security Rules
1. In Firestore, click the **"Rules"** tab
2. Delete all content and paste the contents of `firestore.rules` from your project folder
3. Click **"Publish"**

---

## STEP 2 — Configure The App

Open `pollsnap/js/firebase-config.js` in any text editor and replace the placeholder values with your Firebase config:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← paste your values here
  authDomain:        "your-app.firebaseapp.com",
  projectId:         "your-app-id",
  storageBucket:     "your-app-id.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

Save the file.

---

## STEP 3 — Push to GitHub

### 3.1 Create a GitHub repository
1. Go to **[github.com/new](https://github.com/new)**
2. Repository name: `pollsnap` (or any name)
3. Keep it **Public** (required for free Cloudflare Pages)
4. Click **"Create repository"**

### 3.2 Upload your files
**Option A — GitHub Web (easiest, no Git needed):**
1. On your new repo page, click **"uploading an existing file"**
2. Drag and drop the entire `pollsnap` folder contents
3. Click **"Commit changes"**

**Option B — Git command line:**
```bash
cd C:\Users\nairr\.gemini\antigravity\scratch\pollsnap
git init
git add .
git commit -m "Initial PollSnap release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pollsnap.git
git push -u origin main
```

---

## STEP 4 — Deploy to Cloudflare Pages (Free, Unlimited Bandwidth)

1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** and sign up (free)
2. In the left sidebar, click **Workers & Pages**
3. Click **"Create application"** → **"Pages"** → **"Connect to Git"**
4. Click **"Connect GitHub"** and authorize Cloudflare
5. Select your `pollsnap` repository
6. Configure the build:
   - **Framework preset**: `None`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/` (root)
7. Click **"Save and Deploy"**

✅ In ~1 minute, your app will be live at:
**`https://pollsnap.pages.dev`** (or similar)

---

## STEP 5 — (Optional) Add a Custom Domain

### If you have a domain via Cloudflare:
1. In Pages → your project → **Custom domains**
2. Click **"Set up a custom domain"**
3. Enter your domain (e.g. `polls.yourdomain.com`)
4. Follow the DNS instructions

### If your domain is elsewhere (GoDaddy, Namecheap, etc.):
1. Add a **CNAME record** pointing to `pollsnap.pages.dev`
2. Then add it in Cloudflare Pages custom domains

---

## STEP 6 — Test Everything

1. Open your live URL in Chrome on mobile
2. Create a poll
3. Copy the **Participant URL** and open in a separate incognito window
4. Vote and verify results appear live in the Admin dashboard
5. On mobile Chrome: tap the **"Add to Home Screen"** prompt to install as an app

---

## Alternative: Deploy to Netlify

If you prefer Netlify over Cloudflare:

1. Go to **[app.netlify.com](https://app.netlify.com)**
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose GitHub and select your repo
4. Build settings: leave build command empty, publish directory = `/`
5. Click **"Deploy site"**

Your site will be live at `yoursite.netlify.app`

---

## Free Tier Limits Summary

| Service | Free Limit | What It Means |
|---|---|---|
| Firebase Firestore | 50K reads / 20K writes per **day** | Supports ~500-1000 active polls/day |
| Cloudflare Pages | **Unlimited** bandwidth | No traffic limits |
| Netlify | 100 GB bandwidth/month | Good for moderate traffic |

> **Tip:** One poll creation = 1 write. One vote = 1 write. Viewing results = 1 read per refresh. The free tier is very generous for a polling app.

---

## Updating the App

After making changes to the code:
```bash
git add .
git commit -m "Update: describe your changes"
git push
```
Cloudflare Pages / Netlify will auto-deploy within ~1 minute.

---

## Support & Troubleshooting

| Issue | Fix |
|---|---|
| "Firebase not configured" screen | Check `firebase-config.js` values |
| Poll not saving | Check Firestore rules are published |
| PWA not installing | Must be served over HTTPS (Cloudflare/Netlify both do this) |
| Vote not submitting | Check browser console for errors |
