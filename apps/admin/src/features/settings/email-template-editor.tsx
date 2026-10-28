'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  EMAIL_GROUP_LABELS,
  EMAIL_VARIABLES,
  type EmailTemplateDetail,
  type EmailTemplateInput,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@ecommerce/ui';
import { emailAdminApi, queryKeys } from '@/lib/api-client';

export function EmailTemplateEditor({ templateKey }: { templateKey: string }) {
  const { data, error } = useQuery({
    queryKey: queryKeys.emailAdmin.template(templateKey),
    queryFn: () => emailAdminApi.template(templateKey),
  });
  if (error)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the email">
          {error.message}
        </Alert>
      </div>
    );
  if (!data) return <Spinner className="p-6" />;
  return <Editor key={data.updatedAt ?? 'default'} t={data} />;
}

function Editor({ t }: { t: EmailTemplateDetail }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(t.subject ?? '');
  const [heading, setHeading] = useState(t.overrides.heading ?? '');
  const [body, setBody] = useState(t.overrides.body ?? '');
  const [ctaLabel, setCtaLabel] = useState(t.overrides.ctaLabel ?? '');
  const [isActive, setIsActive] = useState(t.isActive);
  const [testTo, setTestTo] = useState('');
  const [resetting, setResetting] = useState(false);
  const input = (): EmailTemplateInput => ({
    subject: subject || null,
    overrides: t.blocks
      ? { heading: heading || null, body: body || null, ctaLabel: ctaLabel || null }
      : {},
    isActive,
  });
  const done = async (d: EmailTemplateDetail) => {
    queryClient.setQueryData(queryKeys.emailAdmin.template(t.key), d);
    await queryClient.invalidateQueries({ queryKey: queryKeys.emailAdmin.templates });
  };
  const save = useMutation({
    mutationFn: () => emailAdminApi.saveTemplate(t.key, input()),
    onSuccess: done,
  });
  const reset = useMutation({
    mutationFn: () => emailAdminApi.resetTemplate(t.key),
    onSuccess: async (d) => {
      setResetting(false);
      await done(d);
    },
  });
  const preview = useMutation({ mutationFn: () => emailAdminApi.preview(t.key, input()) });
  const test = useMutation({ mutationFn: () => emailAdminApi.sendTest(t.key, testTo.trim()) });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/settings/email-templates" className="hover:text-gray-700">
            ← Emails
          </Link>
        }
        title={t.name}
        description={`${EMAIL_GROUP_LABELS[t.group] ?? t.group} · ${t.key}`}
        actions={
          t.editable ? (
            <>
              {t.customized ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    reset.reset();
                    setResetting(true);
                  }}
                >
                  Reset to default
                </Button>
              ) : null}
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                Save
              </Button>
            </>
          ) : null
        }
      />
      <div className="mb-4 flex gap-2">
        {t.marketing ? <Badge tone="blue">Marketing (respects opt-outs)</Badge> : null}
        {t.required ? <Badge tone="gray">Required</Badge> : null}
      </div>
      {!t.editable ? (
        <Alert tone="info" className="mb-4">
          The subject and text of this email are written for each send in{' '}
          <Link href="/marketing/campaigns" className="font-medium underline">
            Marketing → Campaigns
          </Link>
          .
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          {save.isSuccess ? (
            <Alert tone="success">Saved. New emails use this version.</Alert>
          ) : null}
          <fieldset disabled={!t.editable} className="space-y-6">
            <Card className="space-y-4">
              <Input
                label="Subject"
                placeholder={t.defaultSubject}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                hint="Empty = the default shown in grey."
              />
              {t.blocks ? (
                <>
                  <Input
                    label="Heading"
                    placeholder="Default heading"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                  />
                  <Textarea
                    label="Text"
                    rows={6}
                    placeholder="Default text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    hint="Each line becomes a paragraph. Empty = default."
                  />
                  <Input
                    label="Button text"
                    placeholder="Default"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  This email has a designed layout: only the subject can be changed here.
                </p>
              )}
              <p className="text-xs text-gray-500">
                Placeholders:{' '}
                {EMAIL_VARIABLES.map((v) => (
                  <code key={v} className="mr-1 rounded bg-gray-100 px-1">{`{{${v}}}`}</code>
                ))}
              </p>
              <Checkbox
                label="Send this email"
                description={
                  t.required
                    ? 'Required for sign-in and orders: always on.'
                    : 'Off = this email is never sent.'
                }
                checked={isActive}
                disabled={t.required}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </Card>
          </fieldset>
          <Card className="space-y-3">
            <CardTitle>Send a test</CardTitle>
            <p className="text-sm text-gray-500">Sends the saved version with sample data.</p>
            <div className="flex gap-2">
              <Input
                aria-label="Test address"
                type="email"
                placeholder="you@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!testTo.includes('@')}
                loading={test.isPending}
                onClick={() => test.mutate()}
              >
                Send
              </Button>
            </div>
            {test.data ? <Alert tone="success">{test.data.message}</Alert> : null}
            {test.error ? <Alert tone="error">{test.error.message}</Alert> : null}
          </Card>
        </div>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Preview</CardTitle>
            <Button
              variant="outline"
              size="sm"
              loading={preview.isPending}
              onClick={() => preview.mutate()}
            >
              {preview.data ? 'Refresh preview' : 'Show preview'}
            </Button>
          </div>
          {preview.error ? <Alert tone="error">{preview.error.message}</Alert> : null}
          {preview.data ? (
            <>
              <p className="text-sm">
                <span className="text-gray-500">Subject:</span>{' '}
                <strong>{preview.data.subject}</strong>
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview.data.html}
                className="h-[560px] w-full rounded border border-gray-200 bg-white"
              />
            </>
          ) : (
            <p className="text-sm text-gray-500">Shows your unsaved edits with sample data.</p>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={resetting}
        title="Reset to the default email?"
        description="Your subject and text changes are removed."
        confirmLabel="Reset"
        loading={reset.isPending}
        error={reset.error?.message}
        onConfirm={() => reset.mutate()}
        onCancel={() => setResetting(false)}
      />
    </div>
  );
}
