import type { Metadata } from 'next';
import { AttributeList } from '@/features/attributes/attribute-list';

export const metadata: Metadata = { title: 'Attributes' };

export default function AttributesPage() {
  return <AttributeList />;
}
