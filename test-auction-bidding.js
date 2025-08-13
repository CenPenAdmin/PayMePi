const { MongoClient } = require('mongodb');

async function testAuctionBidding() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('pay_me_pi');
    
    console.log('🎯 Testing auction bidding functionality...');
    
    // Clear any existing test bids
    await db.collection('auction_bids').deleteMany({ username: /^testbidder/ });
    console.log('🧹 Cleared any existing test bids');
    
    // Test bidding on different items
    const testBids = [
        { username: 'testbidder1', userUid: 'test_uid_1', itemId: 'art_piece_1', bidAmount: 5 },
        { username: 'testbidder2', userUid: 'test_uid_2', itemId: 'art_piece_1', bidAmount: 7 },
        { username: 'testbidder3', userUid: 'test_uid_3', itemId: 'art_piece_2', bidAmount: 4 },
        { username: 'testbidder4', userUid: 'test_uid_4', itemId: 'art_piece_2', bidAmount: 8 },
        { username: 'testbidder5', userUid: 'test_uid_5', itemId: 'art_piece_3', bidAmount: 6 }
    ];
    
    console.log('📝 Placing test bids...');
    
    for (const bid of testBids) {
        try {
            // Create bid record (simulating the server endpoint logic)
            const bidRecord = {
                username: bid.username,
                userUid: bid.userUid,
                itemId: bid.itemId,
                bidAmount: bid.bidAmount,
                timestamp: new Date().toISOString(),
                auctionId: 'auction_1',
                status: 'active',
                createdAt: new Date(),
                ipAddress: '127.0.0.1',
                userAgent: 'Test Script'
            };
            
            await db.collection('auction_bids').insertOne(bidRecord);
            console.log(`✅ Bid placed: ${bid.username} - ${bid.bidAmount} Pi on ${bid.itemId}`);
            
        } catch (error) {
            console.error(`❌ Failed to place bid for ${bid.username}:`, error.message);
        }
    }
    
    // Check the bids were created
    const totalBids = await db.collection('auction_bids').countDocuments({ auctionId: 'auction_1', status: 'active' });
    console.log(`📊 Total active bids for auction_1: ${totalBids}`);
    
    // Get highest bids for each item
    console.log('🏆 Highest bids by item:');
    const items = ['art_piece_1', 'art_piece_2', 'art_piece_3', 'art_piece_4', 'art_piece_5'];
    
    for (const itemId of items) {
        const highestBid = await db.collection('auction_bids')
            .findOne(
                { itemId: itemId, auctionId: 'auction_1', status: 'active' },
                { sort: { bidAmount: -1 } }
            );
        
        if (highestBid) {
            console.log(`  ${itemId}: ${highestBid.bidAmount} Pi by ${highestBid.username}`);
        } else {
            console.log(`  ${itemId}: No bids`);
        }
    }
    
    // Test winner calculation
    console.log('\n🎯 Testing winner calculation...');
    
    // Simulate the winner calculation logic
    const winnerResults = [];
    
    for (const itemId of items) {
        const highestBid = await db.collection('auction_bids')
            .findOne(
                { itemId: itemId, auctionId: 'auction_1', status: 'active' },
                { sort: { bidAmount: -1 } }
            );
        
        if (highestBid) {
            const winner = {
                auctionId: 'auction_1',
                itemId: itemId,
                winnerUsername: highestBid.username,
                winnerUserUid: highestBid.userUid,
                winningBid: highestBid.bidAmount,
                bidTimestamp: highestBid.timestamp,
                paymentStatus: 'pending',
                createdAt: new Date(),
                wonAt: new Date()
            };
            
            winnerResults.push(winner);
            console.log(`🏆 Winner for ${itemId}: ${highestBid.username} with ${highestBid.bidAmount} Pi`);
        }
    }
    
    // Clear existing test winners
    await db.collection('auction_winners').deleteMany({ winnerUsername: /^testbidder/ });
    
    // Insert winner records
    if (winnerResults.length > 0) {
        await db.collection('auction_winners').insertMany(winnerResults);
        console.log(`✅ Created ${winnerResults.length} winner records`);
    }
    
    console.log('\n💳 Testing auction payment completion...');
    
    // Test payment completion for one winner
    if (winnerResults.length > 0) {
        const testWinner = winnerResults[0];
        const testPaymentId = 'test_auction_payment_' + Date.now();
        const testTxId = 'test_tx_' + Date.now();
        
        console.log(`Testing payment for ${testWinner.winnerUsername} - ${testWinner.itemId}`);
        
        // Update winner record to paid status
        const updateResult = await db.collection('auction_winners').updateOne(
            { 
                winnerUsername: testWinner.winnerUsername,
                itemId: testWinner.itemId,
                paymentStatus: 'pending'
            },
            {
                $set: {
                    paymentStatus: 'paid',
                    paymentId: testPaymentId,
                    txId: testTxId,
                    paidAmount: testWinner.winningBid,
                    paidAt: new Date(),
                    digitalArtStatus: 'ready_for_delivery'
                }
            }
        );
        
        if (updateResult.modifiedCount > 0) {
            console.log(`✅ Auction winner payment processed for ${testWinner.winnerUsername} - ${testWinner.itemId}`);
            
            // Create digital art delivery record
            await db.collection('digital_art_delivery').insertOne({
                username: testWinner.winnerUsername,
                userUid: testWinner.winnerUserUid,
                itemId: testWinner.itemId,
                auctionId: 'auction_1',
                deliveryStatus: 'ready',
                paymentDetails: {
                    paymentId: testPaymentId,
                    txId: testTxId,
                    paidAmount: testWinner.winningBid,
                    paidAt: new Date()
                },
                digitalAsset: {
                    title: getArtTitle(testWinner.itemId),
                    artist: 'Hanoi Boi',
                    description: `Original digital artwork "${getArtTitle(testWinner.itemId)}" by Hanoi Boi`
                },
                createdAt: new Date(),
                accessLog: []
            });
            
            console.log(`🎨 Digital art delivery record created for ${testWinner.itemId}`);
        } else {
            console.log('❌ Failed to update winner payment status');
        }
    }
    
    await client.close();
    console.log('🎯 Auction bidding test completed!');
}

function getArtTitle(itemId) {
    const artInfo = {
        'art_piece_1': 'Chomp Bomper One',
        'art_piece_2': 'Chomp Bomper Two', 
        'art_piece_3': 'Chomp Bomper Three',
        'art_piece_4': 'Chomp Bomper Four',
        'art_piece_5': 'Chomp Bomper Five'
    };
    return artInfo[itemId] || 'Unknown Artwork';
}

testAuctionBidding().catch(console.error);
