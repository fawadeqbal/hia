import type { Metadata } from 'next';
import { BannerList } from '@/features/cms/banner-list';

export const metadata: Metadata = { title: 'Banners' };

export default function BannersPage() {
  return <BannerList />;
}
