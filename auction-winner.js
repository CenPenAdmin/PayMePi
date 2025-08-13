const { MongoClient } = require('mongodb');

/**
 * Auction Winner Management System
 * Handles winner calculation, payment processing, and deadline management
 */
class AuctionWinnerManager {
    constructor(mongoUri, dbName) {
        this.mongoUri = mongoUri;
        this.dbName = dbName;
        this.client = null;
        this.db = null;
    }

    async connect() {
        this.client = new MongoClient(this.mongoUri);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
        }
    }

    /**
     * Calculate winners for a specific auction
     * Finds the highest bid for each item and creates winner records
     */
    async calculateAuctionWinners(auctionId) {
        try {
            console.log(`🏆 Calculating winners for ${auctionId}...`);
            
            const bidsCollection = this.db.collection('auction_bids');
            const winnersCollection = this.db.collection('auction_winners');
            
            // Get all active bids for this auction
            const allBids = await bidsCollection.find({ 
                auctionId: auctionId,
                status: 'active'
            }).toArray();
            
            console.log(`📊 Found ${allBids.length} total bids for ${auctionId}`);
            
            // Group bids by item and find highest bid for each
            const itemWinners = {};
            
            for (const bid of allBids) {
                const itemId = bid.itemId;
                
                if (!itemWinners[itemId] || bid.bidAmount > itemWinners[itemId].bidAmount) {
                    itemWinners[itemId] = bid;
                }
            }
            
            console.log(`🎯 Found winners for ${Object.keys(itemWinners).length} items`);
            
            // Create winner records
            const winners = [];
            const auctionEndTime = new Date();
            const paymentDeadline = new Date(auctionEndTime.getTime() + (48 * 60 * 60 * 1000)); // 48 hours
            
            for (const [itemId, winningBid] of Object.entries(itemWinners)) {
                const winnerRecord = {
                    auctionId: auctionId,
                    itemId: itemId,
                    winnerUsername: winningBid.username,
                    winnerUserUid: winningBid.userUid,
                    winningBid: winningBid.bidAmount,
                    winningTimestamp: new Date(winningBid.timestamp),
                    auctionEndTime: auctionEndTime,
                    paymentStatus: 'pending',
                    paymentDeadline: paymentDeadline,
                    paymentId: null,
                    txId: null,
                    notificationSent: false,
                    createdAt: new Date()
                };
                
                winners.push(winnerRecord);
                
                console.log(`👑 Winner for ${itemId}: ${winningBid.username} with ${winningBid.bidAmount} Pi`);
            }
            
            // Insert winner records (use upsert to handle reruns)
            const insertPromises = winners.map(winner => 
                winnersCollection.replaceOne(
                    { auctionId: winner.auctionId, itemId: winner.itemId },
                    winner,
                    { upsert: true }
                )
            );
            
            await Promise.all(insertPromises);
            
            console.log(`✅ Successfully created ${winners.length} winner records`);
            
            return {
                success: true,
                auctionId: auctionId,
                winnersCount: winners.length,
                winners: winners.map(w => ({
                    itemId: w.itemId,
                    winner: w.winnerUsername,
                    winningBid: w.winningBid
                }))
            };
            
        } catch (error) {
            console.error('❌ Error calculating auction winners:', error);
            throw error;
        }
    }

    /**
     * Get winners for a specific user
     */
    async getUserWins(username) {
        try {
            const winnersCollection = this.db.collection('auction_winners');
            
            const userWins = await winnersCollection.find({ 
                winnerUsername: username 
            }).toArray();
            
            return userWins;
            
        } catch (error) {
            console.error('❌ Error getting user wins:', error);
            throw error;
        }
    }

    /**
     * Get all winners for a specific auction
     */
    async getAuctionWinners(auctionId) {
        try {
            const winnersCollection = this.db.collection('auction_winners');
            
            const winners = await winnersCollection.find({ 
                auctionId: auctionId 
            }).sort({ itemId: 1 }).toArray();
            
            return winners;
            
        } catch (error) {
            console.error('❌ Error getting auction winners:', error);
            throw error;
        }
    }

    /**
     * Process payment for a won item
     */
    async processWinnerPayment(auctionId, itemId, paymentId, txId = null) {
        try {
            const winnersCollection = this.db.collection('auction_winners');
            
            const result = await winnersCollection.updateOne(
                { auctionId: auctionId, itemId: itemId },
                { 
                    $set: { 
                        paymentStatus: 'paid',
                        paymentId: paymentId,
                        txId: txId,
                        paidAt: new Date()
                    }
                }
            );
            
            if (result.matchedCount === 0) {
                throw new Error('Winner record not found');
            }
            
            console.log(`💰 Payment processed for ${auctionId}/${itemId}: ${paymentId}`);
            
            return { success: true, paymentId: paymentId };
            
        } catch (error) {
            console.error('❌ Error processing winner payment:', error);
            throw error;
        }
    }

    /**
     * Get pending payments (for deadline management)
     */
    async getPendingPayments() {
        try {
            const winnersCollection = this.db.collection('auction_winners');
            
            const pendingPayments = await winnersCollection.find({ 
                paymentStatus: 'pending',
                paymentDeadline: { $gte: new Date() }
            }).toArray();
            
            return pendingPayments;
            
        } catch (error) {
            console.error('❌ Error getting pending payments:', error);
            throw error;
        }
    }

    /**
     * Mark expired payments
     */
    async markExpiredPayments() {
        try {
            const winnersCollection = this.db.collection('auction_winners');
            
            const result = await winnersCollection.updateMany(
                { 
                    paymentStatus: 'pending',
                    paymentDeadline: { $lt: new Date() }
                },
                { 
                    $set: { 
                        paymentStatus: 'expired',
                        expiredAt: new Date()
                    }
                }
            );
            
            console.log(`⏰ Marked ${result.modifiedCount} payments as expired`);
            
            return result.modifiedCount;
            
        } catch (error) {
            console.error('❌ Error marking expired payments:', error);
            throw error;
        }
    }
}

module.exports = AuctionWinnerManager;
