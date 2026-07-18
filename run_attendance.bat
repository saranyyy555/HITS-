@echo off
title HITS Attendance System
echo ===================================================
echo   HITS Attendance System - Local Server Launcher
echo ===================================================
echo.
echo Starting Python web server on http://localhost:3000 ...
echo Close this window to stop the server.
echo.
start "" "http://localhost:3000"
python server.py
pause
