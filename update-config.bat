@echo off
echo Pi Payment App Configuration Update
echo.

if "%1"=="" (
    set /p BACKEND_URL="Enter your backend URL (ngrok or other): "
) else (
    set BACKEND_URL=%1
)

if "%2"=="" (
    set /p GITHUB_USER="Enter your GitHub username: "
) else (
    set GITHUB_USER=%2
)

echo.
echo Updating configuration files...

:: Update config.js
powershell -Command "(Get-Content config.js) -replace 'https://your-ngrok-url.ngrok.io', '%BACKEND_URL%' | Set-Content config.js"

:: Update server.js CORS
powershell -Command "(Get-Content server.js) -replace 'https://yourusername.github.io', 'https://%GITHUB_USER%.github.io' | Set-Content server.js"

:: Update README.md
powershell -Command "(Get-Content README.md) -replace 'yourusername', '%GITHUB_USER%' | Set-Content README.md"

echo.
echo ✅ Configuration updated!
echo.
echo Backend URL: %BACKEND_URL%
echo GitHub Pages: https://%GITHUB_USER%.github.io/pi-payment-app/
echo.
echo Remember to:
echo 1. Commit and push changes: git add . && git commit -m "Update config" && git push
echo 2. Restart your backend server
echo 3. Update Pi Developer Portal with GitHub Pages URL
echo.
pause
