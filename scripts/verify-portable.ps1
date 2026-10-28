$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $env:RUNNER_TEMP ('无 Python 验证 ' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$archive = Join-Path $PSScriptRoot '../Windows-Build/Workbench-Windows-Portable.zip'
Expand-Archive -LiteralPath $archive -DestinationPath $testRoot
$application = Join-Path $testRoot 'ProcessEngineerWorkbench'
$exe = Join-Path $application 'ProcessEngineerWorkbench.exe'
if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath (Join-Path $application '_internal/python312.dll'))) {
    throw 'The portable archive is missing the EXE or bundled Python DLL.'
}

$previousPath = $env:PATH
$previousLocalData = $env:LOCALAPPDATA
$process = $null
try {
    $env:PATH = "$env:SystemRoot\System32"
    $env:LOCALAPPDATA = Join-Path $testRoot 'test-user-data'
    if (Get-Command python, py -ErrorAction SilentlyContinue) {
        throw 'Python must be absent from PATH during this verification.'
    }
    $output = & $exe --self-test
    if ($LASTEXITCODE -ne 0) { throw "Portable self-test failed: $output" }
    $runtime = $output | ConvertFrom-Json
    if (!$runtime.ok -or !$runtime.frozen -or !$runtime.bundled_modules -or !$runtime.dpapi -or !$runtime.com_runtime -or !$runtime.html -or !$runtime.excel_reader -or !$runtime.excel_bridge) {
        throw 'The EXE did not verify its bundled runtime.'
    }
    $process = Start-Process -FilePath $exe -ArgumentList '--no-browser', '--documents' -PassThru
    $page = $null
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        if ($process.HasExited) { throw 'The portable service exited before becoming ready.' }
        try {
            $page = Invoke-WebRequest 'http://127.0.0.1:8765/documents' -TimeoutSec 2
            break
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (!$page -or $page.StatusCode -ne 200) { throw 'The portable document page did not become ready.' }
    $match = [regex]::Match($page.Content, 'window\.__WORKBENCH_LOCAL__=(\{[^;]+\});')
    if (!$match.Success) { throw 'The local session was not injected into the page.' }
    $session = $match.Groups[1].Value | ConvertFrom-Json
    if ($session.view -ne 'documents') { throw 'The EXE did not select the document view.' }
    $headers = @{ Origin = 'http://127.0.0.1:8765'; 'X-Workbench-Token' = $session.token }
    $status = Invoke-RestMethod 'http://127.0.0.1:8765/local-api/status' -Headers $headers
    if ($status.running -or $status.fileCount -ne 0) { throw 'Unexpected document state in the clean verification user.' }
    $excelPage = Invoke-WebRequest 'http://127.0.0.1:8765/excel-bridge' -TimeoutSec 5
    if ($excelPage.StatusCode -ne 200 -or $excelPage.Content -notmatch 'window.ExcelLocal=') {
        throw 'The portable Excel bridge resource or its session bootstrap is missing.'
    }
    $blocked = Invoke-WebRequest 'http://127.0.0.1:8765/local-api/status' -Headers @{
        Origin = 'https://example.invalid'; 'X-Workbench-Token' = $session.token
    } -SkipHttpErrorCheck
    if ($blocked.StatusCode -ne 403) { throw 'The local API unexpectedly allowed a remote website.' }
    $summary = @"
## Portable Windows verification

- EXE launched with Python and py removed from PATH.
- Bundled Python, COM support, Tcl/Tk, HTML resources and Windows DPAPI passed.
- Extracted under a directory containing Chinese characters and spaces.
- Local document page, Excel bridge, openpyxl value round-trip and authenticated status request passed.
- Remote website API access remained blocked.
- Office document reading still requires Microsoft Office and authorization testing on the target PC.

Download **Workbench-Windows-x64** from this run's Artifacts and extract the entire package.
"@
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $summary }
    Write-Output 'Portable verification passed without Python on PATH.'
} catch {
    $diagnostic = $_.Exception.Message.Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
    Write-Output "::error title=Portable runtime validation::$diagnostic"
    throw
} finally {
    if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id -Force }
    $env:PATH = $previousPath
    $env:LOCALAPPDATA = $previousLocalData
}
