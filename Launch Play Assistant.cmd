@echo off
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0serve.py"
  if errorlevel 1 pause
  exit /b
)
if exist "C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt\dependencies\python\python.exe" (
  "C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt\dependencies\python\python.exe" "%~dp0serve.py"
  if errorlevel 1 pause
  exit /b
)
python "%~dp0serve.py"
if errorlevel 1 pause
