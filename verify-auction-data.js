const { MongoClient } = require('mongodb');

async function verifyAuctionData() {
    const client = new MongoClient('mongodb://localhost:27017');
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db('pay_me_pi');
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📋 All collections in pay_me_pi database:');
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });
        
        // Check auction_bids collection
        const auctionBidsExists = collections.some(col => col.name === 'auction_bids');
        if (auctionBidsExists) {
            console.log('\n✅ auction_bids collection exists!');
            
            const count = await db.collection('auction_bids').countDocuments();
            console.log(`📊 auction_bids collection has ${count} documents`);
            
            if (count > 0) {
                // Show actual bid data if any exists
                const recentBids = await db.collection('auction_bids').find({}).sort({ createdAt: -1 }).limit(3).toArray();
                console.log('\n📄 Recent bid documents:');
                recentBids.forEach((bid, index) => {
                    console.log(`${index + 1}. ${bid.username} bid ${bid.bidAmount} Pi on ${bid.itemId}`);
                });
            } else {
                console.log('\n📝 Collection is empty and ready for auction bids');
            }
            
        } else {
            console.log('\n❌ auction_bids collection not found');
        }
        
        console.log('\n🎯 Ready for MongoDB Compass!');
        console.log('   Connection: mongodb://localhost:27017');
        console.log('   Database: pay_me_pi');
        console.log('   Collection: auction_bids');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

verifyAuctionData();
