'use client';

import { StoreLoader } from '@/features/store/store-loader';
import { PayoutForm } from '@/features/store/payout-form';

export default function PayoutSettingsPage() {
  return <StoreLoader>{(store) => <PayoutForm key={store.id} store={store} />}</StoreLoader>;
}
