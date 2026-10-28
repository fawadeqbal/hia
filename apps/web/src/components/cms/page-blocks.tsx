/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import Link from 'next/link';
import type { PageBlock } from '@ecommerce/types';
import { buttonStyles } from '@ecommerce/ui';

/** Renders CMS blocks. Text is rendered as text (never HTML), so content cannot inject scripts. */
export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <div className="space-y-5 text-gray-700">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2
                key={i}
                className="pt-2 text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900"
              >
                {block.text}
              </h2>
            ) : (
              <h3 key={i} className="pt-1 text-lg font-semibold text-gray-900">
                {block.text}
              </h3>
            );
          case 'paragraph':
            return (
              <div key={i} className="space-y-3 leading-7">
                {block.text.split(/\n\s*\n/).map((para, j) => (
                  <p key={j} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            );
          case 'image':
            return (
              <figure key={i} className="space-y-2">
                <img
                  src={block.url}
                  alt={block.alt}
                  className="w-full rounded-xl border border-gray-200"
                />
                {block.caption ? (
                  <figcaption className="text-center text-sm text-gray-500">
                    {block.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'button':
            return (
              <div key={i}>
                <Link href={block.url} className={buttonStyles({ size: 'lg' })}>
                  {block.label}
                </Link>
              </div>
            );
        }
      })}
    </div>
  );
}
