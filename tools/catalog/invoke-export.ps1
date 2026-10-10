# Host launcher for the already logged-in Windows 7 desktop. Does not change VM settings.
param([Parameter(Mandatory=$true)][ValidateSet('parts','parent-parts','vehicles','reference-manufacturers','fitment-metadata','fitment-probe','fitment-h4-probe','fitments')][string]$Mode,[switch]$Restart)
$ErrorActionPreference='Stop'
$vbox='C:/Program Files/Oracle/VirtualBox/VBoxManage.exe'
$command='powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\VBOXSVR\1\777\laravel\selection-auto-parts\tools\catalog\run-export.ps1 -Mode '+$Mode
if($Restart) {$command+=' -Restart'}
$digits=@{ '0'='52'; '1'='4f'; '2'='50'; '3'='51'; '4'='4b'; '5'='4c'; '6'='4d'; '7'='47'; '8'='48'; '9'='49' }
$codes=[System.Collections.Generic.List[string]]::new()
foreach($character in $command.ToCharArray()) {
 $codes.Add('38')
 foreach($digit in ('0'+[int][char]$character).ToCharArray()) {
  $code=$digits[[string]$digit]; $codes.Add($code); $codes.Add(([Convert]::ToInt32($code,16)+128).ToString('x2'))
 }
 $codes.Add('b8')
}
# Alt+numpad ASCII works regardless of the guest's current RU/EN input layout.
& $vbox controlvm TecDok keyboardputscancode e0 5b 13 93 e0 db
Start-Sleep -Milliseconds 500
& $vbox controlvm TecDok keyboardputscancode 1d 1e 9e 9d
& $vbox controlvm TecDok keyboardputscancode @codes
& $vbox controlvm TecDok keyboardputscancode 1c 9c
