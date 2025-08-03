# Pi Payment Test App

A minimal Pi Network payment application for learning how to integrate Pi coin payments.

## Live Demo

**Frontend**: [https://CenPenAdmin.github.io/PayMePi/](https://CenPenAdmin.github.io/PayMePi/)

## What This App Does

- Displays a simple webpage with a "Pay 1 Test Pi" button
- Allows users to sign in with their Pi account
- Processes a 1 Pi payment on the Pi testnet
- Demonstrates the complete Pi payment flow

## Architecture

- **Frontend**: Hosted on GitHub Pages (Static)
- **Backend**: Node.js server for payment processing (needs separate hosting)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Pi API Key

1. Go to [Pi Developer Portal](https://developers.minepi.com/)
2. Create an account and register your app
3. Get your API key from the dashboard
4. Add your domain (ngrok URL) to the allowed domains

### 3. Set Environment Variables

Create a `.env` file or set environment variable:
```bash
PI_API_KEY=your-actual-pi-api-key-here
```

### 4. Run the Server

```bash
npm start
```

The server will run on http://localhost:3000

### 5. Set Up ngrok Tunnel

1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
4. Add this URL to your Pi Developer Portal app settings

### 6. Test in Pi Browser

1. Open Pi Browser on your phone
2. Navigate to your ngrok HTTPS URL
3. Sign in with Pi
4. Click "Pay 1 Test Pi"

## File Structure

```
/
├── package.json     # Node.js dependencies
├── server.js        # Express server handling payments
├── index.html       # Frontend with Pi payment button
└── README.md        # This file
```

## How It Works

1. **Frontend (index.html)**: Contains Pi SDK integration and payment UI
2. **Backend (server.js)**: Handles payment approval and completion via Pi API
3. **Pi SDK**: Manages authentication and payment flow
4. **Pi API**: Processes the actual payment on Pi blockchain

## Important Notes

- This uses Pi testnet (sandbox mode)
- You need a real Pi API key from the Developer Portal
- The app must be accessed via HTTPS (use ngrok)
- Users need the Pi Browser mobile app to test

## Learning Points

- Pi payments require both frontend SDK and backend API calls
- Authentication happens before payments
- Payment flow: Create → Approve → Complete
- All communication with Pi happens over HTTPS

## Next Steps

Once you understand this basic flow, you can:
- Add proper error handling
- Implement payment verification
- Add CSS styling
- Store payment records in a database
- Add more complex payment logic
