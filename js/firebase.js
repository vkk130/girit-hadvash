/* =====================================================================
   חיבור ל-Firebase Firestore — קיר הסיפורים ולוח המובילים המשותפים.
   הקובץ נטען כמודול. אם הטעינה נכשלת, האתר ממשיך לעבוד במצב מקומי.
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp, doc, getDoc, setDoc, updateDoc, increment,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// הגדרות הפרויקט "Girit HaDvash Site". המפתח הזה גלוי בכוונה — ההגנה היא בכללי האבטחה (firestore.rules).
const firebaseConfig = {
  apiKey: "AIzaSyDEtDu3McKB9gK9b4fGU-Fvk7Bz_VP0uYo",
  authDomain: "girit-hadvash-site.firebaseapp.com",
  projectId: "girit-hadvash-site",
  storageBucket: "girit-hadvash-site.firebasestorage.app",
  messagingSenderId: "937965878009",
  appId: "1:937965878009:web:5f7abd47d5375adda9c028",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function toMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now();
}

window.GeritDB = {
  /** מאזין לפוסטים האחרונים. cb מקבל מערך פוסטים, מהחדש לישן. */
  subscribePosts(cb, onError, max = 60) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(max));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, ...data, date: toMillis(data.createdAt) };
      }));
    }, onError);
  },

  addPost({ name, where, what, mood, rating }) {
    return addDoc(collection(db, "posts"), { name, where, what, mood, rating, createdAt: serverTimestamp() });
  },

  /** מאזין לעשרת המובילים. */
  subscribeLeaderboard(cb, onError) {
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  },

  /** רושם שחקן חדש (או מעדכן את השם של שחקן קיים). */
  async registerPlayer(playerId, name, score) {
    const ref = doc(db, "leaderboard", playerId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { name, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { name, score, updatedAt: serverTimestamp() });
    }
  },

  /** מוסיף או מוריד נקודות (יחסית לניקוד בשרת, כך שהניקוד לא "נתקע" אם עדכון אחד נכשל). */
  addScore(playerId, delta) {
    return updateDoc(doc(db, "leaderboard", playerId), { score: increment(delta), updatedAt: serverTimestamp() });
  },
};

window.dispatchEvent(new Event("geritdb-ready"));
