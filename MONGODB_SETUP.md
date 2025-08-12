# MongoDB Setup for Pay Me Pi

## Quick Start Guide

### 1. Install MongoDB Community Edition

**Download and Install:**
1. Go to: https://www.mongodb.com/try/download/community
2. Select "Windows" and download the MSI installer
3. Run the installer with default settings
4. MongoDB will start automatically as a Windows service

### 2. Verify MongoDB is Running

**Option A: Check Windows Services**
1. Press `Win + R`, type `services.msc`, press Enter
2. Look for "MongoDB Server" - it should show as "Running"

**Option B: Command Line Check**
```bash
# Open Command Prompt and run:
net start MongoDB

# If already running, you'll see: "The requested service has already been started."
```

### 3. Test MongoDB Connection

**Install MongoDB Shell (optional but recommended):**
1. Download MongoDB Shell from: https://www.mongodb.com/try/download/shell
2. Install mongosh.exe
3. Test connection:
```bash
mongosh
```

### 4. Alternative: Use MongoDB Compass (GUI)

**Download MongoDB Compass:**
1. Go to: https://www.mongodb.com/try/download/compass
2. Install and open Compass
3. Connect to: `mongodb://localhost:27017`

## Testing the Database Integration

### 1. Start Your Server
```bash
cd "c:\Users\CenPe\Pay Me Pi"
node server.js
```

You should see:
```
✅ Connected to MongoDB at mongodb://localhost:27017
📊 Database: pay_me_pi
```

### 2. Make a Test Payment
1. Open your app at http://localhost:3000
2. Make a Pi payment
3. Check the console logs for database saves

### 3. View Stored Data

**Option A: Using MongoDB Shell**
```bash
mongosh
use pay_me_pi
db.payments.find().pretty()
```

**Option B: Using MongoDB Compass**
1. Connect to `mongodb://localhost:27017`
2. Select database: `pay_me_pi`
3. Select collection: `payments`
4. View the stored payment records

**Option C: Using Your App's API**
Visit: http://localhost:3000/payments

## Database Schema

Your payment records will look like this:
```javascript
{
  "_id": ObjectId("..."),
  "paymentId": "payment_abc123",
  "status": "approved", // or "completed"
  "timestamp": ISODate("2025-08-11T..."),
  "apiResponse": "...",
  // For completed payments:
  "txId": "transaction_xyz789",
  "completedAt": ISODate("2025-08-11T..."),
  "completionData": { ... }
}
```

## Troubleshooting

### MongoDB Not Connected
- Ensure MongoDB service is running: `net start MongoDB`
- Check if port 27017 is available
- Verify no firewall blocking localhost connections

### Permission Issues
- Run Command Prompt as Administrator
- Restart MongoDB service: `net stop MongoDB` then `net start MongoDB`

### Database Not Showing Data
- Make test payments through your app
- Check server console for database save messages
- Verify MongoDB is actually running and accessible

## Quick Commands Reference

```bash
# Start MongoDB (if not running)
net start MongoDB

# Stop MongoDB
net stop MongoDB

# Connect with shell
mongosh

# In mongosh - switch to your database
use pay_me_pi

# View all payments
db.payments.find()

# Count payments
db.payments.countDocuments()

# Find completed payments only
db.payments.find({status: "completed"})

# View latest payment
db.payments.find().sort({timestamp: -1}).limit(1)
```
