@echo off
echo Releasing new version...
call npm version patch
git push
git push --tags
echo.
echo Done! Build running at: https://github.com/dbschrier/clippress/actions
