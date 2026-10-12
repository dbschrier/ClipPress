@echo off
echo Verifying build...
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo Build failed. Version not bumped, nothing pushed.
  exit /b 1
)
echo Build passed. Releasing...
call npm version patch
git push
git push --tags
echo.
echo Done! Build running at: https://github.com/dbschrier/ClipPress/actions
