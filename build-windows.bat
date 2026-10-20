@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   بناء تطبيق تسيير غيابات التلاميذ
echo   السيرفر يبدأ تلقائيا عند فتح التطبيق
echo ================================================
where node >nul 2>nul
if errorlevel 1 (echo يلزم تثبيت Node.js 20 أو أحدث للبناء فقط.& pause & exit /b 1)
if not exist node_modules (
  echo تثبيت متطلبات البناء لأول مرة، يلزم الإنترنت لهذه الخطوة...
  call npm install
  if errorlevel 1 (echo فشل تثبيت المكتبات.& pause & exit /b 1)
)
echo بدء بناء ملف التثبيت...
call npm run dist
if errorlevel 1 (echo فشل البناء. راجع الرسائل أعلاه.& pause & exit /b 1)
echo.
echo انتهى البناء. افتح مجلد dist لتجد Ghiyabat-Setup-1.0.0.exe.
pause
