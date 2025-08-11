# Appraisells Pi Payment Integration Guide

## 🎯 Overview
This guide helps you integrate Pi Network payment functionality into your Appraisells app using the tested code from this project.

## 📁 Files to Copy to Appraisells Project

### 1. **Essential Backend Files**
```
📂 Your Appraisells Backend/
├── payment-server.js     # Copy from server.js (rename for clarity)
├── payment-config.js     # Copy from config.js
├── package.json          # Merge dependencies
├── .env.example          # Copy for API key template
└── .gitignore           # Ensure .env is excluded
```

### 2. **Frontend Integration**
```
📂 Your Appraisells Frontend/
├── pi-payment.js         # Extract Pi SDK logic from index.html
├── payment-ui.js         # Payment interface components
└── config.js             # Copy payment configuration
```

## 🔧 Step-by-Step Integration

### Step 1: Backend Setup

1. **Copy payment server logic:**
   ```bash
   # Navigate to your Appraisells backend folder
   cd "c:\Users\CenPe\Appraisells\backend"  # or your actual path
   
   # Copy the payment server
   copy "c:\Users\CenPe\Pay Me Pi\server.js" payment-server.js
   ```

2. **Update package.json dependencies:**
   Add these to your Appraisells package.json:
   ```json
   {
     "dependencies": {
       "dotenv": "^17.2.1",
       "cors": "^2.8.5",
       "express": "^4.18.2",
       "body-parser": "^1.20.2"
     }
   }
   ```

3. **Set up environment variables:**
   ```bash
   # Copy environment template
   copy "c:\Users\CenPe\Pay Me Pi\.env.example" .env.example
   
   # Create your .env file
   echo PI_API_KEY=your-pi-api-key-here > .env
   ```

### Step 2: Frontend Integration

1. **Extract Pi SDK functionality:**
   Create `pi-payment.js` with the core Pi payment logic
   
2. **Integrate with Appraisells UI:**
   Adapt the payment interface to match your Appraisells design

### Step 3: Configuration

1. **Update CORS origins:**
   Add your Appraisells domain to allowed origins
   
2. **Configure payment amounts:**
   Set appropriate Pi amounts for your appraisal services

## 🏗️ Architecture Integration

### Option A: Separate Payment Microservice
- Run Pi payment server on separate port (e.g., 3001)
- Call from main Appraisells app via API

### Option B: Integrated Backend
- Merge payment endpoints into existing Appraisells server
- Add Pi payment routes alongside existing routes

## 🔐 Security Considerations

1. **API Key Management:**
   - Use environment variables (never hardcode)
   - Different API keys for dev/prod
   
2. **CORS Configuration:**
   - Add Appraisells domain to allowed origins
   - Restrict to necessary domains only
   
3. **Payment Validation:**
   - Validate payment amounts server-side
   - Implement proper error handling

## 💡 Appraisells-Specific Adaptations

### Payment Amounts
```javascript
// In payment-config.js
const APPRAISAL_PAYMENTS = {
    basic_appraisal: 5,      // 5 Pi for basic appraisal
    detailed_appraisal: 10,  // 10 Pi for detailed appraisal
    rush_appraisal: 15       // 15 Pi for rush service
};
```

### Custom Metadata
```javascript
// Include appraisal-specific data
const paymentMetadata = {
    itemType: "Real Estate Appraisal",
    appraisalType: "residential",
    propertyAddress: "123 Main St",
    clientId: "user123"
};
```

## 🚀 Deployment Strategy

### Development
1. Test Pi payments in sandbox mode
2. Use ngrok for local testing
3. Validate with test Pi accounts

### Production
1. Switch to Pi mainnet
2. Configure production domains
3. Set up proper SSL certificates

## 📞 Commands to Execute

Run these commands to get started:

```powershell
# 1. Navigate to Appraisells project
cd "c:\Users\CenPe\Appraisells"

# 2. Create payment integration folder
mkdir payment-integration

# 3. Copy essential files
copy "c:\Users\CenPe\Pay Me Pi\server.js" payment-integration\payment-server.js
copy "c:\Users\CenPe\Pay Me Pi\config.js" payment-integration\payment-config.js
copy "c:\Users\CenPe\Pay Me Pi\package.json" payment-integration\package.json
copy "c:\Users\CenPe\Pay Me Pi\SECURITY.md" payment-integration\SECURITY.md

# 4. Install dependencies
cd payment-integration
npm install

# 5. Set up environment
copy ..\Pay Me Pi\.env.example .env.example
echo PI_API_KEY=your-pi-api-key-here > .env
```

## 🔄 Next Steps

1. **Copy files** using the commands above
2. **Adapt payment amounts** for appraisal services
3. **Integrate with Appraisells UI** design
4. **Test in sandbox mode** first
5. **Deploy to production** when ready

## 📋 Checklist

- [ ] Copy payment server files
- [ ] Install required dependencies  
- [ ] Set up environment variables
- [ ] Configure CORS for Appraisells domain
- [ ] Adapt payment amounts for appraisals
- [ ] Test payment flow in sandbox
- [ ] Integrate with Appraisells UI
- [ ] Deploy and test in production

## 🆘 Troubleshooting

If you encounter issues:
1. Check CORS configuration
2. Verify API key is set correctly
3. Ensure all dependencies are installed
4. Test backend endpoints individually
5. Check browser console for errors

---

**Remember:** Always test in Pi sandbox mode before going live!
