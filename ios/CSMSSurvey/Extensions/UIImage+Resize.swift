import UIKit

extension UIImage {
    /// Returns a copy of the image scaled down so its longest side is at most
    /// `maxDimension` **pixels**. If the image is already smaller, it is returned
    /// unchanged.
    ///
    /// IMPORTANT: the renderer's `format.scale` is forced to 1. Without this,
    /// UIGraphicsImageRenderer defaults to the device screen scale (3× on these
    /// phones), so a "1920" target was actually encoded at 5760 px — ~9× the
    /// pixels and several MB. That oversized payload is what tripped Vercel's
    /// 4.5 MB request limit (HTTP 413) on photo upload. With scale = 1 the JPEG
    /// is the intended size (~0.5–1 MB at quality 0.82).
    func resizedToMaxDimension(_ maxDimension: CGFloat) -> UIImage {
        let longest = max(size.width, size.height) * scale   // work in pixels
        guard longest > maxDimension else { return self }

        let ratio   = maxDimension / longest
        let newSize = CGSize(width:  (size.width  * scale * ratio).rounded(),
                             height: (size.height * scale * ratio).rounded())

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1                       // output pixels == newSize, no 3× blowup
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
