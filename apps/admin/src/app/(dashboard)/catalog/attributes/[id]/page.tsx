import type { Metadata } from 'next';
import { AttributeEditor } from '@/features/attributes/attribute-editor';

export const metadata: Metadata = { title: 'Edit attribute' };

export default async function EditAttributePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AttributeEditor id={id} />;
}
