@echo off
set CHANNEL=%1

echo Verifying build...
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo Build failed. Nothing pushed.
  exit /b 1
)

if "%CHANNEL%"=="beta" (
  echo Build passed. Releasing beta...
  call npm version prerelease --preid=beta
) else (
  echo Build passed. Releasing stable...
  call npm version patch
)
if %errorlevel% neq 0 (
  echo.
  echo Version bump failed. Is the working tree clean? Run: git status
  exit /b 1
)

git push
git push --tags
echo.
echo Done! Build running at: https://github.com/dbschrier/ClipPress/actions
