@echo off
echo Starting Pi Payment Backend Server...
echo.

:: Check if PI_API_KEY is set
if "%PI_API_KEY%"=="" (
    echo WARNING: PI_API_KEY environment variable not set!
    echo Get your API key from: https://developers.minepi.com/
    echo Set it with: set PI_API_KEY=your-actual-key
    echo.
)

echo Starting server on port 3000...
echo Frontend should be accessed via GitHub Pages URL
echo Backend API will be available for CORS requests
echo.

node server.js
