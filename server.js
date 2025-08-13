// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient } = require('mongodb');
const AuctionWinnerManager = require('./auction-winner.js');

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';
let db;
let winnerManager;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'https://CenPenAdmin.github.io',
            'https://e2b3fe8c3116.ngrok-free.app'
        ];
        
        const allowedPatterns = [
            /^https:\/\/.*\.ngrok\.io$/,
            /^https:\/\/.*\.ngrok-free\.app$/,
            /^https:\/\/.*\.github\.io$/
        ];
        
        // Check exact matches
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Check pattern matches
        if (allowedPatterns.some(pattern => pattern.test(origin))) {
            return callback(null, true);
        }
        
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning'],
    exposedHeaders: ['*'],
    maxAge: 86400
}));

// Handle preflight requests for all routes
app.options('*', cors());

app.use(bodyParser.json());

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Origin:', req.get('origin'));
    console.log('User-Agent:', req.get('user-agent'));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    console.log('---');
    next();
});
app.use(express.static('.')); // Serve static files from current directory

// Your Pi API Key - MUST be set as environment variable for security
const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_URL = 'https://api.minepi.com'; // Use testnet URL: https://api.minepi.com

// Security check - ensure API key is provided via environment variable
if (!PI_API_KEY) {
    console.error('❌ CRITICAL: PI_API_KEY environment variable not set!');
    console.error('For security, the Pi API key must be provided as an environment variable.');
    console.error('Set it by running: $env:PI_API_KEY="your-api-key-here"');
    process.exit(1);
}

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log('✅ Connected to MongoDB at', MONGO_URI);
        console.log('📊 Database:', DATABASE_NAME);
        
        // Initialize winner manager
        winnerManager = new AuctionWinnerManager(MONGO_URI, DATABASE_NAME);
        await winnerManager.connect();
        console.log('🏆 Winner management system initialized');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('⚠️  App will continue without database logging');
    }
}

// Initialize MongoDB connection
connectToMongoDB();

// Data Migration Function - Migrate existing payments to new user-centric structure
async function migrateExistingData() {
    if (!db) {
        console.log('⚠️  Database not connected - skipping migration');
        return;
    }

    try {
        console.log('🔄 Starting data migration to user-centric structure...');

        // Get all existing payments
        const existingPayments = await db.collection('payments').find().toArray();
        console.log(`📊 Found ${existingPayments.length} existing payments to migrate`);

        let migratedUsers = 0;
        const processedUsers = new Set();

        for (const payment of existingPayments) {
            const username = payment.userInfo?.username;
            const userUid = payment.userInfo?.userUid;

            if (username && username !== 'unknown' && !processedUsers.has(username)) {
                // Create or update user profile based on payment history
                const userPayments = existingPayments.filter(p => p.userInfo?.username === username);
                const completedPayments = userPayments.filter(p => p.status === 'completed');
                const totalAmount = completedPayments.reduce((sum, p) => sum + (p.paymentDetails?.amount || 0), 0);

                const firstPayment = userPayments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
                const lastPayment = userPayments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

                // Check if profile already exists
                const existingProfile = await db.collection('user_profiles').findOne({ username });
                
                if (!existingProfile) {
                    // Create new profile from payment history
                    await db.collection('user_profiles').insertOne({
                        username,
                        userUid,
                        profile: {
                            firstSeen: firstPayment.timestamp,
                            lastSeen: lastPayment.timestamp,
                            totalLogins: 1, // We don't have auth history, so default to 1
                            totalPayments: completedPayments.length,
                            totalAmountPaid: totalAmount,
                            lastPayment: lastPayment.timestamp,
                            ipAddresses: [...new Set(userPayments.map(p => p.technicalInfo?.clientIP).filter(Boolean))],
                            userAgents: [...new Set(userPayments.map(p => p.technicalInfo?.userAgent).filter(Boolean))]
                        },
                        created: new Date(),
                        updated: new Date(),
                        migratedFrom: 'existing_payments'
                    });

                    // Create activity records for all their payments
                    for (const payment of userPayments) {
                        // Payment approval activity
                        await db.collection('user_activities').insertOne({
                            username,
                            userUid,
                            activityType: 'payment_approval',
                            timestamp: payment.timestamp,
                            details: {
                                paymentId: payment.paymentId,
                                amount: payment.paymentDetails?.amount,
                                memo: payment.paymentDetails?.memo,
                                ip: payment.technicalInfo?.clientIP || 'unknown',
                                userAgent: payment.technicalInfo?.userAgent || 'unknown',
                                origin: payment.technicalInfo?.origin,
                                migratedFrom: 'existing_payments'
                            }
                        });

                        // Payment completion activity (if completed)
                        if (payment.status === 'completed' && payment.completedAt) {
                            await db.collection('user_activities').insertOne({
                                username,
                                userUid,
                                activityType: 'payment_completion',
                                timestamp: payment.completedAt,
                                details: {
                                    paymentId: payment.paymentId,
                                    txId: payment.txId,
                                    amount: payment.completionDetails?.finalAmount || payment.paymentDetails?.amount,
                                    transactionVerified: payment.completionDetails?.transactionVerified,
                                    ip: payment.completionDetails?.completionIP || 'unknown',
                                    userAgent: payment.completionDetails?.completionUserAgent || 'unknown',
                                    transactionLink: payment.completionDetails?.transactionLink,
                                    migratedFrom: 'existing_payments'
                                }
                            });
                        }
                    }

                    migratedUsers++;
                    console.log(`✅ Migrated user: ${username} (${userPayments.length} payments, ${totalAmount} Pi total)`);
                } else {
                    console.log(`⏭️  User profile already exists: ${username}`);
                }

                processedUsers.add(username);
            }
        }

        console.log(`🎉 Migration complete! Migrated ${migratedUsers} users to new structure`);
        console.log(`📋 Old collections (payments, sessions, user_sessions) preserved for backward compatibility`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

// Run migration on startup (only if needed)
setTimeout(() => {
    if (db) {
        migrateExistingData();
    }
}, 3000); // Wait 3 seconds after DB connection

// User Profile Management Functions
async function createOrUpdateUserProfile(username, userUid, activityData = {}) {
    if (!db || !username) return;
    
    try {
        const now = new Date();
        const clientIP = activityData.ip || 'unknown';
        const userAgent = activityData.userAgent || 'unknown';
        
        // Check if profile exists
        const existingProfile = await db.collection('user_profiles').findOne({ username });
        
        if (existingProfile) {
            // Update existing profile
            await db.collection('user_profiles').updateOne(
                { username },
                {
                    $set: {
                        lastSeen: now,
                        updated: now
                    },
                    $inc: {
                        totalLogins: 1
                    },
                    $addToSet: {
                        'profile.ipAddresses': clientIP,
                        'profile.userAgents': userAgent
                    }
                }
            );
            console.log(`📝 Updated profile for user: ${username}`);
        } else {
            // Create new profile
            await db.collection('user_profiles').insertOne({
                username,
                userUid,
                profile: {
                    firstSeen: now,
                    lastSeen: now,
                    totalLogins: 1,
                    totalPayments: 0,
                    totalAmountPaid: 0,
                    ipAddresses: [clientIP],
                    userAgents: [userAgent]
                },
                created: now,
                updated: now
            });
            console.log(`🆕 Created new profile for user: ${username}`);
        }
    } catch (error) {
        console.error('⚠️  Profile management failed:', error.message);
    }
}

async function logUserActivity(username, userUid, activityType, details = {}) {
    if (!db || !username) return;
    
    try {
        const activity = {
            username,
            userUid,
            activityType,
            timestamp: new Date(),
            details: {
                ...details,
                ip: details.ip || 'unknown',
                userAgent: details.userAgent || 'unknown'
            }
        };
        
        await db.collection('user_activities').insertOne(activity);
        console.log(`📋 Logged activity: ${activityType} for user: ${username}`);
    } catch (error) {
        console.error('⚠️  Activity logging failed:', error.message);
    }
}

// Subscription Management Functions
async function createSubscription(username, userUid, paymentId, txId, paymentData = {}) {
    if (!db || !username) return null;
    
    try {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30); // Add 30 days
        
        const subscription = {
            username,
            userUid,
            subscriptionType: "monthly",
            startDate,
            endDate,
            paymentId,
            txId,
            status: "active",
            piAmount: 1,
            paymentData,
            created: new Date(),
            lastVerified: new Date()
        };
        
        // Insert subscription record
        await db.collection('user_subscriptions').insertOne(subscription);
        
        // Update user profile with subscription info
        await db.collection('user_profiles').updateOne(
            { username },
            { 
                $set: { 
                    subscription: {
                        active: true,
                        type: "monthly",
                        startDate: startDate,
                        endDate: endDate,
                        daysRemaining: 30
                    },
                    updated: new Date()
                }
            }
        );
        
        // Log subscription creation activity
        await logUserActivity(username, userUid, 'subscription_created', {
            subscriptionType: 'monthly',
            duration: '30_days',
            paymentId: paymentId,
            txId: txId,
            endDate: endDate
        });
        
        console.log(`✅ Created 30-day subscription for user: ${username}, expires: ${endDate.toISOString()}`);
        return subscription;
        
    } catch (error) {
        console.error('⚠️  Subscription creation failed:', error.message);
        return null;
    }
}

async function verifyActiveSubscription(username) {
    if (!db || !username) return { subscribed: false };
    
    try {
        const subscription = await db.collection('user_subscriptions').findOne({
            username,
            status: "active",
            endDate: { $gt: new Date() } // Not expired
        });
        
        if (subscription) {
            const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
            return {
                subscribed: true,
                type: subscription.subscriptionType,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                daysRemaining: Math.max(0, daysRemaining),
                paymentId: subscription.paymentId
            };
        } else {
            return { subscribed: false };
        }
        
    } catch (error) {
        console.error('⚠️  Subscription verification failed:', error.message);
        return { subscribed: false, error: error.message };
    }
}

// Serve the HTML page
app.get('/', (req, res) => {
    // Log user session data
    if (db) {
        const clientIP = req.headers['x-forwarded-for'] || 
                        req.headers['x-real-ip'] || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress ||
                        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                        req.ip;

        const sessionData = {
            sessionId: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'page_visit',
            timestamp: new Date(),
            
            // User Information
            clientInfo: {
                ip: clientIP,
                userAgent: req.get('user-agent'),
                origin: req.get('origin'),
                referer: req.get('referer'),
                acceptLanguage: req.get('accept-language'),
                acceptEncoding: req.get('accept-encoding'),
                host: req.get('host'),
                connection: req.get('connection')
            },
            
            // Request Details
            requestInfo: {
                method: req.method,
                url: req.url,
                protocol: req.protocol,
                secure: req.secure,
                path: req.path,
                query: req.query,
                cookies: req.headers.cookie
            }
        };

        // Save session data asynchronously (don't block response)
        db.collection('sessions').insertOne(sessionData).catch(err => {
            console.error('⚠️  Session save failed:', err.message);
        });

        console.log(`🌐 Page visit from IP: ${clientIP} at ${new Date().toISOString()}`);
    }
    
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Approve payment endpoint
app.post('/approve-payment', async (req, res) => {
    const { paymentId } = req.body;
    
    console.log('=== PAYMENT APPROVAL REQUEST ===');
    console.log('Payment ID:', paymentId);
    console.log('PI_API_KEY set:', !!PI_API_KEY);
    console.log('Request origin:', req.get('origin'));
    
    // Add CORS headers explicitly
    res.header('Access-Control-Allow-Origin', req.get('origin'));
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (!paymentId) {
        console.error('No payment ID provided');
        return res.status(400).json({ success: false, error: 'Payment ID required' });
    }
    
    try {
        console.log('Calling Pi API to approve payment...');
        
        // Call Pi API to approve the payment
        const response = await fetch(`${PI_API_URL}/v2/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        console.log('Pi API response status:', response.status);
        console.log('Pi API response:', responseText);

        if (response.ok) {
            console.log('✅ Payment approved successfully');
            
            // Parse the response to extract user data
            const paymentData = JSON.parse(responseText);
            
            // Save comprehensive payment approval to MongoDB
            if (db) {
                try {
                    // Get client IP address
                    const clientIP = req.headers['x-forwarded-for'] || 
                                   req.headers['x-real-ip'] || 
                                   req.connection.remoteAddress || 
                                   req.socket.remoteAddress ||
                                   (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                                   req.ip;

                    const username = paymentData.metadata?.username || 'unknown';
                    const userUid = paymentData.user_uid;

                    // Update user profile for payment activity
                    if (username !== 'unknown') {
                        await createOrUpdateUserProfile(username, userUid, {
                            ip: clientIP,
                            userAgent: req.get('user-agent')
                        });

                        // Log payment approval activity
                        await logUserActivity(username, userUid, 'payment_approval', {
                            paymentId: paymentId,
                            amount: paymentData.amount,
                            memo: paymentData.memo,
                            ip: clientIP,
                            userAgent: req.get('user-agent'),
                            origin: req.get('origin')
                        });
                    }

                    const paymentRecord = {
                        paymentId,
                        status: 'approved',
                        timestamp: new Date(),
                        
                        // User Information
                        userInfo: {
                            username: username,
                            userUid: userUid,
                            piAddress: paymentData.from_address || 'pending'
                        },
                        
                        // Payment Details
                        paymentDetails: {
                            amount: paymentData.amount,
                            memo: paymentData.memo,
                            network: paymentData.network,
                            direction: paymentData.direction,
                            orderId: paymentData.metadata?.orderId,
                            metadata: paymentData.metadata // Store full metadata including auction info
                        },
                        
                        // Technical Information
                        technicalInfo: {
                            clientIP: clientIP,
                            userAgent: req.get('user-agent'),
                            origin: req.get('origin'),
                            referer: req.get('referer'),
                            acceptLanguage: req.get('accept-language'),
                            acceptEncoding: req.get('accept-encoding')
                        },
                        
                        // Pi API Response
                        apiResponse: responseText,
                        piApiStatus: paymentData.status
                    };

                    await db.collection('payments').insertOne(paymentRecord);
                    console.log('💾 Enhanced payment approval saved to database');
                    console.log(`👤 User: ${paymentRecord.userInfo.username} from IP: ${clientIP}`);
                    console.log(`📋 Profile and activity updated for payment approval: ${username}`);
                } catch (dbError) {
                    console.error('⚠️  Database save failed:', dbError.message);
                }
            }
            
            res.json({ success: true, message: 'Payment approved' });
        } else {
            console.error('❌ Payment approval failed:', response.status, responseText);
            res.status(400).json({ success: false, error: `Payment approval failed: ${responseText}` });
        }
        
    } catch (error) {
        console.error('❌ Error approving payment:', error.message);
        res.status(500).json({ success: false, error: `Internal server error: ${error.message}` });
    }
});

// Complete payment endpoint
app.post('/complete-payment', async (req, res) => {
    const { paymentId, txId } = req.body;
    
    console.log('=== PAYMENT COMPLETION REQUEST ===');
    console.log('Payment ID:', paymentId);
    console.log('Transaction ID:', txId);
    
    // Add CORS headers explicitly
    res.header('Access-Control-Allow-Origin', req.get('origin'));
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (!paymentId || !txId) {
        console.error('Missing payment ID or transaction ID');
        return res.status(400).json({ success: false, error: 'Payment ID and Transaction ID required' });
    }
    
    try {
        console.log('Calling Pi API to complete payment...');
        
        // Call Pi API to complete the payment
        const response = await fetch(`${PI_API_URL}/v2/payments/${paymentId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ txid: txId })
        });

        const responseText = await response.text();
        console.log('Pi API completion response status:', response.status);
        console.log('Pi API completion response:', responseText);

        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('✅ Payment completed successfully:', data);
            
            // Update payment completion in MongoDB with comprehensive data
            if (db) {
                try {
                    // Get client IP address
                    const clientIP = req.headers['x-forwarded-for'] || 
                                   req.headers['x-real-ip'] || 
                                   req.connection.remoteAddress || 
                                   req.socket.remoteAddress ||
                                   (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                                   req.ip;

                    // Get user info from the existing payment record
                    const existingPayment = await db.collection('payments').findOne({ paymentId });
                    const username = existingPayment?.userInfo?.username || 'unknown';
                    const userUid = existingPayment?.userInfo?.userUid;
                    const amount = data.amount || existingPayment?.paymentDetails?.amount || 0;

                    // Check if this is an auction winner payment (check this first)
                    const isAuctionPayment = data.metadata?.type === 'auction_winner_payment' ||
                                           data.memo?.includes('auction item') ||
                                           data.memo?.includes('won auction item') ||
                                           existingPayment?.paymentDetails?.memo?.includes('auction item') ||
                                           existingPayment?.paymentDetails?.metadata?.type === 'auction_winner_payment';

                    // Check if this is a subscription payment
                    const isSubscriptionPayment = data.metadata?.paymentType === 'monthly_subscription' || 
                                                 data.memo?.includes('subscription') ||
                                                 existingPayment?.paymentDetails?.memo?.includes('subscription') ||
                                                 data.memo?.includes('30-day') ||
                                                 data.memo?.includes('Appraisells') ||
                                                 (amount === 1 && !isAuctionPayment); // 1 Pi payments are subscription payments unless they're auction payments

                    console.log(`🔍 Payment type detection - Subscription: ${isSubscriptionPayment}, Auction: ${isAuctionPayment}`);
                    console.log(`🔍 DEBUG - Payment metadata:`, data.metadata);
                    console.log(`🔍 DEBUG - Payment memo:`, data.memo);
                    console.log(`🔍 DEBUG - Existing payment metadata:`, existingPayment?.paymentDetails?.metadata);

                    // Update user profile with completed payment stats
                    if (username !== 'unknown') {
                        // Update user profile payment totals
                        await db.collection('user_profiles').updateOne(
                            { username },
                            {
                                $inc: {
                                    'profile.totalPayments': 1,
                                    'profile.totalAmountPaid': amount
                                },
                                $set: {
                                    'profile.lastPayment': new Date(),
                                    updated: new Date()
                                }
                            }
                        );

                        // Log payment completion activity
                        await logUserActivity(username, userUid, 'payment_completion', {
                            paymentId: paymentId,
                            txId: txId,
                            amount: amount,
                            transactionVerified: data.status?.transaction_verified,
                            ip: clientIP,
                            userAgent: req.get('user-agent'),
                            transactionLink: data.transaction?._link,
                            isSubscription: isSubscriptionPayment,
                            isAuction: isAuctionPayment
                        });

                        // Handle auction winner payment completion
                        if (isAuctionPayment) {
                            console.log('🏆 Processing auction winner payment completion...');
                            try {
                                // Extract auction metadata from payment - check multiple sources
                                const auctionData = data.metadata || 
                                                  existingPayment?.paymentDetails?.metadata || 
                                                  {};
                                
                                let winnerId = auctionData.winnerId;
                                let itemId = auctionData.itemId;
                                const auctionId = auctionData.auctionId || 'auction_1';

                                // If metadata is missing, try to extract from memo
                                if (!winnerId && data.memo) {
                                    const memoMatch = data.memo.match(/won auction item: (\w+)/);
                                    if (memoMatch) {
                                        itemId = memoMatch[1];
                                        
                                        // Find the winner record by itemId and username
                                        const winnersCollection = db.collection('auction_winners');
                                        const winnerRecord = await winnersCollection.findOne({
                                            winnerUsername: username,
                                            itemId: itemId,
                                            paymentStatus: 'pending'
                                        });
                                        
                                        if (winnerRecord) {
                                            winnerId = winnerRecord._id.toString();
                                            console.log(`🔍 DEBUG - Found winner record via memo: ${winnerId} for ${itemId}`);
                                        }
                                    }
                                }

                                console.log(`🔍 Auction payment data - Winner ID: ${winnerId}, Item: ${itemId}, Auction: ${auctionId}`);

                                if (winnerId) {
                                    // Update auction winner record with payment completion
                                    const { ObjectId } = require('mongodb');
                                    
                                    console.log(`🔍 DEBUG - Attempting to update winner record with ID: ${winnerId}`);
                                    
                                    const updateResult = await db.collection('auction_winners').updateOne(
                                        { _id: new ObjectId(winnerId) },
                                        {
                                            $set: {
                                                paymentStatus: 'paid',
                                                paymentId: paymentId,
                                                txId: txId,
                                                paidAmount: amount,
                                                paidAt: new Date(),
                                                digitalArtStatus: 'ready_for_delivery', // Digital art is ready immediately
                                                completionDetails: {
                                                    transactionVerified: data.status?.transaction_verified,
                                                    transactionLink: data.transaction?._link,
                                                    fromAddress: data.from_address,
                                                    toAddress: data.to_address
                                                }
                                            }
                                        }
                                    );

                                    console.log(`🔍 DEBUG - Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);

                                    if (updateResult.modifiedCount > 0) {
                                        console.log(`✅ Auction winner payment completed for ${username} - Item: ${itemId}`);
                                        
                                        // Log auction-specific activity
                                        await logUserActivity(username, userUid, 'auction_payment_completed', {
                                            winnerId: winnerId,
                                            itemId: itemId,
                                            auctionId: auctionId,
                                            paidAmount: amount,
                                            paymentId: paymentId,
                                            txId: txId,
                                            digitalArtReady: true
                                        });

                                        // Create digital art delivery record
                                        await db.collection('digital_art_delivery').insertOne({
                                            winnerId: new ObjectId(winnerId),
                                            username: username,
                                            userUid: userUid,
                                            itemId: itemId,
                                            auctionId: auctionId,
                                            deliveryStatus: 'ready', // ready, delivered, accessed
                                            paymentDetails: {
                                                paymentId: paymentId,
                                                txId: txId,
                                                paidAmount: amount,
                                                paidAt: new Date()
                                            },
                                            digitalAsset: {
                                                // These will be populated based on itemId
                                                title: getArtTitle(itemId),
                                                artist: getArtArtist(itemId),
                                                description: getArtDescription(itemId),
                                                highResUrl: null, // To be set when digital files are uploaded
                                                downloadUrl: null,
                                                licenseType: 'personal_use' // or 'commercial_use' based on auction
                                            },
                                            createdAt: new Date(),
                                            accessLog: []
                                        });

                                        console.log(`🎨 Digital art delivery record created for ${itemId}`);
                                        
                                    } else {
                                        console.error(`⚠️ Failed to update auction winner record for winner ID: ${winnerId}`);
                                    }
                                } else {
                                    console.error('⚠️ Auction payment detected but no winner ID found in metadata');
                                }
                            } catch (auctionError) {
                                console.error('❌ Error processing auction payment completion:', auctionError);
                            }
                        }

                        // Create subscription if this is a subscription payment
                        if (isSubscriptionPayment) {
                            const subscription = await createSubscription(username, userUid, paymentId, txId, data);
                            if (subscription) {
                                console.log(`🎫 Subscription created for user: ${username}, expires: ${subscription.endDate.toISOString()}`);
                            } else {
                                console.error('⚠️  Failed to create subscription for completed payment');
                            }
                        }
                    }

                    await db.collection('payments').updateOne(
                        { paymentId },
                        { 
                            $set: { 
                                status: 'completed', 
                                txId, 
                                completedAt: new Date(),
                                
                                // Enhanced completion data
                                completionDetails: {
                                    transactionVerified: data.status?.transaction_verified,
                                    developerCompleted: data.status?.developer_completed,
                                    fromAddress: data.from_address,
                                    toAddress: data.to_address,
                                    transactionLink: data.transaction?._link,
                                    finalAmount: data.amount,
                                    completionIP: clientIP,
                                    completionUserAgent: req.get('user-agent')
                                },
                                
                                completionData: data
                            } 
                        }
                    );
                    console.log('💾 Enhanced payment completion saved to database');
                    console.log(`🔗 Transaction: ${txId} verified: ${data.status?.transaction_verified}`);
                    console.log(`📋 Profile updated with completed payment for user: ${username}`);
                } catch (dbError) {
                    console.error('⚠️  Database update failed:', dbError.message);
                }
            }
            
            res.json({ success: true, message: 'Payment completed', data });
        } else {
            console.error('❌ Payment completion failed:', response.status, responseText);
            res.status(400).json({ success: false, error: `Payment completion failed: ${responseText}` });
        }
        
    } catch (error) {
        console.error('❌ Error completing payment:', error.message);
        res.status(500).json({ success: false, error: `Internal server error: ${error.message}` });
    }
});

// Helper functions for auction art information
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

function getArtArtist(itemId) {
    // All current items are by Hanoi Boi
    return 'Hanoi Boi';
}

function getArtDescription(itemId) {
    const descriptions = {
        'art_piece_1': 'Original digital artwork "Chomp Bomper One" by Hanoi Boi',
        'art_piece_2': 'Original digital artwork "Chomp Bomper Two" by Hanoi Boi',
        'art_piece_3': 'Original digital artwork "Chomp Bomper Three" by Hanoi Boi', 
        'art_piece_4': 'Original digital artwork "Chomp Bomper Four" by Hanoi Boi',
        'art_piece_5': 'Original digital artwork "Chomp Bomper Five" by Hanoi Boi'
    };
    return descriptions[itemId] || 'Original digital artwork';
}

// Get user's digital art collection
app.get('/user-digital-art/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log(`🎨 Getting digital art collection for user: ${username}`);
        
        const artCollection = await db.collection('digital_art_delivery').find({ 
            username: username 
        }).sort({ createdAt: -1 }).toArray();
        
        console.log(`🔍 Found ${artCollection.length} digital art items for ${username}`);
        
        res.json({ 
            success: true, 
            username: username,
            artCount: artCollection.length,
            digitalArt: artCollection.map(art => ({
                id: art._id,
                itemId: art.itemId,
                title: art.digitalAsset.title,
                artist: art.digitalAsset.artist,
                description: art.digitalAsset.description,
                deliveryStatus: art.deliveryStatus,
                paidAmount: art.paymentDetails.paidAmount,
                paidAt: art.paymentDetails.paidAt,
                auctionId: art.auctionId,
                canDownload: art.deliveryStatus === 'ready' || art.deliveryStatus === 'delivered',
                accessCount: art.accessLog.length
            }))
        });
        
    } catch (error) {
        console.error('❌ Error getting user digital art:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Access digital art (mark as accessed and provide download info)
app.post('/access-digital-art/:artId', async (req, res) => {
    try {
        const { artId } = req.params;
        const { username } = req.body;
        
        console.log(`🎨 User ${username} accessing digital art: ${artId}`);
        
        const { ObjectId } = require('mongodb');
        
        // Find the art record
        const artRecord = await db.collection('digital_art_delivery').findOne({
            _id: new ObjectId(artId),
            username: username
        });
        
        if (!artRecord) {
            return res.status(404).json({ 
                success: false, 
                error: 'Digital art not found or not owned by user' 
            });
        }
        
        if (artRecord.deliveryStatus !== 'ready' && artRecord.deliveryStatus !== 'delivered') {
            return res.status(400).json({ 
                success: false, 
                error: 'Digital art is not ready for access' 
            });
        }
        
        // Log the access
        await db.collection('digital_art_delivery').updateOne(
            { _id: new ObjectId(artId) },
            { 
                $push: {
                    accessLog: {
                        accessedAt: new Date(),
                        ip: req.ip,
                        userAgent: req.get('user-agent')
                    }
                },
                $set: {
                    deliveryStatus: 'delivered', // Mark as delivered on first access
                    lastAccessed: new Date()
                }
            }
        );
        
        // Log user activity
        await logUserActivity(username, artRecord.userUid, 'digital_art_accessed', {
            artId: artId,
            itemId: artRecord.itemId,
            title: artRecord.digitalAsset.title,
            artist: artRecord.digitalAsset.artist
        });
        
        console.log(`✅ Digital art access logged for ${username} - ${artRecord.digitalAsset.title}`);
        
        res.json({ 
            success: true,
            message: 'Digital art accessed successfully',
            artInfo: {
                title: artRecord.digitalAsset.title,
                artist: artRecord.digitalAsset.artist,
                description: artRecord.digitalAsset.description,
                licenseType: artRecord.digitalAsset.licenseType,
                // In a real implementation, these would be secure download URLs
                downloadInstructions: `Your digital art "${artRecord.digitalAsset.title}" is ready! Please contact support for high-resolution file delivery.`,
                deliveryNote: 'High-resolution files will be delivered via secure link within 24 hours of payment.'
            }
        });
        
    } catch (error) {
        console.error('❌ Error accessing digital art:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// User authentication tracking endpoint
app.post('/log-auth', async (req, res) => {
    const { username, userUid, authSuccess } = req.body;
    
    if (db) {
        try {
            const clientIP = req.headers['x-forwarded-for'] || 
                            req.headers['x-real-ip'] || 
                            req.connection.remoteAddress || 
                            req.socket.remoteAddress ||
                            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                            req.ip;

            // Create or update user profile
            await createOrUpdateUserProfile(username, userUid, {
                ip: clientIP,
                userAgent: req.get('user-agent')
            });

            // Log authentication activity
            await logUserActivity(username, userUid, 'authentication', {
                authSuccess: authSuccess,
                ip: clientIP,
                userAgent: req.get('user-agent'),
                origin: req.get('origin'),
                referer: req.get('referer')
            });

            // Also keep old format for backward compatibility
            const authRecord = {
                type: 'user_authentication',
                timestamp: new Date(),
                
                // User Information
                userInfo: {
                    username: username || 'unknown',
                    userUid: userUid || 'unknown',
                    authSuccess: authSuccess
                },
                
                // Technical Information
                technicalInfo: {
                    clientIP: clientIP,
                    userAgent: req.get('user-agent'),
                    origin: req.get('origin'),
                    referer: req.get('referer')
                }
            };

            await db.collection('user_sessions').insertOne(authRecord);
            console.log(`🔐 User authentication logged: ${username} from IP: ${clientIP}`);
            console.log(`📋 Profile and activity updated for user: ${username}`);
            
            res.json({ success: true, message: 'Authentication logged' });
        } catch (error) {
            console.error('⚠️  Auth logging failed:', error.message);
            res.status(500).json({ success: false, error: 'Failed to log authentication' });
        }
    } else {
        res.status(503).json({ success: false, error: 'Database not connected' });
    }
});

// Get payment history from database
app.get('/payments', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const payments = await db.collection('payments').find().sort({ timestamp: -1 }).toArray();
        res.json({ 
            success: true, 
            count: payments.length,
            payments 
        });
    } catch (error) {
        console.error('❌ Failed to fetch payments:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch payments' 
        });
    }
});

// Get session data from database
app.get('/sessions', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const sessions = await db.collection('sessions').find().sort({ timestamp: -1 }).limit(50).toArray();
        const userSessions = await db.collection('user_sessions').find().sort({ timestamp: -1 }).limit(50).toArray();
        
        res.json({ 
            success: true, 
            pageVisits: {
                count: sessions.length,
                data: sessions
            },
            userAuthentications: {
                count: userSessions.length,
                data: userSessions
            }
        });
    } catch (error) {
        console.error('❌ Failed to fetch sessions:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch sessions' 
        });
    }
});

// Get comprehensive analytics
app.get('/analytics', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const [payments, sessions, userSessions] = await Promise.all([
            db.collection('payments').find().toArray(),
            db.collection('sessions').find().toArray(),
            db.collection('user_sessions').find().toArray()
        ]);

        // Calculate analytics
        const analytics = {
            overview: {
                totalPayments: payments.length,
                completedPayments: payments.filter(p => p.status === 'completed').length,
                totalPageVisits: sessions.length,
                totalAuthentications: userSessions.length,
                uniqueUsers: [...new Set(payments.map(p => p.userInfo?.username).filter(Boolean))].length
            },
            
            recentActivity: {
                lastPayment: payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0],
                lastVisit: sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0],
                lastAuth: userSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
            },
            
            users: payments.reduce((acc, payment) => {
                const username = payment.userInfo?.username || 'unknown';
                if (!acc[username]) {
                    acc[username] = {
                        totalPayments: 0,
                        totalAmount: 0,
                        firstSeen: payment.timestamp,
                        lastSeen: payment.timestamp
                    };
                }
                acc[username].totalPayments++;
                acc[username].totalAmount += payment.paymentDetails?.amount || 0;
                if (new Date(payment.timestamp) > new Date(acc[username].lastSeen)) {
                    acc[username].lastSeen = payment.timestamp;
                }
                return acc;
            }, {})
        };

        res.json({ 
            success: true, 
            analytics
        });
    } catch (error) {
        console.error('❌ Failed to fetch analytics:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch analytics' 
        });
    }
});

// Get user profiles from database
app.get('/user-profiles', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const profiles = await db.collection('user_profiles').find().sort({ 'profile.lastSeen': -1 }).toArray();
        res.json({ 
            success: true, 
            count: profiles.length,
            profiles 
        });
    } catch (error) {
        console.error('❌ Failed to fetch user profiles:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch user profiles' 
        });
    }
});

// Get user activities from database
app.get('/user-activities', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username, limit = 100 } = req.query;
        let query = {};
        
        if (username) {
            query.username = username;
        }

        const activities = await db.collection('user_activities')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();
            
        res.json({ 
            success: true, 
            count: activities.length,
            username: username || 'all users',
            activities 
        });
    } catch (error) {
        console.error('❌ Failed to fetch user activities:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch user activities' 
        });
    }
});

// Get specific user profile and activities
app.get('/user/:username', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username } = req.params;
        const { activityLimit = 50 } = req.query;

        const profile = await db.collection('user_profiles').findOne({ username });
        const activities = await db.collection('user_activities')
            .find({ username })
            .sort({ timestamp: -1 })
            .limit(parseInt(activityLimit))
            .toArray();

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'User profile not found'
            });
        }

        res.json({ 
            success: true, 
            user: {
                profile,
                recentActivities: activities,
                activityCount: activities.length
            }
        });
    } catch (error) {
        console.error('❌ Failed to fetch user details:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch user details' 
        });
    }
});

// Subscription Status API Endpoints

// Check subscription status for a user
app.get('/subscription-status/:username', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username } = req.params;
        console.log(`🔍 Checking subscription status for: ${username}`);
        
        const subscriptionStatus = await verifyActiveSubscription(username);
        console.log(`📊 Subscription result for ${username}:`, subscriptionStatus);
        
        res.json({ 
            success: true, 
            ...subscriptionStatus
        });
    } catch (error) {
        console.error('❌ Failed to check subscription status:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check subscription status' 
        });
    }
});

// Create user profile from Pi authentication (called when user first logs in)
app.post('/create-user-profile', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username, userUid, wallet } = req.body;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username is required' 
            });
        }
        
        console.log(`👤 Creating/updating user profile for: ${username}`);
        
        // Check if profile already exists
        const existingProfile = await db.collection('user_profiles').findOne({ username });
        
        if (existingProfile) {
            // Update existing profile with latest login
            await db.collection('user_profiles').updateOne(
                { username },
                { 
                    $set: {
                        'profile.lastSeen': new Date(),
                        'profile.totalLogins': (existingProfile.profile?.totalLogins || 0) + 1,
                        userUid: userUid || existingProfile.userUid,
                        wallet: wallet || existingProfile.wallet,
                        updated: new Date()
                    }
                }
            );
            
            console.log(`✅ Updated existing profile for: ${username}`);
        } else {
            // Create new profile
            await db.collection('user_profiles').insertOne({
                username,
                userUid: userUid || 'pi_network_user',
                wallet: wallet || null,
                profile: {
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    totalLogins: 1,
                    totalPayments: 0,
                    totalAmountPaid: 0,
                    lastPayment: null,
                    ipAddresses: [],
                    userAgents: []
                },
                created: new Date(),
                updated: new Date(),
                source: 'pi_network_authentication'
            });
            
            console.log(`✅ Created new profile for: ${username}`);
        }
        
        // Log authentication activity
        await logUserActivity(username, userUid, 'authentication', {
            source: 'pi_network',
            wallet: wallet,
            timestamp: new Date()
        });
        
        res.json({ 
            success: true, 
            message: 'User profile created/updated successfully',
            username 
        });
        
    } catch (error) {
        console.error('❌ Failed to create user profile:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create user profile' 
        });
    }
});

// Get all subscriptions (admin endpoint)
app.get('/subscriptions', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const subscriptions = await db.collection('user_subscriptions')
            .find()
            .sort({ created: -1 })
            .toArray();
            
        const activeSubscriptions = subscriptions.filter(sub => 
            sub.status === 'active' && sub.endDate > new Date()
        );
        
        res.json({ 
            success: true, 
            total: subscriptions.length,
            active: activeSubscriptions.length,
            subscriptions 
        });
    } catch (error) {
        console.error('❌ Failed to fetch subscriptions:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch subscriptions' 
        });
    }
});

// ===== SUBSCRIPTION MANAGEMENT ENDPOINTS =====

// Get subscription overview/dashboard
app.get('/subscriptions/overview', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const subscriptions = await db.collection('user_subscriptions').find().toArray();
        const now = new Date();
        
        // Calculate statistics
        const stats = {
            total: subscriptions.length,
            active: subscriptions.filter(sub => sub.isActive && new Date(sub.endDate) > now).length,
            expired: subscriptions.filter(sub => new Date(sub.endDate) <= now).length,
            inactive: subscriptions.filter(sub => !sub.isActive).length,
            totalRevenue: subscriptions.filter(sub => sub.isActive).length * 1, // 1 Pi per subscription
            thisMonth: subscriptions.filter(sub => {
                const subDate = new Date(sub.startDate);
                const thisMonth = new Date();
                return subDate.getMonth() === thisMonth.getMonth() && subDate.getFullYear() === thisMonth.getFullYear();
            }).length
        };
        
        // Recent subscriptions (last 10)
        const recentSubscriptions = subscriptions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .map(sub => ({
                username: sub.username,
                startDate: sub.startDate,
                endDate: sub.endDate,
                isActive: sub.isActive,
                daysRemaining: Math.max(0, Math.ceil((new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24))),
                paymentId: sub.paymentId
            }));
        
        res.json({ 
            success: true, 
            stats,
            recentSubscriptions
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch subscription overview:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch subscription overview' 
        });
    }
});

// Get subscription by ID
app.get('/subscriptions/:subscriptionId', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { subscriptionId } = req.params;
        const subscription = await db.collection('user_subscriptions').findOne({ 
            $or: [
                { _id: subscriptionId },
                { paymentId: subscriptionId }
            ]
        });
        
        if (!subscription) {
            return res.status(404).json({ 
                success: false, 
                error: 'Subscription not found' 
            });
        }
        
        // Calculate additional details
        const now = new Date();
        const endDate = new Date(subscription.endDate);
        const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        const isExpired = endDate <= now;
        
        res.json({ 
            success: true, 
            subscription: {
                ...subscription,
                daysRemaining,
                isExpired,
                status: isExpired ? 'expired' : (subscription.isActive ? 'active' : 'inactive')
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch subscription:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch subscription' 
        });
    }
});

// Update subscription status (admin)
app.put('/subscriptions/:subscriptionId', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { subscriptionId } = req.params;
        const { isActive, endDate, notes } = req.body;
        
        const updateData = {
            updatedAt: new Date()
        };
        
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (endDate) updateData.endDate = new Date(endDate);
        if (notes) updateData.adminNotes = notes;
        
        const result = await db.collection('user_subscriptions').updateOne(
            { 
                $or: [
                    { _id: subscriptionId },
                    { paymentId: subscriptionId }
                ]
            },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Subscription not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Subscription updated successfully',
            updated: result.modifiedCount > 0
        });
        
    } catch (error) {
        console.error('❌ Failed to update subscription:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update subscription' 
        });
    }
});

// Delete subscription (admin)
app.delete('/subscriptions/:subscriptionId', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { subscriptionId } = req.params;
        
        const result = await db.collection('user_subscriptions').deleteOne({ 
            $or: [
                { _id: subscriptionId },
                { paymentId: subscriptionId }
            ]
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Subscription not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Subscription deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Failed to delete subscription:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete subscription' 
        });
    }
});

// Get expiring subscriptions (within next 7 days)
app.get('/subscriptions/expiring/soon', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const expiringSubscriptions = await db.collection('user_subscriptions')
            .find({
                isActive: true,
                endDate: {
                    $gte: now,
                    $lte: sevenDaysFromNow
                }
            })
            .sort({ endDate: 1 })
            .toArray();
        
        const subscriptionsWithDays = expiringSubscriptions.map(sub => ({
            ...sub,
            daysRemaining: Math.ceil((new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24))
        }));
        
        res.json({ 
            success: true, 
            count: expiringSubscriptions.length,
            subscriptions: subscriptionsWithDays
        });
        
    } catch (error) {
        console.error('❌ Failed to fetch expiring subscriptions:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch expiring subscriptions' 
        });
    }
});

// TEST ENDPOINT - Create test subscription for debugging
app.post('/test-create-subscription', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username is required' 
            });
        }
        
        console.log(`🧪 Creating TEST subscription for: ${username}`);
        
        // Create a test subscription
        const subscription = {
            username,
            paymentId: `test-subscription-${Date.now()}`,
            subscriptionType: "monthly",
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            isActive: true,
            status: "active",
            createdAt: new Date(),
            testSubscription: true // Mark as test
        };
        
        await db.collection('user_subscriptions').insertOne(subscription);
        console.log(`✅ TEST subscription created for: ${username}`);
        
        res.json({ 
            success: true, 
            message: 'Test subscription created successfully',
            subscription
        });
        
    } catch (error) {
        console.error('❌ Failed to create test subscription:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create test subscription' 
        });
    }
});

// Manual migration endpoint
app.post('/migrate-data', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        console.log('🔄 Manual migration triggered...');
        await migrateExistingData();
        res.json({ 
            success: true, 
            message: 'Data migration completed successfully' 
        });
    } catch (error) {
        console.error('❌ Manual migration failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Migration failed: ' + error.message 
        });
    }
});

// ========================================
// AUCTION BIDDING ENDPOINTS
// ========================================

// Get user's auction bids
app.get('/auction-bids/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`📊 Getting auction bids for user: ${username}`);
        
        const userBids = await db.collection('auction_bids').find({ 
            username: username 
        }).toArray();
        
        console.log(`📊 Found ${userBids.length} bids for ${username}`);
        res.json(userBids);
        
    } catch (error) {
        console.error('❌ Error getting auction bids:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Place an auction bid
app.post('/place-auction-bid', async (req, res) => {
    try {
        const { username, userUid, itemId, bidAmount, timestamp } = req.body;
        
        console.log(`🎯 Processing bid: ${username} bidding ${bidAmount} Pi on ${itemId}`);
        
        // Validate required fields
        if (!username || !userUid || !itemId || !bidAmount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: username, userUid, itemId, bidAmount' 
            });
        }
        
        // Validate minimum bid amount
        if (bidAmount < 3) {
            return res.status(400).json({ 
                success: false, 
                error: 'Minimum bid amount is 3 Pi' 
            });
        }
        
        // Check if user already has a bid for this item
        const existingUserBid = await db.collection('auction_bids').findOne({
            username: username,
            itemId: itemId
        });
        
        if (existingUserBid) {
            console.log(`❌ User ${username} already has a bid on ${itemId}`);
            return res.status(400).json({ 
                success: false, 
                error: 'You have already placed a bid on this item' 
            });
        }
        
        // Check if the exact bid amount already exists for this item
        const existingBidAmount = await db.collection('auction_bids').findOne({
            itemId: itemId,
            bidAmount: bidAmount
        });
        
        if (existingBidAmount) {
            console.log(`❌ Bid amount ${bidAmount} already exists for ${itemId}`);
            return res.status(400).json({ 
                success: false, 
                error: `Bid amount ${bidAmount} Pi already exists for this item. Please enter a different amount.` 
            });
        }
        
        // Check if auction is currently active
        const auctionStatus = await getAuctionStatus();
        if (!auctionStatus.isActive) {
            return res.status(400).json({ 
                success: false, 
                error: auctionStatus.message 
            });
        }
        
        // Create bid record
        const bidRecord = {
            username: username,
            userUid: userUid,
            itemId: itemId,
            bidAmount: parseFloat(bidAmount),
            timestamp: timestamp || new Date().toISOString(),
            auctionId: 'auction_1', // For future multiple auctions
            status: 'active',
            createdAt: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        };
        
        // Insert bid into database
        await db.collection('auction_bids').insertOne(bidRecord);
        
        console.log(`✅ Bid placed successfully: ${username} - ${bidAmount} Pi on ${itemId}`);
        
        // DEBUG: Check total bids after this insertion
        const totalBids = await db.collection('auction_bids').countDocuments({ auctionId: 'auction_1', status: 'active' });
        console.log(`🔍 DEBUG - Total active bids for auction_1: ${totalBids}`);
        
        // Log activity
        await db.collection('user_activities').insertOne({
            username: username,
            userUid: userUid,
            action: 'auction_bid_placed',
            details: {
                itemId: itemId,
                bidAmount: bidAmount,
                auctionId: 'auction_1'
            },
            timestamp: new Date(),
            ipAddress: req.ip
        });
        
        res.json({ 
            success: true, 
            message: 'Bid placed successfully',
            bidId: bidRecord._id,
            bidAmount: bidAmount,
            itemId: itemId
        });
        
    } catch (error) {
        console.error('❌ Error placing auction bid:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get auction status and timing
app.get('/auction-status', async (req, res) => {
    try {
        const auctionStatus = await getAuctionStatus();
        res.json(auctionStatus);
    } catch (error) {
        console.error('❌ Error getting auction status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current highest bids for all items
app.get('/auction-highest-bids', async (req, res) => {
    try {
        console.log('📊 Getting highest bids for all auction items...');
        
        const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
        const highestBids = {};
        
        for (const itemId of items) {
            const highestBid = await db.collection('auction_bids')
                .findOne({ itemId: itemId }, { sort: { bidAmount: -1 } });
            
            highestBids[itemId] = highestBid || { bidAmount: 0, username: null };
        }
        
        console.log('📊 Current highest bids:', highestBids);
        res.json({ success: true, highestBids: highestBids });
        
    } catch (error) {
        console.error('❌ Error getting highest bids:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Close auction and determine winners (admin endpoint)
app.post('/close-auction', async (req, res) => {
    try {
        console.log('🏁 Closing auction and determining winners...');
        
        const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
        const winners = {};
        
        for (const itemId of items) {
            const highestBid = await db.collection('auction_bids')
                .findOne({ itemId: itemId }, { sort: { bidAmount: -1 } });
            
            if (highestBid) {
                winners[itemId] = {
                    winner: highestBid.username,
                    winningBid: highestBid.bidAmount,
                    userUid: highestBid.userUid,
                    bidId: highestBid._id
                };
                
                // Mark the winning bid
                await db.collection('auction_bids').updateOne(
                    { _id: highestBid._id },
                    { $set: { status: 'winner', closedAt: new Date() } }
                );
                
                // Mark all other bids for this item as 'lost'
                await db.collection('auction_bids').updateMany(
                    { itemId: itemId, _id: { $ne: highestBid._id } },
                    { $set: { status: 'lost', closedAt: new Date() } }
                );
            }
        }
        
        // Create auction results record
        await db.collection('auction_results').insertOne({
            auctionId: 'auction_1',
            winners: winners,
            closedAt: new Date(),
            status: 'closed'
        });
        
        console.log('🏆 Auction closed successfully. Winners:', winners);
        res.json({ success: true, winners: winners });
        
    } catch (error) {
        console.error('❌ Error closing auction:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// AUCTION WINNER MANAGEMENT ENDPOINTS
// =============================================================================

// Calculate auction winners (admin endpoint)
app.post('/calculate-winners/:auctionId', async (req, res) => {
    try {
        const { auctionId } = req.params;
        
        console.log(`🔍 DEBUG - Manual winner calculation requested for: ${auctionId}`);
        
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        // Check current bid count before calculation
        const bidsCollection = db.collection('auction_bids');
        const totalBids = await bidsCollection.countDocuments({ auctionId: auctionId, status: 'active' });
        console.log(`🔍 DEBUG - Found ${totalBids} active bids for ${auctionId} before calculation`);
        
        console.log(`🏆 Calculating winners for auction: ${auctionId}`);
        
        const result = await winnerManager.calculateAuctionWinners(auctionId);
        
        console.log(`🔍 DEBUG - Manual calculation result:`, result);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error calculating winners:', error);
        console.error('❌ Error details:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get/trigger auction winner calculation (GET endpoint for frontend debugging)
app.get('/calculate-winners/:auctionId', async (req, res) => {
    try {
        const { auctionId } = req.params;
        
        console.log(`🔍 DEBUG - Frontend winner check requested for: ${auctionId}`);
        
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        // First check if winners already exist
        const winnersCollection = db.collection('auction_winners');
        const existingWinners = await winnersCollection.find({ auctionId: auctionId }).toArray();
        
        if (existingWinners.length > 0) {
            console.log(`🔍 DEBUG - Found ${existingWinners.length} existing winners for ${auctionId}`);
            return res.json({ 
                success: true, 
                winnersCount: existingWinners.length,
                winners: existingWinners.map(w => ({
                    itemId: w.itemId,
                    winner: w.winnerUsername,
                    winningBid: w.winningBid
                })),
                message: 'Winners already calculated'
            });
        }
        
        // No winners exist, calculate them
        const bidsCollection = db.collection('auction_bids');
        const totalBids = await bidsCollection.countDocuments({ auctionId: auctionId, status: 'active' });
        console.log(`🔍 DEBUG - No existing winners, found ${totalBids} active bids for calculation`);
        
        const result = await winnerManager.calculateAuctionWinners(auctionId);
        console.log(`🔍 DEBUG - Frontend-triggered calculation result:`, result);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in frontend winner check:', error);
        console.error('❌ Error details:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get winners for a specific auction
app.get('/auction-winners/:auctionId', async (req, res) => {
    try {
        const { auctionId } = req.params;
        
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        const winners = await winnerManager.getAuctionWinners(auctionId);
        
        res.json({ success: true, winners: winners });
        
    } catch (error) {
        console.error('❌ Error getting auction winners:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's won items
app.get('/user-wins/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log(`🔍 DEBUG - Checking wins for user: ${username}`);
        
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        // Debug: Check auction_winners collection directly
        const winnersCollection = db.collection('auction_winners');
        const allWinners = await winnersCollection.find({}).toArray();
        console.log(`🔍 DEBUG - Total winners in database: ${allWinners.length}`);
        
        const userWinners = await winnersCollection.find({ winnerUsername: username }).toArray();
        console.log(`🔍 DEBUG - Direct database query found ${userWinners.length} wins for ${username}`);
        
        if (userWinners.length > 0) {
            console.log(`🔍 DEBUG - User wins from database:`, userWinners.map(w => ({
                itemId: w.itemId,
                winningBid: w.winningBid,
                paymentStatus: w.paymentStatus
            })));
        }
        
        const userWins = await winnerManager.getUserWins(username);
        
        console.log(`🔍 DEBUG - Winner manager returned ${userWins ? userWins.length : 0} wins for ${username}`);
        
        res.json({ success: true, wins: userWins });
        
    } catch (error) {
        console.error('❌ Error getting user wins:', error);
        console.error('❌ Error details:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Process payment for won item
app.post('/pay-auction-win', async (req, res) => {
    try {
        const { auctionId, itemId, paymentId, txId } = req.body;
        
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        if (!auctionId || !itemId || !paymentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: auctionId, itemId, paymentId' 
            });
        }
        
        console.log(`💰 Processing payment for ${auctionId}/${itemId}: ${paymentId}`);
        
        const result = await winnerManager.processWinnerPayment(auctionId, itemId, paymentId, txId);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error processing winner payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending payments (for deadline management)
app.get('/pending-payments', async (req, res) => {
    try {
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        const pendingPayments = await winnerManager.getPendingPayments();
        
        res.json({ success: true, pendingPayments: pendingPayments });
        
    } catch (error) {
        console.error('❌ Error getting pending payments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark expired payments (admin endpoint)
app.post('/mark-expired-payments', async (req, res) => {
    try {
        if (!winnerManager) {
            throw new Error('Winner management system not initialized');
        }
        
        const expiredCount = await winnerManager.markExpiredPayments();
        
        res.json({ success: true, expiredCount: expiredCount });
        
    } catch (error) {
        console.error('❌ Error marking expired payments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DEBUG: Get all auction data (for troubleshooting)
app.get('/debug/auction-data', async (req, res) => {
    try {
        console.log('🔍 DEBUG - Auction data debug endpoint called');
        
        const bidsCollection = db.collection('auction_bids');
        const winnersCollection = db.collection('auction_winners');
        
        const allBids = await bidsCollection.find({ auctionId: 'auction_1' }).toArray();
        const allWinners = await winnersCollection.find({ auctionId: 'auction_1' }).toArray();
        
        const auctionStatus = await getAuctionStatus();
        
        const debugData = {
            auctionStatus: auctionStatus,
            totalBids: allBids.length,
            bids: allBids.map(bid => ({
                username: bid.username,
                itemId: bid.itemId,
                bidAmount: bid.bidAmount,
                timestamp: bid.timestamp,
                status: bid.status
            })),
            totalWinners: allWinners.length,
            winners: allWinners.map(winner => ({
                winnerUsername: winner.winnerUsername,
                itemId: winner.itemId,
                winningBid: winner.winningBid,
                paymentStatus: winner.paymentStatus
            }))
        };
        
        console.log('🔍 DEBUG - Auction data:', debugData);
        
        res.json({ success: true, debug: debugData });
        
    } catch (error) {
        console.error('❌ Error getting debug auction data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's purchased digital art
app.get('/my-digital-art/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log(`🎨 Getting digital art for user: ${username}`);
        
        // Get all paid auction wins for this user
        const winnersCollection = db.collection('auction_winners');
        const paidWins = await winnersCollection.find({ 
            winnerUsername: username,
            paymentStatus: 'paid' 
        }).toArray();
        
        console.log(`🔍 Found ${paidWins.length} paid wins for ${username}`);
        
        // Get digital art delivery records
        const deliveryCollection = db.collection('digital_art_delivery');
        const digitalArt = await Promise.all(paidWins.map(async (win) => {
            const deliveryRecord = await deliveryCollection.findOne({ winnerId: win._id });
            
            return {
                _id: win._id,
                itemId: win.itemId,
                auctionId: win.auctionId,
                winningBid: win.winningBid,
                paidAt: win.paidAt,
                digitalAsset: {
                    title: getArtTitle(win.itemId),
                    artist: getArtArtist(win.itemId),
                    description: getArtDescription(win.itemId),
                    highResUrl: deliveryRecord?.digitalAsset?.highResUrl || '/placeholder-art.jpg',
                    downloadUrl: deliveryRecord?.digitalAsset?.downloadUrl || null,
                    licenseType: deliveryRecord?.digitalAsset?.licenseType || 'personal_use'
                },
                deliveryStatus: deliveryRecord?.deliveryStatus || 'ready',
                accessCount: deliveryRecord?.accessLog?.length || 0,
                lastAccessed: deliveryRecord?.accessLog?.slice(-1)[0]?.accessedAt || null
            };
        }));
        
        // Log access activity
        await logUserActivity(username, null, 'digital_art_collection_viewed', {
            totalPurchasedItems: digitalArt.length,
            itemIds: digitalArt.map(art => art.itemId)
        });
        
        res.json({ 
            success: true, 
            username: username,
            digitalArt: digitalArt,
            totalItems: digitalArt.length
        });
        
    } catch (error) {
        console.error('❌ Error getting user digital art:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Access/download specific digital art item
app.post('/access-digital-art', async (req, res) => {
    try {
        const { username, winnerId, itemId } = req.body;
        
        if (!username || !winnerId || !itemId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: username, winnerId, itemId' 
            });
        }
        
        console.log(`🎨 Digital art access request - User: ${username}, Item: ${itemId}`);
        
        // Verify user owns this digital art
        const { ObjectId } = require('mongodb');
        const winnersCollection = db.collection('auction_winners');
        const winner = await winnersCollection.findOne({
            _id: new ObjectId(winnerId),
            winnerUsername: username,
            paymentStatus: 'paid'
        });
        
        if (!winner) {
            return res.status(403).json({ 
                success: false, 
                error: 'Digital art not found or not purchased' 
            });
        }
        
        // Log access
        const deliveryCollection = db.collection('digital_art_delivery');
        await deliveryCollection.updateOne(
            { winnerId: new ObjectId(winnerId) },
            { 
                $push: { 
                    accessLog: {
                        accessedAt: new Date(),
                        userAgent: req.get('user-agent'),
                        ip: req.ip
                    }
                },
                $set: { 
                    deliveryStatus: 'accessed',
                    lastAccessed: new Date()
                }
            }
        );
        
        // Log user activity
        await logUserActivity(username, null, 'digital_art_accessed', {
            itemId: itemId,
            winnerId: winnerId,
            artTitle: getArtTitle(itemId),
            artArtist: getArtArtist(itemId)
        });
        
        // Return digital art information
        res.json({ 
            success: true, 
            digitalArt: {
                title: getArtTitle(itemId),
                artist: getArtArtist(itemId),
                description: getArtDescription(itemId),
                winningBid: winner.winningBid,
                paidAt: winner.paidAt,
                licenseType: 'personal_use',
                // In a real implementation, these would be secure URLs to actual digital files
                previewUrl: `/art-preview/${itemId}.jpg`,
                downloadUrl: `/download-art/${winnerId}`, // Secure download link
                highResUrl: `/art-highres/${itemId}.png`
            },
            accessGranted: true,
            message: 'Digital art access granted'
        });
        
    } catch (error) {
        console.error('❌ Error accessing digital art:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DEBUG: Check auction winners collection
app.get('/debug/auction-winners', async (req, res) => {
    try {
        console.log('🔍 DEBUG - Checking auction winners collection...');
        
        const winnersCollection = db.collection('auction_winners');
        const allWinners = await winnersCollection.find({}).toArray();
        
        console.log(`🔍 DEBUG - Found ${allWinners.length} total winner records`);
        
        const debugData = {
            totalWinners: allWinners.length,
            winners: allWinners.map(winner => ({
                _id: winner._id,
                winnerUsername: winner.winnerUsername,
                itemId: winner.itemId,
                auctionId: winner.auctionId,
                winningBid: winner.winningBid,
                paymentStatus: winner.paymentStatus,
                paymentId: winner.paymentId || null,
                paidAt: winner.paidAt || null,
                digitalArtStatus: winner.digitalArtStatus || null
            }))
        };
        
        console.log('🔍 DEBUG - Winner data:', debugData);
        
        res.json({ success: true, debug: debugData });
        
    } catch (error) {
        console.error('❌ Error getting debug auction winners:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// END AUCTION WINNER MANAGEMENT ENDPOINTS
// =============================================================================

// Helper function to check auction timing
async function getAuctionStatus() {
    // Auction 1 - Fixed timestamps that don't change when users enter/leave
    const now = new Date();
    
    // Set auction end time to 3:50 PM today
    const auctionEnd = new Date();
    auctionEnd.setHours(15, 50, 0, 0); // 3:50 PM today

    // Set auction start time to 24 hours before end (started yesterday at 3:50 PM)
    const auctionStart = new Date(auctionEnd.getTime() - (24 * 60 * 60 * 1000));
    
    const timeRemaining = auctionEnd.getTime() - now.getTime();
    
    console.log(`🕐 Auction 1 timing check:`);
    console.log(`   Current time: ${now.toLocaleString()}`);
    console.log(`   Auction started: ${auctionStart.toLocaleString()}`);
    console.log(`   Auction ends: ${auctionEnd.toLocaleString()}`);
    console.log(`   Time remaining: ${Math.round(timeRemaining / 1000)} seconds`);
    
    if (now < auctionStart) {
        return {
            isActive: false,
            status: 'not_started',
            message: 'Auction 1 has not started yet',
            auctionId: 'auction_1',
            auctionName: 'Auction 1',
            startTime: auctionStart.toISOString(),
            endTime: auctionEnd.toISOString(),
            timeRemaining: 0
        };
    } else if (now > auctionEnd) {
        console.log('🔍 DEBUG - Auction has ended, checking for existing winners...');
        
        // Check if winners have been calculated for this auction
        const winnersCollection = db.collection('auction_winners');
        const existingWinners = await winnersCollection.find({ auctionId: 'auction_1' }).toArray();
        
        console.log(`🔍 DEBUG - Found ${existingWinners.length} existing winners in database`);
        
        // If no winners exist yet, calculate them automatically
        if (existingWinners.length === 0) {
            console.log('🏆 DEBUG - No winners found, automatically calculating winners...');
            
            // First, check if there are any bids to calculate winners from
            const bidsCollection = db.collection('auction_bids');
            const allBids = await bidsCollection.find({ auctionId: 'auction_1', status: 'active' }).toArray();
            console.log(`🔍 DEBUG - Found ${allBids.length} active bids for auction_1`);
            
            if (allBids.length > 0) {
                console.log('📋 DEBUG - Bid details:');
                allBids.forEach(bid => {
                    console.log(`   - ${bid.username}: ${bid.bidAmount} Pi for ${bid.itemId}`);
                });
            }
            
            try {
                const AuctionWinnerManager = require('./auction-winner.js');
                const winnerManager = new AuctionWinnerManager(process.env.MONGODB_URI || 'mongodb://localhost:27017', 'pay_me_pi');
                await winnerManager.connect();
                const result = await winnerManager.calculateAuctionWinners('auction_1');
                await winnerManager.disconnect();
                console.log('✅ DEBUG - Winner calculation completed:', result);
                
                if (result.success && result.winnersCount > 0) {
                    console.log('🎉 DEBUG - Winners successfully created and stored in database!');
                } else {
                    console.log('⚠️ DEBUG - Winner calculation returned no winners');
                }
            } catch (error) {
                console.error('❌ DEBUG - Error auto-calculating winners:', error);
                console.error('❌ DEBUG - Error details:', error.message);
                console.error('❌ DEBUG - Error stack:', error.stack);
            }
        } else {
            console.log('✅ DEBUG - Winners already exist in database, skipping calculation');
            existingWinners.forEach(winner => {
                console.log(`   - ${winner.winnerUsername}: ${winner.winningBid} Pi for ${winner.itemId}`);
            });
        }
        
        return {
            isActive: false,
            status: 'ended',
            message: 'Auction 1 has ended',
            auctionId: 'auction_1',
            auctionName: 'Auction 1',
            startTime: auctionStart.toISOString(),
            endTime: auctionEnd.toISOString(),
            timeRemaining: 0
        };
    } else {
        return {
            isActive: true,
            status: 'active',
            message: 'Auction 1 is currently active',
            auctionId: 'auction_1',
            auctionName: 'Auction 1',
            startTime: auctionStart.toISOString(),
            endTime: auctionEnd.toISOString(),
            timeRemaining: timeRemaining
        };
    }
}

// ========================================
// TEST ENDPOINTS
// ========================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Server is running', 
        timestamp: new Date().toISOString(),
        piApiKeySet: !!PI_API_KEY,
        mongoDbConnected: !!db,
        cors: {
            origin: req.get('origin'),
            allowedOrigins: [
                'http://localhost:3000',
                'https://CenPenAdmin.github.io',
                'https://e2b3fe8c3116.ngrok-free.app'
            ]
        }
    });
});

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
    console.log('CORS test request from origin:', req.get('origin'));
    res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({ 
        message: 'CORS test successful',
        origin: req.get('origin'),
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
});

// Simple test endpoint without CORS
app.get('/simple-test', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.json({ 
        message: 'Simple test successful - no CORS restrictions',
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint to test user data
app.get('/debug/user/:username', async (req, res) => {
    if (!db) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const { username } = req.params;
        
        // Get all user-related data
        const profile = await db.collection('user_profiles').findOne({ username });
        const subscription = await db.collection('user_subscriptions').findOne({ username });
        const activities = await db.collection('user_activities').find({ username }).sort({ timestamp: -1 }).limit(10).toArray();
        const payments = await db.collection('payments').find({ 'userInfo.username': username }).sort({ timestamp: -1 }).limit(5).toArray();
        
        // Check subscription status
        const subscriptionStatus = await verifyActiveSubscription(username);
        
        res.json({
            success: true,
            debug: {
                username,
                profile: profile,
                subscription: subscription,
                subscriptionStatus: subscriptionStatus,
                recentActivities: activities,
                recentPayments: payments,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('❌ Debug endpoint error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Debug check failed',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access your app at: http://localhost:${PORT}`);
    console.log(`For ngrok: use 'ngrok http ${PORT}' to create a tunnel`);
    console.log('\nIMPORTANT: Remember to:');
    console.log('1. Get your Pi API key from Pi Developer Portal');
    console.log('2. Set your PI_API_KEY environment variable');
    console.log('3. Register your app domain in Pi Developer Portal');
});

module.exports = app;
