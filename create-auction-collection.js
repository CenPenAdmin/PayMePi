const { MongoClient } = require('mongodb');

async function createAuctionBidsCollection() {
    const client = new MongoClient('mongodb://localhost:27017');
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db('pay_me_pi');
        
        // Drop existing collection if it exists (for clean start)
        try {
            await db.collection('auction_bids').drop();
            console.log('🗑️ Dropped existing auction_bids collection');
        } catch (e) {
            console.log('📝 Collection auction_bids does not exist yet');
        }
        
        // Create the auction_bids collection explicitly
        await db.createCollection('auction_bids');
        console.log('✅ Created auction_bids collection');
        
        // Create indexes for better performance
        await db.collection('auction_bids').createIndex({ username: 1, itemId: 1 }, { unique: true });
        await db.collection('auction_bids').createIndex({ itemId: 1, bidAmount: 1 }, { unique: true });
        await db.collection('auction_bids').createIndex({ bidAmount: -1 });
        console.log('✅ Created indexes on auction_bids collection');
        
        console.log('\n Collection ready! You can now view it in MongoDB Compass');
        console.log('   Database: pay_me_pi');
        console.log('   Collection: auction_bids');
        console.log('\n💡 In MongoDB Compass:');
        console.log('   1. Connect to mongodb://localhost:27017');
        console.log('   2. Select database: pay_me_pi');
        console.log('   3. Click on collection: auction_bids');
        console.log('   4. Collection is ready for auction bid data!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

createAuctionBidsCollection();
