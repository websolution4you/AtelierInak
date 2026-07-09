Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class ImageOptimizer {
    public static void Optimize(string srcPath, string dstPath, int maxWidth, int quality) {
        using (Bitmap src = new Bitmap(srcPath)) {
            int originalWidth = src.Width;
            int originalHeight = src.Height;
            
            int newWidth = originalWidth;
            int newHeight = originalHeight;
            
            if (originalWidth > maxWidth) {
                newWidth = maxWidth;
                newHeight = (int)((double)originalHeight * maxWidth / originalWidth);
            }
            
            using (Bitmap dst = new Bitmap(newWidth, newHeight, PixelFormat.Format24bppRgb)) {
                using (Graphics g = Graphics.FromImage(dst)) {
                    g.CompositingQuality = CompositingQuality.HighQuality;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    
                    g.DrawImage(src, 0, 0, newWidth, newHeight);
                }
                
                ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
                EncoderParameters myEncoderParameters = new EncoderParameters(1);
                EncoderParameter myEncoderParameter = new EncoderParameter(myEncoder, (long)quality);
                myEncoderParameters.Param[0] = myEncoderParameter;
                
                dst.Save(dstPath, jpgEncoder, myEncoderParameters);
                Console.WriteLine("Optimized image saved: " + newWidth + "x" + newHeight + " at " + quality + "% quality.");
            }
        }
    }
    
    private static ImageCodecInfo GetEncoder(ImageFormat format) {
        ImageCodecInfo[] codecs = ImageCodecInfo.GetImageDecoders();
        foreach (ImageCodecInfo codec in codecs) {
            if (codec.FormatID == format.Guid) {
                return codec;
            }
        }
        return null;
    }
}
"@

Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing

$WorkspacePath = "c:\Users\Bartko\Desktop\AtelierInak\AtelierInak"
$SourceImage = Join-Path $WorkspacePath "images\Atelier.jpg"
$DestImage = Join-Path $WorkspacePath "images\atelier_bg.jpg"

Write-Output "Optimizing $SourceImage -> $DestImage"
[ImageOptimizer]::Optimize($SourceImage, $DestImage, 1920, 85)
Write-Output "Optimization completed."
