@echo off
echo [1/3] Terminating all Node.js and Next.js processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM next-router-worker.exe /T 2>nul
taskkill /F /IM next-render-worker.exe /T 2>nul

echo [2/3] Cleaning build and Turbopack caches...
if exist .next (
    rmdir /s /q .next
    echo .next folder removed.
)

echo [3/3] Running clean build...
npm run build

echo Done! If errors persist, try deleting node_modules and running npm install.
pause
