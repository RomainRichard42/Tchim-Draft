@echo off
set "TCHIM_DISABLE_APP_UPDATES=1"
set "TCHIM_DATA_DIR=%~dp0data\local"
set "TCHIM_EXECUTABLE=%~dp0release\0.10.3\win-unpacked\Tchim Draft.exe"
if not exist "%TCHIM_EXECUTABLE%" (
  echo Construisez l'application avec npm.cmd run dist:win avant de lancer ce fichier.
  pause
  exit /b 1
)
start "" "%TCHIM_EXECUTABLE%"
