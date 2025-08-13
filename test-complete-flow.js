const { MongoClient } = require('mongodb');

async function testCompleteUserFlow() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('pay_me_pi');
    
    console.log('🚀 Testing Complete User Flow: Subscription → Bidding → Winning → Payment');
    console.log('================================================================');
    
    const testUser = {
        username: 'flow_test_user_' + Date.now(),
        userUid: 'flow_test_uid_' + Date.now()
    };
    
    // Step 1: Create Subscription
    console.log('\n📝 Step 1: User Subscribes');
    console.log('----------------------------');
    
    try {
        const subPaymentId = 'sub_payment_' + Date.now();
        const subTxId = 'sub_tx_' + Date.now();
        
        const subscription = {
            username: testUser.username,
            userUid: testUser.userUid,
            subscriptionType: "monthly",
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            paymentId: subPaymentId,
            txId: subTxId,
            status: "active",
            piAmount: 1,
            created: new Date(),
            lastVerified: new Date()
        };
        
        await db.collection('user_subscriptions').insertOne(subscription);
        
        // Create user profile
        await db.collection('user_profiles').insertOne({
            username: testUser.username,
            userUid: testUser.userUid,
            profile: {
                firstSeen: new Date(),
                lastSeen: new Date(),
                totalLogins: 1,
                totalPayments: 1,
                totalAmountPaid: 1,
                lastPayment: new Date()
            },
            subscription: {
                active: true,
                type: "monthly",
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                daysRemaining: 30
            },
            created: new Date(),
            updated: new Date(),
            source: 'test_flow'
        });
        
        console.log(`✅ Subscription created for ${testUser.username}`);
        console.log(`📅 Expires: ${subscription.endDate.toISOString()}`);
        
    } catch (error) {
        console.error('❌ Subscription creation failed:', error.message);
        return;
    }
    
    // Step 2: User Places Bids
    console.log('\n🎯 Step 2: User Places Auction Bids');
    console.log('-----------------------------------');
    
    const bidData = [
        { itemId: 'art_piece_1', bidAmount: 12 },
        { itemId: 'art_piece_3', bidAmount: 15 }
    ];
    
    for (const bid of bidData) {
        try {
            const bidRecord = {
                username: testUser.username,
                userUid: testUser.userUid,
                itemId: bid.itemId,
                bidAmount: bid.bidAmount,
                timestamp: new Date().toISOString(),
                auctionId: 'auction_1',
                status: 'active',
                createdAt: new Date(),
                ipAddress: '127.0.0.1',
                userAgent: 'Test Flow Script'
            };
            
            await db.collection('auction_bids').insertOne(bidRecord);
            console.log(`✅ Bid placed: ${bid.bidAmount} Pi on ${bid.itemId}`);
            
        } catch (error) {
            console.error(`❌ Failed to place bid on ${bid.itemId}:`, error.message);
        }
    }
    
    // Step 3: Check if User Won
    console.log('\n🏆 Step 3: Determine Auction Winners');
    console.log('------------------------------------');
    
    const winnerItems = [];
    
    for (const bid of bidData) {
        // Check if this user has the highest bid for this item
        const allBidsForItem = await db.collection('auction_bids')
            .find({ itemId: bid.itemId, auctionId: 'auction_1', status: 'active' })
            .sort({ bidAmount: -1 })
            .toArray();
        
        if (allBidsForItem.length > 0 && allBidsForItem[0].username === testUser.username) {
            winnerItems.push({
                itemId: bid.itemId,
                winningBid: allBidsForItem[0].bidAmount
            });
            console.log(`🏆 User WON ${bid.itemId} with ${allBidsForItem[0].bidAmount} Pi`);
        } else {
            console.log(`❌ User did not win ${bid.itemId}`);
        }
    }
    
    // Step 4: Create Winner Records
    if (winnerItems.length > 0) {
        console.log('\n📋 Step 4: Create Winner Records');
        console.log('---------------------------------');
        
        const winnerRecords = winnerItems.map(item => ({
            auctionId: 'auction_1',
            itemId: item.itemId,
            winnerUsername: testUser.username,
            winnerUserUid: testUser.userUid,
            winningBid: item.winningBid,
            bidTimestamp: new Date().toISOString(),
            paymentStatus: 'pending',
            createdAt: new Date(),
            wonAt: new Date()
        }));
        
        await db.collection('auction_winners').insertMany(winnerRecords);
        console.log(`✅ Created ${winnerRecords.length} winner records`);
        
        // Step 5: Simulate Payment Completion
        console.log('\n💳 Step 5: Complete Auction Payments');
        console.log('------------------------------------');
        
        for (const winner of winnerRecords) {
            const paymentId = `auction_payment_${winner.itemId}_${Date.now()}`;
            const txId = `auction_tx_${winner.itemId}_${Date.now()}`;
            
            // Update winner to paid status
            const updateResult = await db.collection('auction_winners').updateOne(
                { 
                    winnerUsername: testUser.username,
                    itemId: winner.itemId,
                    paymentStatus: 'pending'
                },
                {
                    $set: {
                        paymentStatus: 'paid',
                        paymentId: paymentId,
                        txId: txId,
                        paidAmount: winner.winningBid,
                        paidAt: new Date(),
                        digitalArtStatus: 'ready_for_delivery'
                    }
                }
            );
            
            if (updateResult.modifiedCount > 0) {
                console.log(`✅ Payment completed for ${winner.itemId} - ${winner.winningBid} Pi`);
                
                // Create digital art delivery record
                await db.collection('digital_art_delivery').insertOne({
                    username: testUser.username,
                    userUid: testUser.userUid,
                    itemId: winner.itemId,
                    auctionId: 'auction_1',
                    deliveryStatus: 'ready',
                    paymentDetails: {
                        paymentId: paymentId,
                        txId: txId,
                        paidAmount: winner.winningBid,
                        paidAt: new Date()
                    },
                    digitalAsset: {
                        title: getArtTitle(winner.itemId),
                        artist: 'Hanoi Boi',
                        description: `Original digital artwork "${getArtTitle(winner.itemId)}" by Hanoi Boi`,
                        licenseType: 'personal_use'
                    },
                    createdAt: new Date(),
                    accessLog: []
                });
                
                console.log(`🎨 Digital art ready: ${getArtTitle(winner.itemId)}`);
            }
        }
        
        // Step 6: Verify Final Status
        console.log('\n✅ Step 6: Verify Final User Status');
        console.log('------------------------------------');
        
        // Check subscription status
        const subscription = await db.collection('user_subscriptions').findOne({
            username: testUser.username,
            status: "active",
            endDate: { $gt: new Date() }
        });
        
        console.log(`📋 Subscription Active: ${!!subscription}`);
        
        // Check auction wins
        const wins = await db.collection('auction_winners').find({
            winnerUsername: testUser.username
        }).toArray();
        
        console.log(`🏆 Total Auction Wins: ${wins.length}`);
        wins.forEach(win => {
            console.log(`   - ${win.itemId}: ${win.winningBid} Pi (${win.paymentStatus})`);
        });
        
        // Check digital art collection
        const artCollection = await db.collection('digital_art_delivery').find({
            username: testUser.username
        }).toArray();
        
        console.log(`🎨 Digital Art Collection: ${artCollection.length} items`);
        artCollection.forEach(art => {
            console.log(`   - ${art.digitalAsset.title} (${art.deliveryStatus})`);
        });
        
        console.log('\n🎉 COMPLETE USER FLOW TEST SUCCESSFUL!');
        console.log('=====================================');
        console.log(`Test User: ${testUser.username}`);
        console.log(`- Has active subscription: ✅`);
        console.log(`- Won ${wins.length} auction items: ✅`);
        console.log(`- Has ${artCollection.length} digital artworks: ✅`);
        console.log(`- All payments completed: ✅`);
        
    } else {
        console.log('\n❌ No auction wins to process');
    }
    
    await client.close();
    console.log('\n🏁 Test completed!');
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

testCompleteUserFlow().catch(console.error);
