Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;

public class XFinder {
    public static void Find(string path) {
        using (Bitmap bmp = new Bitmap(path)) {
            int y = 795;
            Console.WriteLine("Scanning row " + y + " horizontally for dark characters...");
            for (int x = 380; x < 650; x++) {
                Color c = bmp.GetPixel(x, y);
                double lum = c.R * 0.299 + c.G * 0.587 + c.B * 0.114;
                if (lum < 150) {
                    Console.WriteLine("Pixel X=" + x + ": Luminance=" + lum.ToString("F1"));
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[XFinder]::Find("c:\Users\Bartko\Desktop\AtelierInak\AtelierInak\images\ira_ruky_hlina_v3.jpg")
