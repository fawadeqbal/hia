'use client';

import { useState } from 'react';
import { PageHeader, Tabs } from '@ecommerce/ui';
import { BlogCategories } from './blog-categories';
import { BlogPostList } from './blog-post-list';

type View = 'posts' | 'categories';

export function BlogAdmin() {
  const [view, setView] = useState<View>('posts');
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Blog"
        description="Articles shown at /blog on the storefront. Set a future date to schedule a post."
      />
      <Tabs
        className="mb-6"
        items={[
          { value: 'posts' as View, label: 'Posts' },
          { value: 'categories' as View, label: 'Categories' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'posts' ? <BlogPostList /> : <BlogCategories />}
    </div>
  );
}
