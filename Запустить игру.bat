@echo off
chcp 65001 >nul
cd /d "%~dp0"
title КАПИТАЛИСТ - игровой сервер

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist node_modules goto build
echo Первый запуск: устанавливаю компоненты игры, нужен интернет, это займёт минуту...
call npm install
if errorlevel 1 goto fail

:build
echo Собираю игру...
call npx vite build --logLevel warn
if errorlevel 1 goto fail

rem Браузер откроется через 3 секунды, когда сервер уже запустится
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8080"
call npx tsx server/index.ts
pause
exit /b 0

:nonode
echo.
echo Не найден Node.js. Установите его с сайта https://nodejs.org - версия 18 или новее,
echo затем снова запустите этот файл.
echo.
pause
exit /b 1

:fail
echo.
echo Что-то пошло не так. Сообщение об ошибке выше.
pause
exit /b 1
