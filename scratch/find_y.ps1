Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;

public class YFinder {
    public static void Find(string path) {
        using (Bitmap bmp = new Bitmap(path)) {
            Console.WriteLine("Scanning rows for text...");
            int matchCount = 0;
            int minY = int.MaxValue;
            int maxY = int.MinValue;

            // Scan rows from y=500 to 950
            for (int y = 500; y < 950; y++) {
                // Calculate average luminance of the text region (x = 460 to 560)
                double textLum = 0;
                for (int x = 460; x < 564; x++) {
                    Color c = bmp.GetPixel(x, y);
                    textLum += 0.299 * c.R + 0.587 * c.G + 0.114 * c.B;
                }
                textLum /= 104.0;

                // Calculate average luminance of the left background region (x = 350 to 430)
                double leftBg = 0;
                for (int x = 350; x < 430; x++) {
                    Color c = bmp.GetPixel(x, y);
                    leftBg += 0.299 * bgLuminance(c);
                }
                leftBg /= 80.0;

                // Calculate average luminance of the right background region (x = 594 to 674)
                double rightBg = 0;
                for (int x = 594; x < 674; x++) {
                    Color c = bmp.GetPixel(x, y);
                    rightBg += 0.299 * bgLuminance(c);
                }
                rightBg /= 80.0;

                double bgAvg = (leftBg + rightBg) / 2.0;

                // If the center is significantly darker than the sides on the same row, it contains the text
                if (bgAvg - textLum > 18) {
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    matchCount++;
                    Console.WriteLine("Row " + y + ": Center Lum = " + textLum.ToString("F1") + ", Background Lum = " + bgAvg.ToString("F1") + ", Diff = " + (bgAvg - textLum).ToString("F1"));
                }
            }

            if (matchCount > 0) {
                Console.WriteLine("\nSUCCESS: Text rows detected from Y = " + minY + " to Y = " + maxY);
            } else {
                Console.WriteLine("\nFAILED: No text rows detected. Adjust thresholds.");
            }
        }
    }

    private static double bgLuminance(Color c) {
        return c.R * 0.299 + c.G * 0.587 + c.B * 0.114;
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[YFinder]::Find("c:\Users\Bartko\Desktop\AtelierInak\AtelierInak\images\ira_ruky_hlina_v3.jpg")
