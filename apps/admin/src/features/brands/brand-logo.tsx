/* eslint-disable @next/next/no-img-element -- logos can come from any host */
/** Small square logo with a letter fallback. Plain <img> because logos can come from any host. */
export function BrandLogo({
  name,
  url,
  size = 32,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-md border border-gray-200 bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
