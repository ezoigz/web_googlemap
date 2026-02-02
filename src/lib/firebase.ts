// ไฟล์: src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyA0F-6mQIRn9_8wJn3ZXdVgT3RroVQFXxU",
    authDomain: "chaw-3f04b.firebaseapp.com",
    // 👇 แก้บรรทัดนี้ครับ! ต้องมีคำว่า asia-southeast1
    databaseURL: "https://chaw-3f04b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chaw-3f04b",
    storageBucket: "chaw-3f04b.firebasestorage.app",
    messagingSenderId: "783539490811",
    appId: "1:783539490811:web:f19e3bffdc2e9d0e07055e"
};

// ป้องกันการเชื่อมต่อซ้ำเวลารีเฟรชหน้าจอ
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

export { db };