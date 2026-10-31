/**
 * One-time migration script to sync supervisorId from accepted supervision requests to groups
 * Run this once to fix existing groups that don't have supervisorId set
 */

import { db } from './src/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

async function syncSupervisorIds() {
    console.log('🔄 Starting supervisor ID sync...\n');

    try {
        // Get all accepted supervision requests
        const requestsQuery = query(
            collection(db, 'supervisionRequests'),
            where('status', '==', 'accepted')
        );

        const snapshot = await getDocs(requestsQuery);
        console.log(`📋 Found ${snapshot.size} accepted supervision requests\n`);

        let updated = 0;
        let errors = 0;

        for (const requestDoc of snapshot.docs) {
            const request = requestDoc.data();

            try {
                // Check if group already has supervisorId
                const groupDoc = await getDocs(
                    query(collection(db, 'groups'), where('__name__', '==', request.groupId))
                );

                if (!groupDoc.empty) {
                    const groupData = groupDoc.docs[0].data();

                    if (!groupData.supervisorId) {
                        // Update the group with supervisorId
                        await updateDoc(doc(db, 'groups', request.groupId), {
                            supervisorId: request.supervisorId
                        });

                        console.log(`✅ Updated group "${groupData.name}" (${request.groupId}) with supervisor ${request.supervisorId}`);
                        updated++;
                    } else {
                        console.log(`⏭️  Group "${groupData.name}" already has supervisorId set`);
                    }
                } else {
                    console.log(`⚠️  Group ${request.groupId} not found`);
                }
            } catch (error) {
                console.error(`❌ Error updating group ${request.groupId}:`, error);
                errors++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   ✅ Updated: ${updated} groups`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log('\n✨ Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// Run the migration
syncSupervisorIds();
