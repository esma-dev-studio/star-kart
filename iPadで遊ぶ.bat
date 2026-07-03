@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ===== シュガリア・グランプリ iPad用サーバ =====
echo.
echo  同じWi-Fiに接続したiPadのSafariで、次のアドレスを開いてください:
for /f %%a in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1'}).IPAddress"') do echo      http://%%a:8123
echo.
echo  このウィンドウを閉じるとサーバは止まります。
echo  ================================================
echo.
python -m http.server 8123
