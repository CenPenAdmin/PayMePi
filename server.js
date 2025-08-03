const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://CenPenAdmin.github.io', // GitHub Pages (without trailing slash)
        'https://297556bc9eea.ngrok-free.app', // Your current ngrok URL
        /^https:\/\/.*\.ngrok\.io$/, // Allow any ngrok.io subdomain
        /^https:\/\/.*\.ngrok-free\.app$/ // Allow any ngrok-free.app subdomain
    ],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Your Pi API Key (you'll need to get this from Pi Developer Portal)
const PI_API_KEY = process.env.PI_API_KEY || 'sogxnhwllqqlotxsjronw2vcy9njrg4jnbn4szsjke4fblvmkpalirsaovobghcp';
const PI_API_URL = 'https://api.minepi.com'; // Use testnet URL: https://api.minepi.com

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Approve payment endpoint
app.post('/approve-payment', async (req, res) => {
    const { paymentId } = req.body;
    
    console.log('=== PAYMENT APPROVAL REQUEST ===');
    console.log('Payment ID:', paymentId);
    console.log('PI_API_KEY set:', PI_API_KEY !== 'your-pi-api-key-here');
    console.log('Request origin:', req.get('origin'));
    
    // Add CORS headers explicitly
    res.header('Access-Control-Allow-Origin', req.get('origin'));
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (!paymentId) {
        console.error('No payment ID provided');
        return res.status(400).json({ success: false, error: 'Payment ID required' });
    }
    
    if (PI_API_KEY === 'your-pi-api-key-here') {
        console.error('Pi API key not set!');
        return res.status(500).json({ 
            success: false, 
            error: 'Pi API key not configured. Set PI_API_KEY environment variable.' 
        });
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Server is running', 
        timestamp: new Date().toISOString(),
        piApiKeySet: PI_API_KEY !== 'your-pi-api-key-here',
        cors: {
            origin: req.get('origin'),
            allowedOrigins: [
                'http://localhost:3000',
                'https://CenPenAdmin.github.io',
                'https://297556bc9eea.ngrok-free.app'
            ]
        }
    });
});

// Test CORS endpoint
app.options('*', cors()); // Enable preflight for all routes

app.get('/test-cors', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.get('origin'));
    res.header('Access-Control-Allow-Credentials', 'true');
    res.json({ 
        message: 'CORS test successful',
        origin: req.get('origin'),
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
