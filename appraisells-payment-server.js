// Appraisells Pi Payment Server
// Simplified version of server.js adapted for appraisal services

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PAYMENT_PORT || 3001; // Different port for microservice

// APPRAISAL-SPECIFIC CONFIGURATION
const APPRAISAL_TYPES = {
    basic: { amount: 5, memo: "Basic Property Appraisal" },
    detailed: { amount: 10, memo: "Detailed Property Appraisal" },
    rush: { amount: 15, memo: "Rush Property Appraisal" },
    commercial: { amount: 25, memo: "Commercial Property Appraisal" }
};

// Security: API key must be set
const PI_API_KEY = process.env.PI_API_KEY;
if (!PI_API_KEY) {
    console.error('❌ CRITICAL: PI_API_KEY environment variable not set!');
    process.exit(1);
}

// CORS configuration - UPDATE WITH YOUR APPRAISELLS DOMAIN
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'https://your-appraisells-domain.com', // UPDATE THIS
            'https://*.ngrok-free.app'
        ];
        
        if (!origin || allowedOrigins.some(allowed => 
            allowed.includes('*') ? 
            new RegExp(allowed.replace('*', '.*')).test(origin) : 
            allowed === origin
        )) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(bodyParser.json());

// APPRAISAL PAYMENT ENDPOINTS

// Create appraisal payment
app.post('/api/appraisal/payment/create', async (req, res) => {
    const { appraisalType, propertyData, clientInfo } = req.body;
    
    console.log('=== APPRAISAL PAYMENT REQUEST ===');
    console.log('Appraisal Type:', appraisalType);
    console.log('Property:', propertyData?.address);
    
    // Validate appraisal type
    if (!APPRAISAL_TYPES[appraisalType]) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid appraisal type' 
        });
    }
    
    const paymentConfig = APPRAISAL_TYPES[appraisalType];
    
    res.json({
        success: true,
        paymentConfig: {
            amount: paymentConfig.amount,
            memo: paymentConfig.memo,
            metadata: {
                appraisalType,
                propertyAddress: propertyData?.address,
                clientId: clientInfo?.id,
                timestamp: new Date().toISOString()
            }
        }
    });
});

// Approve appraisal payment
app.post('/api/appraisal/payment/approve', async (req, res) => {
    const { paymentId, appraisalId } = req.body;
    
    try {
        // Call Pi API to approve payment
        const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Appraisal payment approved');
            
            // Here you would typically:
            // 1. Update appraisal status in your database
            // 2. Trigger appraisal workflow
            // 3. Send confirmation to client
            
            res.json({ success: true, message: 'Payment approved - appraisal will begin' });
        } else {
            const error = await response.text();
            res.status(400).json({ success: false, error });
        }
        
    } catch (error) {
        console.error('❌ Payment approval failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete appraisal payment
app.post('/api/appraisal/payment/complete', async (req, res) => {
    const { paymentId, txId, appraisalId } = req.body;
    
    try {
        // Call Pi API to complete payment
        const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ txid: txId })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Appraisal payment completed');
            
            // Here you would typically:
            // 1. Mark appraisal as fully paid
            // 2. Begin appraisal process
            // 3. Schedule appraiser assignment
            
            res.json({ 
                success: true, 
                message: 'Payment completed - appraisal scheduled',
                data 
            });
        } else {
            const error = await response.text();
            res.status(400).json({ success: false, error });
        }
        
    } catch (error) {
        console.error('❌ Payment completion failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get appraisal pricing
app.get('/api/appraisal/pricing', (req, res) => {
    res.json({
        success: true,
        pricing: APPRAISAL_TYPES
    });
});

// Health check
app.get('/api/payment/health', (req, res) => {
    res.json({ 
        status: 'Appraisells Payment Service Running',
        timestamp: new Date().toISOString(),
        apiKeySet: !!PI_API_KEY
    });
});

app.listen(PORT, () => {
    console.log(`🏠 Appraisells Payment Service running on port ${PORT}`);
    console.log(`🔐 Pi API Key: ${PI_API_KEY ? 'Set' : 'Not Set'}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});

module.exports = app;
