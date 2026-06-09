# Runs after Claude stops each turn.
# Exit 0 - TypeScript OK, notify done
# Exit 2 - TypeScript errors found, re-wake Claude to fix them

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location "c:\Users\Administrator\Desktop\vitadoc-pancake-sla"

$result = & npx tsc --noEmit 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    # Windows popup notification (auto-closes after 4s)
    Start-Process -FilePath "powershell" -WindowStyle Hidden -ArgumentList @(
        "-NonInteractive", "-NoProfile", "-Command",
        "(New-Object -ComObject WScript.Shell).Popup('Task hoan thanh! TypeScript OK', 1, 'Claude Code', 64)"
    )

    Add-Type -AssemblyName System.Media
    [System.Media.SystemSounds]::Asterisk.Play()

    Write-Output '{"systemMessage": "Task hoan thanh! TypeScript OK - khong co loi."}'
    exit 0
} else {
    $errors = ($result | Out-String).Trim()
    $output = @{
        hookSpecificOutput = @{
            hookEventName     = "Stop"
            additionalContext = "TypeScript errors found - fix them before stopping:`n`n$errors"
        }
    }
    $output | ConvertTo-Json -Compress -Depth 5
    exit 2
}
