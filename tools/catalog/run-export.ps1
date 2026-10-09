param([ValidateSet('parts','parent-parts','vehicles')][string]$Mode='parts')
$ErrorActionPreference='Stop'
$root='\\VBOXSVR\1\777\laravel\selection-auto-parts'
$destination='catalog-export'
$helperName='CatalogExport'
if($Mode -eq 'parent-parts') { $destination='catalog-parent-export'; $helperName='CatalogParentExport' }
$work=Join-Path ($root+'\.cache') $destination
$compiled=Join-Path ($root+'\.cache') ($helperName+'.exe')
if(Get-Process -Name ('selection-auto-parts-'+$helperName) -ErrorAction SilentlyContinue) { throw 'This export helper is already running; wait for it to exit before restarting.' }
$compiler='C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
& $compiler /nologo /r:System.Web.Extensions.dll ('/out:'+$compiled) ($root+'\tools\catalog\CatalogExport.cs') 2>&1 | Out-File ($work+'\compile.txt')
if ($LASTEXITCODE -eq 0) {
  $exportPath=Join-Path $env:TEMP ('selection-auto-parts-'+$helperName+'.exe')
  Copy-Item -LiteralPath $compiled -Destination $exportPath
  Copy-Item -LiteralPath ($root+'\tools\catalog\CatalogExport.exe.config') -Destination ($exportPath+'.config')
  $iteration=0
  do {
    $iteration++
    if($Mode -eq 'vehicles') { & $exportPath 2>&1 | Out-File ($work+'\runtime.txt') }
    else { & $exportPath ('--'+$Mode) 2>&1 | Out-File ($work+'\runtime.txt') }
    $exportExit=$LASTEXITCODE
    ('batch='+$iteration+' exit='+$exportExit) | Out-File ($work+'\driver.txt')
  } while ($exportExit -eq 10 -and $iteration -lt 1000)
  ('exit='+$exportExit) | Out-File ($work+'\exit.txt')
  Remove-Item -LiteralPath $exportPath
  Remove-Item -LiteralPath ($exportPath+'.config')
}
$Error | Out-File ($work+'\powershell-errors.txt')
