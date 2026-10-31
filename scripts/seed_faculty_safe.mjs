import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const serviceAccountPath = path.join(__dirname, '../Backend/ProjectSync.Api/firebase-credentials.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

console.log("Initializing Firebase Admin SDK...");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const facultyData = [
  {
    "id": "faculty_mehak_tanveer",
    "name": "Mehak Tanveer",
    "email": "mehak.tanveer@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Deep Learning", "Artificial Intelligence", "Virtual Reality", "Augmented Reality", "Blockchain"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_rizwan_farukh",
    "name": "Rizwan Farukh",
    "email": "rizwan.farukh@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Computer Network", "System Administration", "Information Technology", "Information Security"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_irfah_shabbir",
    "name": "Irfah Shabbir",
    "email": "irfah.shabbir@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Mobile Application Development", "Website Development", "Augmented Reality", "Database"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_ameer_hamza",
    "name": "Ameer Hamza",
    "email": "ameer.hamza@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Mobile App Development", "Software Engineering", "Assembly Language", "Artificial Intelligence", "Gaming Development"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_tayyab_ahmed",
    "name": "Tayyab Ahmed",
    "email": "tayyab.ahmed@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Deep Learning", "Machine Learning", "Database", "Operating System", "Natural Language Processing"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_sir_zeeshan",
    "name": "Sir Zeeshan",
    "email": "zeeshan@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Deep Learning", "Machine Learning", "Database"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_aysha_sadiqqa",
    "name": "Aysha Sadiqqa",
    "email": "aysha.sadiqqa@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Artificial Intelligence", "Machine Learning", "Deep Learning", "Information Security"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_nibtal_khalid",
    "name": "Nibtal Khalid",
    "email": "nibtal.khalid@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Website Development", "Mobile Development", "Artificial Intelligence", "Cyber Security"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_almas_aina",
    "name": "Almas Aina",
    "email": "almas.aina@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Artificial Intelligence", "Machine Learning", "Deep Learning", "Website Development"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_azka_mir",
    "name": "Azka Mir",
    "email": "azka.mir@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Computer Vision", "Artificial Intelligence", "Mobile Application Development"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_museb_khalid",
    "name": "Museb Khalid",
    "email": "museb.khalid@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Internet of Things", "Website Development"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_kaynat",
    "name": "Kaynat",
    "email": "kaynat@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Machine Learning", "Deep Learning"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  },
  {
    "id": "faculty_sadia",
    "name": "Sadia",
    "email": "sadia@university.edu.pk",
    "role": "supervisor",
    "roles": ["supervisor", "panel"],
    "department": "Computer Science",
    "expertise": ["Mobile Application Development"],
    "maxGroups": 4,
    "activeGroupsCount": 0
  }
];

async function seed() {
    try {
        console.log("Safely upserting 13 verified faculty members into 'users' and 'supervisors' collections...");
        
        for (const faculty of facultyData) {
            // Upsert into users
            await db.collection("users").doc(faculty.id).set({
                ...faculty,
                createdAt: new Date().toISOString()
            }, { merge: true });
            
            // Upsert into supervisors
            await db.collection("supervisors").doc(faculty.id).set({
                ...faculty,
                createdAt: new Date().toISOString()
            }, { merge: true });
            
            console.log(`✅ Upserted ${faculty.name}`);
        }

        console.log("Safe seeding complete! No destructive operations were performed.");
        process.exit(0);
    } catch (err) {
        console.error("Error during safe seeding:", err);
        process.exit(1);
    }
}

seed();
