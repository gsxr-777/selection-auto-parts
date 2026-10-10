param([ValidateSet('parts','parent-parts','vehicles','reference-manufacturers','fitment-metadata','fitment-probe','fitment-h4-probe','fitments')][string]$Mode='parts',[switch]$Restart)
$ErrorActionPreference='Stop'
$root='\\VBOXSVR\1\777\laravel\selection-auto-parts'
$destination='catalog-export'
$helperName='CatalogExport'
if($Mode -eq 'parent-parts') { $destination='catalog-parent-export'; $helperName='CatalogParentExport' }
if($Mode -eq 'reference-manufacturers') { $destination='catalog-reference-export'; $helperName='CatalogReferenceExport' }
if($Mode -eq 'fitment-metadata') { $destination='catalog-fitment-metadata'; $helperName='CatalogFitmentMetadata' }
if($Mode -eq 'fitment-probe') { $destination='catalog-fitment-probe'; $helperName='CatalogFitmentProbe' }
if($Mode -eq 'fitments') { $destination='catalog-fitment-export'; $helperName='CatalogFitments' }
if($Mode -eq 'fitment-h4-probe') { $destination='catalog-fitment-h4-probe'; $helperName='CatalogH4Probe' }
$work=Join-Path ($root+'\.cache') $destination
New-Item -ItemType Directory -Force -Path $work | Out-Null
$compiled=Join-Path ($root+'\.cache') ($helperName+'.exe')
if($Restart) {
 if($Mode -ne 'fitments') {throw 'Restart is supported only for the resumable fitment helper'}
 Get-Process | Where-Object { $_.ProcessName -eq ('selection-auto-parts-'+$helperName) } | Stop-Process
 Start-Sleep -Seconds 5
}
if(@(Get-Process | Where-Object { $_.ProcessName -eq ('selection-auto-parts-'+$helperName) }).Count -gt 0) { throw 'This export helper is already running; wait for it to exit before restarting.' }
$compiler='C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
& $compiler /nologo /r:System.Web.Extensions.dll ('/out:'+$compiled) ($root+'\tools\catalog\CatalogExport.cs') ($root+'\tools\catalog\CatalogFitments.cs') 2>&1 | Out-File ($work+'\compile.txt')
if ($LASTEXITCODE -eq 0) {
  if(Test-Path -LiteralPath ($work+'\exit.txt')) {Remove-Item -LiteralPath ($work+'\exit.txt')}
  'starting' | Out-File ($work+'\driver.txt')
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
  } while ($exportExit -eq 10)
  ('exit='+$exportExit) | Out-File ($work+'\exit.txt')
  Remove-Item -LiteralPath $exportPath
  Remove-Item -LiteralPath ($exportPath+'.config')
}
$Error | Out-File ($work+'\powershell-errors.txt')
