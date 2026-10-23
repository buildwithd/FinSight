@echo off
chcp 65001 >nul
where java >nul 2>nul || (echo Java 17 or newer is required.& exit /b 1)
where javac >nul 2>nul || (echo A full JDK is required, not a JRE.& exit /b 1)
cd /d "%~dp0"
javac --add-modules jdk.httpserver -encoding UTF-8 FinSightServer.java || (echo Compilation failed.& pause & exit /b 1)
echo.
echo FinSight is starting. Open http://localhost:8080 in your browser.
java --add-modules jdk.httpserver FinSightServer
