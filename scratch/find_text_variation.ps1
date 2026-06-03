Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;

public class EdgeScanner {
    public static void Scan(string path) {
        using (Bitmap bmp = new Bitmap(path)) {
            Console.WriteLine("Scanning rows for text-like edge transitions...");
            for (int y = 700; y < 850; y++) {
                double totalVar = 0;
                for (int x = 400; x < 620; x++) {
                    Color c1 = bmp.GetPixel(x, y);
                    Color c2 = bmp.GetPixel(x - 1, y);
                    double lum1 = c1.R * 0.299 + c1.G * 0.587 + c1.B * 0.114;
                    double lum2 = c2.R * 0.299 + c2.G * 0.587 + c2.B * 0.114;
                    totalVar += Math.Abs(lum1 - lum2);
                }
                
                // Print variation on each row
                if (totalVar > 400) {
                    Console.WriteLine("Row " + y + ": Edge variation = " + totalVar.ToString("F1"));
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[EdgeScanner]::Scan("c:\Users\Bartko\Desktop\AtelierInak\AtelierInak\images\ira_ruky_hlina_v3.jpg")
