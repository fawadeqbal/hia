import type { Metadata } from 'next';
import { AttributeEditor } from '@/features/attributes/attribute-editor';

export const metadata: Metadata = { title: 'New attribute' };

export default function NewAttributePage() {
  return <AttributeEditor />;
}
