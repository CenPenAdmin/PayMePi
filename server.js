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
        'https://yourusername.github.io', // Replace with your GitHub Pages URL
        /^https:\/\/.*\.ngrok\.io$/ // Allow any ngrok subdomain
    ],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Your Pi API Key (you'll need to get this from Pi Developer Portal)
const PI_API_KEY = process.env.PI_API_KEY || 'your-pi-api-key-here';
const PI_API_URL = 'https://api.minepi.com'; // Use testnet URL for testing

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Approve payment endpoint
app.post('/approve-payment', async (req, res) => {
    const { paymentId } = req.body;
    
    console.log('Approving payment:', paymentId);
    
    try {
        // Call Pi API to approve the payment
        const response = await fetch(`${PI_API_URL}/v2/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('Payment approved successfully');
            res.json({ success: true, message: 'Payment approved' });
        } else {
            console.error('Payment approval failed:', response.statusText);
            res.status(400).json({ success: false, error: 'Payment approval failed' });
        }
        
    } catch (error) {
        console.error('Error approving payment:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Complete payment endpoint
app.post('/complete-payment', async (req, res) => {
    const { paymentId, txId } = req.body;
    
    console.log('Completing payment:', paymentId, 'Transaction ID:', txId);
    
    try {
        // Call Pi API to complete the payment
        const response = await fetch(`${PI_API_URL}/v2/payments/${paymentId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ txid: txId })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Payment completed successfully:', data);
            res.json({ success: true, message: 'Payment completed', data });
        } else {
            console.error('Payment completion failed:', response.statusText);
            res.status(400).json({ success: false, error: 'Payment completion failed' });
        }
        
    } catch (error) {
        console.error('Error completing payment:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
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
