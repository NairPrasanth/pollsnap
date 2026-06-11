// ============================================================
// PollSnap — Firebase Configuration
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
let db      = null;
let storage = null;
let firebaseReady = false;

try {
  const isPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
  if (!isPlaceholder) {
    firebase.initializeApp(firebaseConfig);
    db      = firebase.firestore();
    storage = firebase.storage();
    firebaseReady = true;
    console.log("✅ Firebase connected (Firestore + Storage)");
  } else {
    console.warn("⚠️  Firebase not configured.");
  }
} catch (e) {
  console.error("Firebase init error:", e);
}
