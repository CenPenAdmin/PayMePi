# API Key Security Guide

## ✅ What We Fixed

### Before (Insecure)
```javascript
const PI_API_KEY = process.env.PI_API_KEY || 'sogxnhwllqqlotxsjronw2vcy9njrg4jnbn4szsjke4fblvmkpalirsaovobghcp';
```

### After (Secure)
```javascript
require('dotenv').config();
const PI_API_KEY = process.env.PI_API_KEY;

if (!PI_API_KEY) {
    console.error('❌ CRITICAL: PI_API_KEY environment variable not set!');
    process.exit(1);
}
```

## 🔐 Security Best Practices

### 1. Environment Variables (.env file)
- API key is stored in `.env` file (never committed to git)
- Server fails to start if API key is missing
- Uses `dotenv` package to load environment variables

### 2. Git Protection
- `.env` is in `.gitignore` to prevent accidental commits
- API key never appears in source code
- Repository can be safely shared publicly

### 3. Runtime Security
- Server validates API key exists on startup
- Logging shows only boolean status (`!!PI_API_KEY`), not the actual key
- No fallback hardcoded values

## 📁 File Structure
```
Pay Me Pi/
├── .env                 # API key (NEVER commit)
├── .gitignore          # Protects .env from git
├── server.js           # Secure server code
├── package.json        # Dependencies
└── index.html          # Frontend
```

## 🚀 How to Deploy Securely

### Local Development
1. Keep your `.env` file for local testing
2. Never commit `.env` to git
3. Server will load API key automatically

### Production Deployment
1. Set environment variables on your hosting platform:
   - Heroku: `heroku config:set PI_API_KEY=your-key`
   - Vercel: Add in dashboard settings
   - DigitalOcean: Set in app configuration
2. Don't upload `.env` file to production servers

## ⚠️ Security Warnings

### NEVER DO THIS:
- Hardcode API keys in source code
- Commit `.env` files to git
- Log actual API key values
- Share API keys in chat/email

### ALWAYS DO THIS:
- Use environment variables
- Add sensitive files to `.gitignore`
- Validate environment variables on startup
- Rotate API keys periodically

## 🔄 Key Rotation
If your API key is ever compromised:
1. Generate new key in Pi Developer Portal
2. Update `.env` file with new key
3. Restart your server
4. Revoke the old key in Pi Developer Portal
