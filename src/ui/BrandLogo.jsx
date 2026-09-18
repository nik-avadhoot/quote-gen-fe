export function BrandWordmark({ className = "", inverse = false, style }) {
  const imagePath = inverse
    ? "/brand/brand-kit/png/pkgcanvas-wordmark-inverse-transparent.png"
    : "/brand/brand-kit/png/pkgcanvas-wordmark-primary-transparent.png";
  return (
    <span className={className} style={{ display: "inline-block", position: "relative",
      aspectRatio: "2172 / 360", overflow: "hidden", ...style }} role="img" aria-label="PKGCanvas">
      {/* Keep the complete horizontal master in frame. Only its generous transparent
          top/bottom production padding is trimmed, so the final “s” cannot be clipped. */}
      <img src={imagePath} alt="" aria-hidden="true"
        style={{ position: "absolute", insetInline: 0, top: "50%", width: "100%", height: "auto",
          transform: "translateY(-50%)" }} />
    </span>
  );
}

export function BrandMark({ className = "", inverse = false }) {
  const imagePath = inverse
    ? "/brand/brand-kit/png/pkgcanvas-pc-inverse-dark.png"
    : "/brand/brand-kit/png/pkgcanvas-pc-primary-light.png";
  return (
    <img className={className} src={imagePath} alt="PKGCanvas" />
  );
}
