'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ORDER_NOTE_MAX, type OrderNoteDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Select,
  Textarea,
  formatDateTime,
} from '@ecommerce/ui';
import { documentsApi, queryKeys } from '@/lib/api-client';

/** Internal / customer-visible notes on an order. Staff: whole order or one seller's part. */
export function OrderNotes({
  id,
  sellers,
}: {
  id: string;
  sellers?: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const key = queryKeys.orderNotes('admin', id);
  const [content, setContent] = useState('');
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState('');
  const { data, error } = useQuery({ queryKey: key, queryFn: () => documentsApi.adminNotes(id) });
  const add = useMutation({
    mutationFn: () =>
      documentsApi.addAdminNote(id, {
        content: content.trim(),
        isCustomerVisible: visible,
        vendorOrderId: target || null,
      }),
    onSuccess: async () => {
      setContent('');
      setVisible(false);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => documentsApi.removeAdminNote(id, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return (
    <Card className="space-y-3">
      <CardTitle>Notes</CardTitle>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {data?.length ? (
        <ul className="space-y-3">
          {data.map((n: OrderNoteDto) => (
            <li key={n.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{n.author.name}</span>
                <Badge tone={n.author.kind === 'SELLER' ? 'blue' : 'gray'}>
                  {n.author.kind === 'SELLER' ? 'Seller' : 'Staff'}
                </Badge>
                {n.vendorName ? <span>· {n.vendorName}</span> : null}
                <span>· {formatDateTime(n.createdAt)}</span>
                {n.isCustomerVisible ? (
                  <Badge tone="yellow">Visible to customer</Badge>
                ) : (
                  <Badge tone="gray">Internal</Badge>
                )}
                {n.canDelete ? (
                  <button
                    type="button"
                    className="ml-auto text-red-600 hover:underline"
                    onClick={() => remove.mutate(n.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-gray-800">{n.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No notes yet.</p>
      )}
      <Textarea
        aria-label="New note"
        rows={3}
        maxLength={ORDER_NOTE_MAX}
        placeholder="Add a note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {sellers && sellers.length > 1 ? (
        <Select
          aria-label="About"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={[
            { value: '', label: 'Whole order' },
            ...sellers.map((s) => ({
              value: s.id,
              label: `Only ${s.name}'s part (the seller sees it)`,
            })),
          ]}
        />
      ) : null}
      <Checkbox
        label="Show to the customer"
        description="Off = only staff and the seller see it."
        checked={visible}
        onChange={(e) => setVisible(e.target.checked)}
      />
      {add.error ? <Alert tone="error">{add.error.message}</Alert> : null}
      <Button
        size="sm"
        disabled={!content.trim()}
        loading={add.isPending}
        onClick={() => add.mutate()}
      >
        Add note
      </Button>
    </Card>
  );
}
