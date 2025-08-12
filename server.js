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
            'https://73a51818c115.ngrok-free.app'
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

                    const paymentRecord = {
                        paymentId,
                        status: 'approved',
                        timestamp: new Date(),
                        
                        // User Information
                        userInfo: {
                            username: paymentData.metadata?.username || 'unknown',
                            userUid: paymentData.user_uid,
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
                'https://73a51818c115.ngrok-free.app'
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
