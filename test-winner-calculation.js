const AuctionWinnerManager = require('./auction-winner.js');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';

async function testWinnerCalculation() {
    const winnerManager = new AuctionWinnerManager(MONGO_URI, DATABASE_NAME);
    
    try {
        await winnerManager.connect();
        console.log('✅ Connected to database');
        
        // Calculate winners for auction_1
        console.log('🏆 Calculating winners for auction_1...');
        const result = await winnerManager.calculateAuctionWinners('auction_1');
        
        console.log('\n🎉 Winner calculation complete!');
        console.log(JSON.stringify(result, null, 2));
        
        // Check user wins for this3is2ridiculous
        console.log('\n👑 Checking wins for this3is2ridiculous...');
        const userWins = await winnerManager.getUserWins('this3is2ridiculous');
        console.log(`Found ${userWins.length} wins for this3is2ridiculous:`);
        userWins.forEach(win => {
            console.log(`- ${win.itemId}: ${win.winningBid} Pi (${win.paymentStatus})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await winnerManager.disconnect();
    }
}

testWinnerCalculation();
