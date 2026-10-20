: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for Fellowship hook scripts.
REM On Windows: cmd.exe runs the batch portion, which finds and calls bash.
REM On Unix: the shell interprets this as a script (: is a no-op in bash).
REM
REM Hook scripts use extensionless filenames (e.g. "session-start" not
REM "session-start.sh") so Claude Code's Windows auto-detection -- which
REM prepends "bash" to any command containing .sh -- doesn't interfere.
REM
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

REM Allowlist of known hook scripts (mirrors hooks/hooks.json).
REM Reject any other script name to prevent path traversal or arbitrary execution.
REM Update this list whenever a new hook is registered in hooks.json.
set "HOOK_NAME=%~1"
if /i "%HOOK_NAME%"=="session-start" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-plan-gate" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-context-monitor" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-session-end" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-voice-session-start" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-opener-session-start" goto :hook_ok
if /i "%HOOK_NAME%"=="fellowship-drift-check-session-start" goto :hook_ok
REM Retired hooks: silent no-op for one release. A live session registers
REM hooks at SessionStart; if the plugin updates mid-session, the old
REM registration keeps firing until restart. Exit 0 quietly instead of
REM spamming a non-blocking error on every prompt. Remove after v1.2.
if /i "%HOOK_NAME%"=="fellowship-voice-prompt-submit" exit /b 0
echo run-hook.cmd: unknown hook script "%HOOK_NAME%" >&2
exit /b 1
:hook_ok

set "HOOK_DIR=%~dp0"

REM Try Git for Windows bash in standard locations
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM Try bash on PATH (e.g. user-installed Git Bash, MSYS2, Cygwin)
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No bash found - warn loudly so the user knows context injection is skipped
echo Fellowship: bash not found. SessionStart context skipped -- install Git for Windows for full functionality. 1>&2
exit /b 0
CMDBLOCK

# Unix: run the named script directly
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="${1:-}"

# Allowlist of known hook scripts (mirrors hooks/hooks.json).
# Reject any other script name to prevent path traversal or arbitrary execution.
# Update this list whenever a new hook is registered in hooks.json.
case "$SCRIPT_NAME" in
    session-start|fellowship-plan-gate|fellowship-context-monitor|fellowship-session-end|fellowship-voice-session-start|fellowship-opener-session-start|fellowship-drift-check-session-start)
        ;;
    "")
        echo "run-hook.cmd: missing script name" >&2
        exit 1
        ;;
    fellowship-voice-prompt-submit)
        # Retired hook: silent no-op for one release. A live session registers
        # hooks at SessionStart; if the plugin updates mid-session, the old
        # registration keeps firing until restart. Exit 0 quietly instead of
        # spamming a non-blocking error on every prompt. Remove after v1.2.
        exit 0
        ;;
    *)
        echo "run-hook.cmd: unknown hook script \"$SCRIPT_NAME\"" >&2
        exit 1
        ;;
esac

shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
