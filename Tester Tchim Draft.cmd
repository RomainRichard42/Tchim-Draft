@echo off
set "TCHIM_DISABLE_APP_UPDATES=1"
set "TCHIM_OFFLINE=1"
set "TCHIM_PREVIEW=1"
set "TCHIM_DATA_DIR=%~dp0data\local-preview-0.15.0"
set "TCHIM_EXECUTABLE=%~dp0release\0.15.0-local\win-unpacked\Tchim Draft.exe"
if not exist "%TCHIM_DATA_DIR%\preview.json" (
  echo Le profil de test doit etre prepare avec node scripts/prepare-local-preview.mjs.
  pause
  exit /b 1
)
if not exist "%TCHIM_EXECUTABLE%" (
  echo La version de test locale doit etre construite avant son lancement.
  pause
  exit /b 1
)
start "" "%TCHIM_EXECUTABLE%"
