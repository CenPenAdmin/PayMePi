const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';

async function insertTestWinnerData() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        const winnersCollection = db.collection('auction_winners');
        
        // Clear existing winners to start fresh
        await winnersCollection.deleteMany({ auctionId: 'auction_1' });
        console.log('🧹 Cleared existing winner data');
        
        // Create 48-hour deadline from now
        const now = new Date();
        const paymentDeadline = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        
        // Insert winner data for this3is2ridiculous for all 5 items
        const winnerData = [
            {
                auctionId: 'auction_1',
                itemId: 'item1',
                winnerUsername: 'this3is2ridiculous',
                winnerUserUid: '59d406ea-6aa6-49b1-b437-3c1b9bb0cf59',
                winningBid: 3.05,
                winningTimestamp: new Date('2025-08-13T10:29:00.000Z'),
                auctionEndTime: new Date('2025-08-13T10:30:00.000Z'),
                paymentStatus: 'pending',
                paymentDeadline: paymentDeadline,
                paymentId: null,
                txId: null,
                notificationSent: false,
                createdAt: now
            },
            {
                auctionId: 'auction_1',
                itemId: 'item2',
                winnerUsername: 'this3is2ridiculous',
                winnerUserUid: '59d406ea-6aa6-49b1-b437-3c1b9bb0cf59',
                winningBid: 200,
                winningTimestamp: new Date('2025-08-13T10:29:30.000Z'),
                auctionEndTime: new Date('2025-08-13T10:30:00.000Z'),
                paymentStatus: 'pending',
                paymentDeadline: paymentDeadline,
                paymentId: null,
                txId: null,
                notificationSent: false,
                createdAt: now
            },
            {
                auctionId: 'auction_1',
                itemId: 'item3',
                winnerUsername: 'this3is2ridiculous',
                winnerUserUid: '59d406ea-6aa6-49b1-b437-3c1b9bb0cf59',
                winningBid: 3,
                winningTimestamp: new Date('2025-08-13T10:28:45.000Z'),
                auctionEndTime: new Date('2025-08-13T10:30:00.000Z'),
                paymentStatus: 'pending',
                paymentDeadline: paymentDeadline,
                paymentId: null,
                txId: null,
                notificationSent: false,
                createdAt: now
            },
            {
                auctionId: 'auction_1',
                itemId: 'item4',
                winnerUsername: 'this3is2ridiculous',
                winnerUserUid: '59d406ea-6aa6-49b1-b437-3c1b9bb0cf59',
                winningBid: 99,
                winningTimestamp: new Date('2025-08-13T10:29:15.000Z'),
                auctionEndTime: new Date('2025-08-13T10:30:00.000Z'),
                paymentStatus: 'pending',
                paymentDeadline: paymentDeadline,
                paymentId: null,
                txId: null,
                notificationSent: false,
                createdAt: now
            },
            {
                auctionId: 'auction_1',
                itemId: 'item5',
                winnerUsername: 'this3is2ridiculous',
                winnerUserUid: '59d406ea-6aa6-49b1-b437-3c1b9bb0cf59',
                winningBid: 23,
                winningTimestamp: new Date('2025-08-13T10:29:45.000Z'),
                auctionEndTime: new Date('2025-08-13T10:30:00.000Z'),
                paymentStatus: 'pending',
                paymentDeadline: paymentDeadline,
                paymentId: null,
                txId: null,
                notificationSent: false,
                createdAt: now
            }
        ];
        
        const result = await winnersCollection.insertMany(winnerData);
        console.log(`🏆 Inserted ${result.insertedCount} winner records`);
        
        // Verify the data
        const winners = await winnersCollection.find({ winnerUsername: 'this3is2ridiculous' }).toArray();
        console.log(`✅ Found ${winners.length} wins for this3is2ridiculous:`);
        winners.forEach(win => {
            console.log(`   - ${win.itemId}: ${win.winningBid} Pi (${win.paymentStatus})`);
        });
        
        console.log(`\n💰 Total winnings: ${winners.reduce((sum, win) => sum + win.winningBid, 0)} Pi`);
        console.log(`⏰ Payment deadline: ${paymentDeadline.toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

insertTestWinnerData();
