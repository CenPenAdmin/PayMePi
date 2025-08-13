// Test auction timing logic
const now = new Date();
const auctionStart = new Date(now.getTime() - (6 * 60 * 1000)); // 6 minutes ago
const auctionEnd = new Date(now.getTime() + (4 * 60 * 1000)); // 4 minutes from now

console.log('🕐 Auction Timing Test:');
console.log(`   Current time: ${now.toLocaleTimeString()}`);
console.log(`   Auction started: ${auctionStart.toLocaleTimeString()}`);
console.log(`   Auction ends: ${auctionEnd.toLocaleTimeString()}`);

const timeRemaining = auctionEnd.getTime() - now.getTime();
const secondsRemaining = Math.round(timeRemaining / 1000);
const minutesRemaining = Math.floor(secondsRemaining / 60);

console.log(`   Time remaining: ${minutesRemaining}:${(secondsRemaining % 60).toString().padStart(2, '0')}`);

if (now < auctionStart) {
    console.log('📊 Status: NOT STARTED');
} else if (now > auctionEnd) {
    console.log('📊 Status: ENDED');
} else {
    console.log('📊 Status: ACTIVE');
}
