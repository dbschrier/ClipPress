@echo off
setlocal

echo.
echo  ClipPress Staging Pipeline
echo  ===========================
echo.

echo [1/3] Running tests...
call npm test
if %errorlevel% neq 0 (
  echo.
  echo  FAIL  Tests failed. Nothing built.
  exit /b 1
)

echo.
echo [2/3] Building staging installer...
node scripts/stage-build.mjs
if %errorlevel% neq 0 (
  echo.
  echo  FAIL  Build failed.
  exit /b 1
)

echo Opening staging folder...
start explorer staging

echo [3/3] Starting staging update server...
echo.
echo  -------------------------------------------------------
echo   HOW TO TEST AN OTA UPDATE END-TO-END:
echo.
echo   First time:
echo     1. Install the app from staging\ClipPress Staging-Setup-*.exe
echo     2. Open "ClipPress Staging" from your Start Menu
echo        (it checks for updates on launch)
echo     3. No update yet -- that's expected.
echo.
echo   Testing an update:
echo     1. Make code changes
echo     2. Run stage.bat again (new version built + served)
echo     3. Open "ClipPress Staging" -- it finds the update,
echo        downloads it, shows "Restart now"
echo     4. Click Restart -- proves OTA works end-to-end
echo.
echo   Ctrl+C to stop the server.
echo  -------------------------------------------------------
echo.

node scripts/serve-staging.mjs
