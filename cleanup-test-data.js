const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';

async function cleanupTestData() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        
        // Remove all test winner data
        const winnersCollection = db.collection('auction_winners');
        const deleteResult = await winnersCollection.deleteMany({});
        console.log(`🧹 Removed ${deleteResult.deletedCount} test winner records`);
        
        // Check current auction bids for this3is2ridiculous
        const bidsCollection = db.collection('auction_bids');
        const userBids = await bidsCollection.find({ 
            username: 'this3is2ridiculous',
            auctionId: 'auction_1'
        }).toArray();
        
        console.log(`\n📊 Current real bids for this3is2ridiculous:`);
        userBids.forEach(bid => {
            console.log(`   - ${bid.itemId}: ${bid.bidAmount} Pi (${bid.timestamp})`);
        });
        
        // Check if auction has ended (past 10:30 AM)
        const now = new Date();
        const auctionEnd = new Date();
        auctionEnd.setHours(10, 30, 0, 0);
        
        console.log(`\n🕐 Auction Status:`);
        console.log(`   Current time: ${now.toLocaleString()}`);
        console.log(`   Auction ended: ${auctionEnd.toLocaleString()}`);
        console.log(`   Auction is ${now > auctionEnd ? 'ENDED' : 'ACTIVE'}`);
        
        if (now > auctionEnd) {
            console.log(`\n🏆 Since auction has ended, we should calculate real winners...`);
            console.log(`   Run winner calculation to determine actual winners based on highest bids`);
        } else {
            console.log(`\n⏰ Auction is still active, winners will be calculated when it ends`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

cleanupTestData();
