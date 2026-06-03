Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class ImageFixer {
    public static void Fix(string srcPath, string dstPath) {
        using (Bitmap bmp = new Bitmap(srcPath)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                // Parameters for the patch
                int y = 880;      // Vertical start of the wheel rim
                int h = 90;       // Height of the rim patch
                int w = 300;      // Width of the patch (covers the centered text)
                
                int leftX = 50;    // Source X on the left (clean wheel)
                int rightX = 674;  // Source X on the right (clean wheel)
                int destX = 362;   // Destination X (centered text region)

                Rectangle leftRect = new Rectangle(leftX, y, w, h);
                Rectangle rightRect = new Rectangle(rightX, y, w, h);
                Rectangle destRect = new Rectangle(destX, y, w, h);
                
                // Clone left patch
                using (Bitmap leftPatch = bmp.Clone(leftRect, PixelFormat.Format32bppArgb)) {
                    // Draw left patch over destination
                    g.DrawImage(leftPatch, destRect);
                }
                
                // Clone right patch
                using (Bitmap rightPatch = bmp.Clone(rightRect, PixelFormat.Format32bppArgb)) {
                    // Create image attributes for 50% opacity blending
                    ImageAttributes attrs = new ImageAttributes();
                    ColorMatrix matrix = new ColorMatrix(new float[][] {
                        new float[] {1, 0, 0, 0, 0},
                        new float[] {0, 1, 0, 0, 0},
                        new float[] {0, 0, 1, 0, 0},
                        new float[] {0, 0, 0, 0.5f, 0}, // 50% alpha
                        new float[] {0, 0, 0, 0, 1}
                    });
                    attrs.SetColorMatrix(matrix, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
                    
                    // Draw right patch over destination with 50% opacity
                    g.DrawImage(rightPatch, destRect, 0, 0, w, h, GraphicsUnit.Pixel, attrs);
                }
            }
            
            // Save as JPEG with 95% quality
            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
            System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
            EncoderParameters myEncoderParameters = new EncoderParameters(1);
            EncoderParameter myEncoderParameter = new EncoderParameter(myEncoder, 95L);
            myEncoderParameters.Param[0] = myEncoderParameter;
            
            bmp.Save(dstPath, jpgEncoder, myEncoderParameters);
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
$SourceImage = Join-Path $WorkspacePath "images\ira_ruky_hlina_v3.jpg"
$DestImage = Join-Path $WorkspacePath "images\ira_ruky_hlina_v5.jpg"

Write-Output "Patching $SourceImage -> $DestImage"
[ImageFixer]::Fix($SourceImage, $DestImage)
Write-Output "Done patching."
