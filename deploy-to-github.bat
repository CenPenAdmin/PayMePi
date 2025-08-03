@echo off
if "%1"=="" (
    echo Usage: deploy-to-github.bat [repository-url]
    echo Example: deploy-to-github.bat https://github.com/yourusername/pi-payment-app.git
    echo.
    echo First create the repository on GitHub, then run this script with the URL.
    exit /b 1
)

set REPO_URL=%1

echo Deploying Pi Payment App to GitHub...
echo Repository: %REPO_URL%
echo.

echo 1. Configuring git user (if needed)...
git config user.name >nul 2>&1
if errorlevel 1 (
    set /p USERNAME="Enter your GitHub username: "
    set /p EMAIL="Enter your GitHub email: "
    git config --global user.name "%USERNAME%"
    git config --global user.email "%EMAIL%"
)

echo 2. Adding files to git...
git add .

echo 3. Creating initial commit...
git commit -m "Initial Pi payment app with GitHub Pages support"

echo 4. Adding remote repository...
git remote add origin %REPO_URL%

echo 5. Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Push failed. This might be because:
    echo - The repository already exists and has content
    echo - Authentication issues
    echo.
    echo Try: git push -u origin main --force
    echo (Only use --force if you're sure!)
    exit /b 1
)

echo.
echo ✅ Successfully deployed to GitHub!
echo.
echo NEXT STEPS:
echo 1. Enable GitHub Pages:
echo    - Go to your repository on GitHub
echo    - Settings → Pages
echo    - Source: Deploy from branch → main → / (root)
echo.
echo 2. Your app will be available at:
echo    https://yourusername.github.io/pi-payment-app/
echo.
echo 3. Update config.js with your backend URL
echo 4. Configure Pi Developer Portal with GitHub Pages URL
echo.
pause
