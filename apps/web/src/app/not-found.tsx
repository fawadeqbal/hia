import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you are looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block font-medium text-brand-700">
        Back to home
      </Link>
    </div>
  );
}
