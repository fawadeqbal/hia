'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_TONES,
  INQUIRY_TOPIC_LABELS,
  type InquiryDto,
  type InquiryStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  DetailList,
  PageHeader,
  Spinner,
  Textarea,
  Timeline,
  buttonStyles,
  formatDateTime,
} from '@ecommerce/ui';
import { inquiriesApi, queryKeys } from '@/lib/api-client';

/** Pakistani numbers like 0300… become 92300… for WhatsApp links. */
function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

const NEXT: Record<InquiryStatus, { status: InquiryStatus; label: string }[]> = {
  OPEN: [
    { status: 'PENDING', label: 'Mark in progress' },
    { status: 'RESOLVED', label: 'Mark done' },
  ],
  PENDING: [{ status: 'RESOLVED', label: 'Mark done' }],
  RESOLVED: [{ status: 'PENDING', label: 'Reopen' }],
  CLOSED: [{ status: 'PENDING', label: 'Reopen' }],
};

export function InquiryDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const { data: q, error } = useQuery({
    queryKey: queryKeys.inquiries.detail(id),
    queryFn: () => inquiriesApi.adminGet(id),
  });

  const afterChange = async (updated: InquiryDto) => {
    queryClient.setQueryData(queryKeys.inquiries.detail(id), updated);
    await queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all, refetchType: 'none' });
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
  };
  const setStatus = useMutation({
    mutationFn: (status: InquiryStatus) => inquiriesApi.setStatus(id, { status }),
    onSuccess: afterChange,
  });
  const addNote = useMutation({
    mutationFn: () => inquiriesApi.addNote(id, { body: note }),
    onSuccess: async (updated) => {
      setNote('');
      await afterChange(updated);
    },
  });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the inquiry">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!q) return <Spinner className="p-6" />;

  const wa = whatsappNumber(q.phone);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/inquiries" className="hover:text-gray-700">
            ← Inquiries
          </Link>
        }
        title={q.subject}
        description={`${q.number} · received ${formatDateTime(q.createdAt)}`}
        actions={NEXT[q.status].map((a) => (
          <Button
            key={a.status}
            variant={a.status === 'RESOLVED' ? 'primary' : 'outline'}
            loading={setStatus.isPending && setStatus.variables === a.status}
            onClick={() => setStatus.mutate(a.status)}
          >
            {a.label}
          </Button>
        ))}
      />
      {setStatus.error ? (
        <Alert tone="error" className="mb-4">
          {setStatus.error.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>{INQUIRY_TOPIC_LABELS[q.topic]}</CardTitle>
              <Badge tone={INQUIRY_STATUS_TONES[q.status]}>{INQUIRY_STATUS_LABELS[q.status]}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{q.message}</p>
          </Card>

          <Card className="space-y-4">
            <CardTitle>Notes</CardTitle>
            {q.notes.length > 0 ? (
              <Timeline
                items={q.notes.map((n) => ({
                  id: n.id,
                  title: n.authorName ?? 'Staff',
                  meta: formatDateTime(n.createdAt),
                  description: n.body,
                }))}
              />
            ) : (
              <p className="text-sm text-gray-500">
                Keep track of calls, quotes and visits here. Only staff see notes.
              </p>
            )}
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate();
              }}
            >
              <Textarea
                label="Add a note"
                rows={3}
                value={note}
                placeholder="e.g. Called, quoted Rs 2,200 per gas lift. Visit on Monday."
                onChange={(e) => setNote(e.target.value)}
              />
              {addNote.error ? <Alert tone="error">{addNote.error.message}</Alert> : null}
              <Button type="submit" size="sm" loading={addNote.isPending} disabled={!note.trim()}>
                Save note
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3">
            <CardTitle>Contact</CardTitle>
            <DetailList
              items={[
                { label: 'Name', value: q.name },
                { label: 'Phone', value: q.phone },
                { label: 'Email', value: q.email },
              ]}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {q.phone ? (
                <a href={`tel:${q.phone.replace(/\s/g, '')}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  Call
                </a>
              ) : null}
              {wa ? (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  WhatsApp
                </a>
              ) : null}
              {q.email ? (
                <a
                  href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.subject} (${q.number})`)}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  Email
                </a>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
