[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
$imgPath = Resolve-Path "images/logo_biele.jpg"
$img = [System.Drawing.Image]::FromFile($imgPath)
Write-Output "Width: $($img.Width), Height: $($img.Height)"
$img.Dispose()
