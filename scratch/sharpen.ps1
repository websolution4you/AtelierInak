# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

# C# Code for high-performance image sharpening using LockBits
$SourceCode = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class ImageProcessor {
    public static void Sharpen(string sourcePath, string destPath, float amount) {
        using (Bitmap src = new Bitmap(sourcePath)) {
            int width = src.Width;
            int height = src.Height;
            
            // Create target bitmap with 24bpp format
            using (Bitmap dst = new Bitmap(width, height, PixelFormat.Format24bppRgb)) {
                // Initialize destination image with source image data
                using (Graphics g = Graphics.FromImage(dst)) {
                    g.DrawImage(src, 0, 0, width, height);
                }

                // Lock bits
                BitmapData srcData = src.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
                BitmapData dstData = dst.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);

                int stride = srcData.Stride;
                int bytes = stride * height;
                byte[] srcBytes = new byte[bytes];
                byte[] dstBytes = new byte[bytes];

                Marshal.Copy(srcData.Scan0, srcBytes, 0, bytes);
                Marshal.Copy(dstData.Scan0, dstBytes, 0, bytes);

                // Laplacian sharpening filter
                // Kernel: 
                //  0  -1   0
                // -1   4  -1
                //  0  -1   0
                // High pass value = 4*center - top - bottom - left - right
                // Sharpened = center + amount * HighPass
                
                for (int y = 1; y < height - 1; y++) {
                    for (int x = 1; x < width - 1; x++) {
                        for (int c = 0; c < 3; c++) { // B, G, R channels
                            int idx = y * stride + x * 3 + c;
                            int top = (y - 1) * stride + x * 3 + c;
                            int bottom = (y + 1) * stride + x * 3 + c;
                            int left = y * stride + (x - 1) * 3 + c;
                            int right = y * stride + (x + 1) * 3 + c;

                            int val = srcBytes[idx];
                            int edge = 4 * val - srcBytes[top] - srcBytes[bottom] - srcBytes[left] - srcBytes[right];
                            
                            float sharpened = val + amount * edge;
                            
                            // Clamp value to 0..255
                            if (sharpened < 0) sharpened = 0;
                            if (sharpened > 255) sharpened = 255;
                            
                            dstBytes[idx] = (byte)sharpened;
                        }
                    }
                }

                Marshal.Copy(dstBytes, 0, dstData.Scan0, bytes);

                src.UnlockBits(srcData);
                dst.UnlockBits(dstData);

                // Save with 95% JPEG quality to preserve detail
                ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
                EncoderParameters myEncoderParameters = new EncoderParameters(1);
                EncoderParameter myEncoderParameter = new EncoderParameter(myEncoder, 95L);
                myEncoderParameters.Param[0] = myEncoderParameter;

                dst.Save(destPath, jpgEncoder, myEncoderParameters);
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

# Compile the C# helper class
Add-Type -TypeDefinition $SourceCode -ReferencedAssemblies System.Drawing

# Define absolute paths
$WorkspacePath = "c:\Users\Bartko\Desktop\AtelierInak\AtelierInak"
$SourceImage = Join-Path $WorkspacePath "images\ira_ruky_hlina.jpg"
$DestImage = Join-Path $WorkspacePath "images\ira_ruky_hlina_v2.jpg"

Write-Output "Loading: $SourceImage"
Write-Output "Processing sharpening filter..."

# Execute sharpening with a strength factor of 0.6 (medium-high sharpening)
[ImageProcessor]::Sharpen($SourceImage, $DestImage, 0.6)

Write-Output "Saved sharpened image as: $DestImage"
