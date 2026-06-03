Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;
using System.Text;

public class AsciiPrinter {
    public static void Print(string path) {
        using (Bitmap bmp = new Bitmap(path)) {
            // We want to scan the cropped image of size 420 x 100
            // Let's downsample it to 105 columns and 25 rows
            int cols = 105;
            int rows = 25;
            int xStep = bmp.Width / cols;
            int yStep = bmp.Height / rows;

            StringBuilder sb = new StringBuilder();
            for (int r = 0; r < rows; r++) {
                for (int c = 0; c < cols; c++) {
                    // Average luminance in the cell
                    double sum = 0;
                    int count = 0;
                    for (int dy = 0; dy < yStep; dy++) {
                        for (int dx = 0; dx < xStep; dx++) {
                            int px = c * xStep + dx;
                            int py = r * yStep + dy;
                            if (px < bmp.Width && py < bmp.Height) {
                                Color color = bmp.GetPixel(px, py);
                                sum += color.R * 0.299 + color.G * 0.587 + color.B * 0.114;
                                count++;
                            }
                        }
                    }
                    double avg = sum / count;
                    // Draw '#' for dark pixels, '.' for light ones
                    sb.Append(avg < 110 ? "#" : ".");
                }
                sb.AppendLine();
            }
            Console.WriteLine(sb.ToString());
        }
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing
[AsciiPrinter]::Print("C:\Users\Bartko\.gemini\antigravity-ide\brain\e565dfe7-a75f-49b9-a407-67ca3c3986c6\check_text.png")
