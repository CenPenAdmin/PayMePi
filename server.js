// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient } = require('mongodb');

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'pay_me_pi';
let db;

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
            'https://37bf96dd43a1.ngrok-free.app'
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
                            orderId: paymentData.metadata?.orderId
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

                    // Check if this is a subscription payment
                    const isSubscriptionPayment = data.metadata?.paymentType === 'monthly_subscription' || 
                                                 data.memo?.includes('subscription') ||
                                                 existingPayment?.paymentDetails?.memo?.includes('subscription') ||
                                                 data.memo?.includes('30-day') ||
                                                 data.memo?.includes('Appraisells');

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
                            isSubscription: isSubscriptionPayment
                        });

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
                'https://37bf96dd43a1.ngrok-free.app'
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
