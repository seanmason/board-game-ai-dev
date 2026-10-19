param([Parameter(Mandatory=$true)][string]$Config,[switch]$Check)
$ErrorActionPreference='Stop'
$readyPath=(Resolve-Path -LiteralPath $Config).Path
$ready=Get-Content -LiteralPath $readyPath -Raw | ConvertFrom-Json
$python=(Get-Command python).Source
$launcher=Join-Path $ready.root 'scripts\wingspan-overnight\launcher.py'
if($Check){ & $python -X utf8 $launcher --config $readyPath --check; if($LASTEXITCODE){throw 'Readiness check failed'}; exit }
& $python -X utf8 $launcher --config $readyPath --check
if($LASTEXITCODE){throw 'Readiness check failed'}
$arguments=@('-X','utf8',('"'+$launcher+'"'),'--config',('"'+$readyPath+'"'),'--start')
$process=Start-Process -FilePath $python -ArgumentList $arguments -WorkingDirectory $ready.root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $ready.out 'supervisor.stdout.log') -RedirectStandardError (Join-Path $ready.out 'supervisor.stderr.log')
Write-Output ('Supervisor started; PID '+$process.Id+'. Deadline receipt: '+(Join-Path $ready.out 'launch.json'))
