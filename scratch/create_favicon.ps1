[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null

$sourcePath = Resolve-Path "images/logo_biele.jpg"
$destFavicon = Join-Path (Get-Item ".").FullName "assets/img/favicon.png"
$destApple = Join-Path (Get-Item ".").FullName "assets/img/apple-touch-icon.png"

# Load source image
$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

# 1. Save favicon.png (32x32)
$bmp32 = New-Object System.Drawing.Bitmap(32, 32)
$graph32 = [System.Drawing.Graphics]::FromImage($bmp32)
$graph32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph32.DrawImage($srcImg, 0, 0, 32, 32)
$bmp32.Save($destFavicon, [System.Drawing.Imaging.ImageFormat]::Png)
$graph32.Dispose()
$bmp32.Dispose()

# 2. Save apple-touch-icon.png (180x180)
$bmp180 = New-Object System.Drawing.Bitmap(180, 180)
$graph180 = [System.Drawing.Graphics]::FromImage($bmp180)
$graph180.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph180.DrawImage($srcImg, 0, 0, 180, 180)
$bmp180.Save($destApple, [System.Drawing.Imaging.ImageFormat]::Png)
$graph180.Dispose()
$bmp180.Dispose()

$srcImg.Dispose()

Write-Output "Favicons generated successfully!"
