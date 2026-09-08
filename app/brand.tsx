// Branding is decorative, never an assessment status or interactive assistant.
export function Brand() {
  return (
    <div className="brand">
      {/* Static Vite output has no Next image optimizer; this local asset has explicit dimensions. */}
      {/* oxlint-disable-next-line nextjs/no-img-element */}
      <img
        className="brand-mark"
        src="/brand/translatecheck-logo.png"
        alt=""
        width={56}
        height={56}
        decoding="async"
      />
      <span className="brand-wordmark">
        Translate<span>Check</span>
      </span>
    </div>
  );
}

export function Mascot() {
  return (
    // Static Vite output has no Next image optimizer; this local asset has explicit dimensions.
    // oxlint-disable-next-line nextjs/no-img-element
    <img
      className="brand-mascot"
      src="/brand/translatecheck-mascot.png"
      alt="TranslateCheck’s gold owl mascot"
      width={104}
      height={104}
      decoding="async"
    />
  );
}
