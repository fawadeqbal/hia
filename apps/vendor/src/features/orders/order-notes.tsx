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
  Textarea,
  formatDateTime,
} from '@ecommerce/ui';
import { documentsApi, queryKeys } from '@/lib/api-client';

/** Internal / customer-visible notes on an order. Seller: notes on this sub-order (staff see them too). */
export function OrderNotes({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const key = queryKeys.orderNotes('vendor', id);
  const [content, setContent] = useState('');
  const [visible, setVisible] = useState(false);
  const { data, error } = useQuery({ queryKey: key, queryFn: () => documentsApi.vendorNotes(id) });
  const add = useMutation({
    mutationFn: () =>
      documentsApi.addVendorNote(id, { content: content.trim(), isCustomerVisible: visible }),
    onSuccess: async () => {
      setContent('');
      setVisible(false);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => documentsApi.removeVendorNote(id, noteId),
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
