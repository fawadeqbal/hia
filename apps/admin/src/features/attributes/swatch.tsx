/** Round colour dot. */
export function Swatch({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full border border-gray-300"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}
