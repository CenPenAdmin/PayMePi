@echo off
echo Starting Pi Payment App Setup...
echo.

echo 1. Installing dependencies...
npm install

echo.
echo Setup complete! Next steps:
echo.
echo GITHUB SETUP (do this first):
echo 1. Go to https://github.com and create a new repository
echo 2. Name it: pi-payment-app
echo 3. Make it PUBLIC (required for GitHub Pages)
echo 4. Don't initialize with README (we have one)
echo 5. Copy the repository URL
echo 6. Run: deploy-to-github.bat [your-repo-url]
echo.
echo PI DEVELOPER SETUP:
echo 1. Get your Pi API key from https://developers.minepi.com/
echo 2. Set PI_API_KEY environment variable
echo 3. Use your GitHub Pages URL in Pi Developer Portal
echo 4. Update config.js with your backend URL
echo.
echo To start local server: npm start
echo To setup ngrok: ngrok http 3000
