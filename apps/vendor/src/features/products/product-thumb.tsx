/* eslint-disable @next/next/no-img-element -- product images come from object storage */
export function ProductThumb({ url, size = 40 }: { url: string | null; size?: number }) {
  return url ? (
    <img
      src={url}
      alt=""
      className="rounded-md border border-gray-200 bg-white object-contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-400"
      style={{ width: size, height: size }}
    >
      No img
    </span>
  );
}
