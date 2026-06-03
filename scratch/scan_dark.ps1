Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;

public class DarkScanner {
    public static void Scan(string path) {
        using (Bitmap bmp = new Bitmap(path)) {
            Console.WriteLine("Scanning for dark pixels...");
            for (int y = 600; y < 900; y++) {
                int darkCount = 0;
                for (int x = 450; x < 570; x++) {
                    Color c = bmp.GetPixel(x, y);
                    double lum = c.R * 0.299 + c.G * 0.587 + c.B * 0.114;
                    if (lum < 100) {
                        darkCount++;
                    }
                }
                if (darkCount > 10) {
                    Console.WriteLine("Row " + y + ": dark pixels count = " + darkCount);
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[DarkScanner]::Scan("c:\Users\Bartko\Desktop\AtelierInak\AtelierInak\images\ira_ruky_hlina_v3.jpg")
