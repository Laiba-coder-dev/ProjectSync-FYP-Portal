import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Initializing Firebase with config:", { ...firebaseConfig, apiKey: '***' });

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
    try {
        console.log("Seeding test data...");
        // Define some seed data
        const collections = ['users', 'groups', 'projects'];
        
        // Example: Add a dummy admin user
        await setDoc(doc(db, "users", "admin-seed-id"), {
            email: "admin@example.com",
            role: "admin",
            name: "Admin User",
            createdAt: new Date()
        });
        console.log("✅ Seeded admin user");

        console.log("Seeding complete! You can safely delete 'admin-seed-id' user if not needed.");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding database:", err);
        process.exit(1);
    }
}

seed();
