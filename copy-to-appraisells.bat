@echo off
echo ============================================
echo    Pi Payment Integration for Appraisells
echo ============================================
echo.

REM Get the target Appraisells directory from user
set /p APPRAISELLS_PATH="Enter your Appraisells project path (e.g., c:\Users\CenPe\Appraisells): "

if not exist "%APPRAISELLS_PATH%" (
    echo Error: Directory %APPRAISELLS_PATH% does not exist!
    echo Please check the path and try again.
    pause
    exit /b 1
)

echo.
echo Creating payment integration folder...
mkdir "%APPRAISELLS_PATH%\payment-integration" 2>nul

echo.
echo Copying essential payment files...

REM Copy core payment files
copy "server.js" "%APPRAISELLS_PATH%\payment-integration\payment-server.js"
copy "config.js" "%APPRAISELLS_PATH%\payment-integration\payment-config.js"
copy "package.json" "%APPRAISELLS_PATH%\payment-integration\package.json"
copy "SECURITY.md" "%APPRAISELLS_PATH%\payment-integration\SECURITY.md"
copy "APPRAISELLS_INTEGRATION_GUIDE.md" "%APPRAISELLS_PATH%\payment-integration\INTEGRATION_GUIDE.md"

REM Copy environment template (but not actual .env for security)
if exist ".env.example" (
    copy ".env.example" "%APPRAISELLS_PATH%\payment-integration\.env.example"
) else (
    echo # Pi API Configuration > "%APPRAISELLS_PATH%\payment-integration\.env.example"
    echo # Replace with your actual Pi API key from Pi Developer Portal >> "%APPRAISELLS_PATH%\payment-integration\.env.example"
    echo PI_API_KEY=your-pi-api-key-here >> "%APPRAISELLS_PATH%\payment-integration\.env.example"
    echo. >> "%APPRAISELLS_PATH%\payment-integration\.env.example"
    echo # Note: Create a .env file from this template and add your real API key >> "%APPRAISELLS_PATH%\payment-integration\.env.example"
)

REM Copy gitignore for security
copy ".gitignore" "%APPRAISELLS_PATH%\payment-integration\.gitignore"

echo.
echo Creating frontend integration template...

REM Create a simplified frontend integration file
(
echo // Pi Payment Integration for Appraisells
echo // Extract from index.html and adapt to your UI
echo.
echo class AppraisellsPayment {
echo     constructor^(config^) {
echo         this.config = config;
echo         this.piSDK = null;
echo     }
echo.
echo     async initializePiSDK^(^) {
echo         // Load Pi SDK
echo         return new Promise^(^(resolve, reject^) =^> {
echo             const script = document.createElement^('script'^);
echo             script.src = 'https://sdk.minepi.com/pi-sdk.js';
echo             script.onload = ^(^) =^> {
echo                 this.piSDK = window.Pi;
echo                 resolve^(^);
echo             };
echo             script.onerror = reject;
echo             document.head.appendChild^(script^);
echo         }^);
echo     }
echo.
echo     async authenticateUser^(^) {
echo         try {
echo             const auth = await this.piSDK.authenticate^(scopes, onIncompletePaymentFound^);
echo             return auth;
echo         } catch ^(error^) {
echo             console.error^('Authentication failed:', error^);
echo             throw error;
echo         }
echo     }
echo.
echo     async createAppraisalPayment^(appraisalType, amount^) {
echo         // Implement payment creation logic here
echo         // Adapt from the working index.html code
echo     }
echo }
echo.
echo // Export for use in Appraisells
echo if ^(typeof module !== 'undefined' ^&^& module.exports^) {
echo     module.exports = AppraisellsPayment;
echo }
) > "%APPRAISELLS_PATH%\payment-integration\appraisells-pi-payment.js"

echo.
echo ============================================
echo           INTEGRATION COMPLETE!
echo ============================================
echo.
echo Files copied to: %APPRAISELLS_PATH%\payment-integration\
echo.
echo NEXT STEPS:
echo 1. Navigate to: %APPRAISELLS_PATH%\payment-integration\
echo 2. Read: INTEGRATION_GUIDE.md
echo 3. Run: npm install
echo 4. Create .env file from .env.example
echo 5. Add your Pi API key to .env file
echo 6. Adapt payment-server.js for your needs
echo 7. Integrate appraisells-pi-payment.js with your frontend
echo.
echo For detailed instructions, see INTEGRATION_GUIDE.md
echo.
pause
