# Deployment Guide

## GitHub Pages Setup

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `pi-payment-app`
3. Make it public (required for GitHub Pages free tier)

### 2. Push Your Code

```bash
# Add all files
git add .

# Commit
git commit -m "Initial Pi payment app"

# Add remote (replace with your actual repository URL)
git remote add origin https://github.com/yourusername/pi-payment-app.git

# Push to GitHub
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

Your site will be available at: `https://yourusername.github.io/pi-payment-app/`

### 4. Update Configuration

1. Update `config.js` with your backend URL:
   ```javascript
   BACKEND_URL: 'https://your-actual-ngrok-url.ngrok.io'
   ```

2. Update CORS in `server.js`:
   ```javascript
   origin: [
       'https://yourusername.github.io', // Your actual GitHub Pages URL
       // ... other origins
   ]
   ```

### 5. Pi Developer Portal Setup

1. Go to [Pi Developer Portal](https://developers.minepi.com/)
2. Create/edit your app
3. Set the app URL to: `https://yourusername.github.io/pi-payment-app/`
4. Save the configuration

## Backend Deployment Options

### Option 1: ngrok (Development)
```bash
# In your project directory
node server.js

# In another terminal
ngrok http 3000
```

### Option 2: Heroku (Production)
1. Install Heroku CLI
2. Create Heroku app: `heroku create your-app-name`
3. Set environment variables: `heroku config:set PI_API_KEY=your-key`
4. Deploy: `git push heroku main`

### Option 3: Railway/Render/Vercel
Follow their respective deployment guides for Node.js apps.

## Workflow

1. **Frontend**: Automatically deployed to GitHub Pages on every push
2. **Backend**: Deploy separately and update `config.js` with new URL
3. **Pi Portal**: Configure once with GitHub Pages URL (stable)

## Testing

1. Access your GitHub Pages URL
2. Test the payment flow
3. Check browser console for any CORS or configuration errors
