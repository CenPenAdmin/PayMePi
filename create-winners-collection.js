const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'pay_me_pi';

async function createWinnersCollection() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        
        // Create auction_winners collection if it doesn't exist
        const collections = await db.listCollections({ name: 'auction_winners' }).toArray();
        
        if (collections.length === 0) {
            await db.createCollection('auction_winners');
            console.log('📊 Created auction_winners collection');
        } else {
            console.log('📊 auction_winners collection already exists');
        }
        
        // Create indexes for efficient queries
        const winnersCollection = db.collection('auction_winners');
        
        // Index for finding winners by auction and item
        await winnersCollection.createIndex({ auctionId: 1, itemId: 1 }, { unique: true });
        console.log('🔍 Created index: auctionId + itemId (unique)');
        
        // Index for finding user's wins
        await winnersCollection.createIndex({ winnerUsername: 1 });
        console.log('🔍 Created index: winnerUsername');
        
        // Index for payment status queries
        await winnersCollection.createIndex({ paymentStatus: 1 });
        console.log('🔍 Created index: paymentStatus');
        
        // Index for payment deadline management
        await winnersCollection.createIndex({ paymentDeadline: 1 });
        console.log('🔍 Created index: paymentDeadline');
        
        console.log('\n🎉 auction_winners collection setup complete!');
        console.log('\n📋 Collection Schema:');
        console.log(`{
  _id: ObjectId,
  auctionId: "auction_1",
  itemId: "item1", 
  winnerUsername: "this3is2ridiculous",
  winnerUserUid: "59d406ea-6aa6-49b1-b437-3c1b9bb0cf59",
  winningBid: 15.7,
  winningTimestamp: Date,
  auctionEndTime: Date,
  paymentStatus: "pending", // pending, paid, failed, expired
  paymentDeadline: Date,    // 48 hours after auction end
  paymentId: null,          // Pi payment ID when paid
  txId: null,              // Blockchain transaction ID
  notificationSent: false,
  createdAt: Date
}`);
        
    } catch (error) {
        console.error('❌ Error setting up auction_winners collection:', error);
    } finally {
        await client.close();
    }
}

createWinnersCollection();
