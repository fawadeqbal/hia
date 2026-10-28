'use client';

import { StoreLoader } from '@/features/store/store-loader';
import { StoreProfileForm } from '@/features/store/store-profile-form';

export default function StoreSettingsPage() {
  return (
    <StoreLoader>{(store) => <StoreProfileForm key={store.updatedAt} store={store} />}</StoreLoader>
  );
}
