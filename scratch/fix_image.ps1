Add-Type -AssemblyName System.Drawing

$SourceCode = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class ImageFixer {
    public static void Fix(string srcPath, string dstPath) {
        using (Bitmap bmp = new Bitmap(srcPath)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                // Precise parameters based on edge scanning
                int y = 786;       // Text starts at y=788, we start at 786
                int h = 22;        // Text height is 15px, we cover 22px
                int w = 162;       // Text width is 139px (X=499 to 638), we cover 162px (X=490 to 652)
                
                int leftX = 318;   // Clean left source (X=318 to 480)
                int rightX = 662;  // Clean right source (X=662 to 824)
                int destX = 490;   // Destination text region (X=490 to 652)

                Rectangle leftRect = new Rectangle(leftX, y, w, h);
                Rectangle rightRect = new Rectangle(rightX, y, w, h);
                Rectangle destRect = new Rectangle(destX, y, w, h);
                
                // Copy left clean texture to destination
                using (Bitmap leftPatch = bmp.Clone(leftRect, PixelFormat.Format32bppArgb)) {
                    g.DrawImage(leftPatch, destRect);
                }
                
                // Blend right clean texture with 50% opacity to average gradients and match the wheel curve
                using (Bitmap rightPatch = bmp.Clone(rightRect, PixelFormat.Format32bppArgb)) {
                    ImageAttributes attrs = new ImageAttributes();
                    ColorMatrix matrix = new ColorMatrix(new float[][] {
                        new float[] {1, 0, 0, 0, 0},
                        new float[] {0, 1, 0, 0, 0},
                        new float[] {0, 0, 1, 0, 0},
                        new float[] {0, 0, 0, 0.5f, 0}, // 50% opacity
                        new float[] {0, 0, 0, 0, 1}
                    });
                    attrs.SetColorMatrix(matrix, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
                    
                    g.DrawImage(rightPatch, destRect, 0, 0, w, h, GraphicsUnit.Pixel, attrs);
                }
            }
            
            // Save as high quality JPEG (95% quality)
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
