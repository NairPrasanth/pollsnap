// ============================================================
// PollSnap — Firebase Configuration
// ============================================================
//
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project", give it a name, click through the steps
// 3. In your project, click the "</>" (Web) icon to register a web app
// 4. Copy the firebaseConfig object shown and paste it below
// 5. In the Firebase console, go to Firestore Database → Create database
//    → Start in test mode → Choose a region → Done
//
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyC9ingkw1j5UR9BcstSvZtLafd3ihV70Kc",
  authDomain:        "pollsnap-app.firebaseapp.com",
  projectId:         "pollsnap-app",
  storageBucket:     "pollsnap-app.firebasestorage.app",
  messagingSenderId: "541217527682",
  appId:             "1:541217527682:web:f82c4e52e1cfc204cfa19b"
};

// ─── Init ────────────────────────────────────────────────────
let db = null;
let firebaseReady = false;

try {
  const isPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
  if (!isPlaceholder) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
    console.log("✅ Firebase connected");
  } else {
    console.warn("⚠️  Firebase not configured. Open js/firebase-config.js to add your credentials.");
  }
} catch (e) {
  console.error("Firebase init error:", e);
}
