const AuctionWinnerManager = require('./auction-winner.js');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';

async function calculateRealWinners() {
    const winnerManager = new AuctionWinnerManager(MONGO_URI, DATABASE_NAME);
    
    try {
        await winnerManager.connect();
        console.log('✅ Connected to database');
        
        // Calculate winners for auction_1 based on real bid data
        console.log('🏆 Calculating REAL winners for auction_1 from actual bid data...');
        const result = await winnerManager.calculateAuctionWinners('auction_1');
        
        console.log('\n🎉 REAL winner calculation complete!');
        console.log('📋 Results:');
        result.winners.forEach(winner => {
            console.log(`   🏆 ${winner.itemId}: ${winner.winner} won with ${winner.winningBid} Pi`);
        });
        
        // Check user wins for this3is2ridiculous
        console.log('\n👑 Checking REAL wins for this3is2ridiculous...');
        const userWins = await winnerManager.getUserWins('this3is2ridiculous');
        console.log(`✅ Found ${userWins.length} REAL wins for this3is2ridiculous:`);
        
        let totalWinnings = 0;
        userWins.forEach(win => {
            console.log(`   - ${win.itemId}: ${win.winningBid} Pi (${win.paymentStatus})`);
            totalWinnings += win.winningBid;
        });
        
        if (userWins.length > 0) {
            console.log(`\n💰 Total REAL winnings: ${totalWinnings} Pi`);
            console.log(`⏰ Payment deadline: ${userWins[0].paymentDeadline}`);
            console.log('\n🎯 NOW the golden banner should appear when this3is2ridiculous logs in!');
        } else {
            console.log('\n❌ this3is2ridiculous did not win any items');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await winnerManager.disconnect();
    }
}

calculateRealWinners();
