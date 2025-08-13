const { MongoClient, ObjectId } = require('mongodb');

async function testMarkAsPaid() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('pay_me_pi');
    
    console.log('🔍 Testing manual payment status update...');
    
    // Find the first pending winner for this3is2ridiculous
    const winnersCollection = db.collection('auction_winners');
    const pendingWinner = await winnersCollection.findOne({ 
        winnerUsername: 'this3is2ridiculous',
        paymentStatus: 'pending'
    });
    
    if (pendingWinner) {
        console.log(`📝 Found pending winner: ${pendingWinner.itemId} (${pendingWinner.winningBid} Pi)`);
        
        // Update to paid status
        const updateResult = await winnersCollection.updateOne(
            { _id: pendingWinner._id },
            {
                $set: {
                    paymentStatus: 'paid',
                    paymentId: 'test_payment_' + Date.now(),
                    txId: 'test_tx_' + Date.now(),
                    paidAmount: pendingWinner.winningBid,
                    paidAt: new Date(),
                    digitalArtStatus: 'ready_for_delivery'
                }
            }
        );
        
        console.log(`✅ Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
        
        if (updateResult.modifiedCount > 0) {
            console.log(`🎉 Successfully marked ${pendingWinner.itemId} as paid!`);
            console.log('Now check the auction-winner.html page to see if it shows the correct status.');
        }
    } else {
        console.log('❌ No pending winners found');
    }
    
    await client.close();
}

testMarkAsPaid().catch(console.error);
