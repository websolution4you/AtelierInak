Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class Cropper {
    public static void Crop(string srcPath, string dstPath) {
        using (Bitmap bmp = new Bitmap(srcPath)) {
            Rectangle rect = new Rectangle(300, 720, 420, 100);
            using (Bitmap cropped = bmp.Clone(rect, bmp.PixelFormat)) {
                cropped.Save(dstPath, ImageFormat.Png);
            }
        }
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[Cropper]::Crop("c:\Users\Bartko\Desktop\AtelierInak\AtelierInak\images\ira_ruky_hlina_v3.jpg", "C:\Users\Bartko\.gemini\antigravity-ide\brain\e565dfe7-a75f-49b9-a407-67ca3c3986c6\check_text.png")
Write-Output "Cropped debug region to check_text.png"
