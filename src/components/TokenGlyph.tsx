// Inline SVG glyph for a token. We render every token as a brand-tinted
// circle with the token's ticker as text inside, so the UI looks consistent
// across all chains without taking a dependency on a token-icon library.
// Tokens with longer names are scaled down so they still fit inside the
// circle. The colour is a brand variant — same hue across every token.

interface TokenGlyphProps {
  name: string;
  className?: string;
}

function fontSizeForLength(length: number): number {
  // Tuned against the 20px (size-5) container we render at: keep the longest
  // ticker we care about (USDT, WBTC, xDAI, ZCHF, dEURO, nDEPS) legible.
  if (length <= 2) return 11;
  if (length === 3) return 9;
  if (length === 4) return 7.5;
  if (length === 5) return 6.5;
  return 5.5;
}

export function TokenGlyph({ name, className }: TokenGlyphProps) {
  const label = (name || "?").toUpperCase().slice(0, 6);
  const fontSize = fontSizeForLength(label.length);

  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="10" fill="var(--color-brand)" />
      <text
        x="10"
        y="10"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontFamily="var(--font-sans, Inter, system-ui, sans-serif)"
        fontWeight="700"
        fontSize={fontSize}
      >
        {label}
      </text>
    </svg>
  );
}
