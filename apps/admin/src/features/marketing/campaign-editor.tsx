'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_AUDIENCE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  CUSTOMER_SEGMENTS,
  CUSTOMER_SEGMENT_LABELS,
  campaignFormSchema,
  campaignFormToInput,
  campaignToForm,
  emptyCampaignForm,
  localInputToIso,
  type CampaignDto,
  type CampaignFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  DetailList,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  buttonStyles,
  formatDateTime,
} from '@ecommerce/ui';
import { marketingApi, queryKeys } from '@/lib/api-client';

export function CampaignEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.marketing.campaign(id ?? 'new'),
    queryFn: () => marketingApi.campaign(id as string),
    enabled: id !== undefined,
  });
  if (id === undefined) return <CampaignForm />;
  if (detail.error)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the campaign">
          {detail.error.message}
        </Alert>
      </div>
    );
  if (!detail.data) return <Spinner className="p-6" />;
  return <CampaignForm key={detail.data.updatedAt} campaign={detail.data} />;
}

function CampaignForm({ campaign }: { campaign?: CampaignDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const locked =
    campaign !== undefined && (campaign.status === 'SENDING' || campaign.status === 'SENT');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign ? campaignToForm(campaign) : emptyCampaignForm,
  });
  const audience = watch('audience');
  const segment = watch('segment');
  const count = useQuery({
    queryKey: queryKeys.marketing.audience(audience, segment || null),
    queryFn: () =>
      marketingApi.audienceCount(audience, audience === 'subscribers' || !segment ? null : segment),
  });

  const refresh = async (c: CampaignDto) => {
    queryClient.setQueryData(queryKeys.marketing.campaign(c.id), c);
    await queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns });
  };
  const save = useMutation({
    mutationFn: (v: CampaignFormValues) =>
      campaign
        ? marketingApi.updateCampaign(campaign.id, campaignFormToInput(v))
        : marketingApi.createCampaign(campaignFormToInput(v)),
    onSuccess: async (c) => {
      await refresh(c);
      if (!campaign) router.push(`/marketing/campaigns/${c.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/marketing/campaigns" className="hover:text-gray-700">
            ← Campaigns
          </Link>
        }
        title={campaign ? campaign.name : 'New campaign'}
        actions={
          locked ? null : (
            <Button
              loading={save.isPending}
              disabled={campaign !== undefined && !isDirty}
              onClick={handleSubmit((v) => save.mutate(v))}
            >
              {campaign ? 'Save changes' : 'Save draft'}
            </Button>
          )
        }
      />
      {campaign ? (
        <div className="mb-4">
          <Badge tone={CAMPAIGN_STATUS_TONES[campaign.status]}>
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </Badge>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          <fieldset disabled={locked} className="space-y-6">
            <Card className="space-y-4">
              <Input label="Name (internal)" {...register('name')} error={errors.name?.message} />
              <Input
                label="Subject line"
                {...register('subject')}
                error={errors.subject?.message}
              />
            </Card>
            <Card className="space-y-4">
              <CardTitle>Message</CardTitle>
              <Input label="Heading" {...register('heading')} error={errors.heading?.message} />
              <Textarea
                label="Text"
                rows={8}
                {...register('body')}
                hint="Each line becomes a paragraph."
                error={errors.body?.message}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Button text"
                  {...register('ctaLabel')}
                  error={errors.ctaLabel?.message}
                />
                <Input
                  label="Button link"
                  placeholder="/products"
                  {...register('ctaUrl')}
                  error={errors.ctaUrl?.message}
                />
              </div>
              <p className="text-xs text-gray-500">Every email includes an unsubscribe link.</p>
            </Card>
            <Card className="space-y-4">
              <CardTitle>Audience</CardTitle>
              <Select
                label="Send to"
                {...register('audience')}
                options={CAMPAIGN_AUDIENCES.map((a) => ({
                  value: a,
                  label: CAMPAIGN_AUDIENCE_LABELS[a],
                }))}
              />
              {audience !== 'subscribers' ? (
                <Select
                  label="Customer segment"
                  {...register('segment')}
                  options={[
                    { value: '', label: 'All customers' },
                    ...CUSTOMER_SEGMENTS.map((s) => ({
                      value: s,
                      label: CUSTOMER_SEGMENT_LABELS[s],
                    })),
                  ]}
                />
              ) : null}
              <p className="text-sm text-gray-600">
                {count.data ? `${count.data.count} people will receive it` : 'Counting…'}{' '}
                (unsubscribed and opted-out addresses are skipped).
              </p>
            </Card>
          </fieldset>
        </div>
        {campaign ? <SendPanel campaign={campaign} dirty={isDirty} onChange={refresh} /> : null}
      </div>
    </div>
  );
}

function SendPanel({
  campaign,
  dirty,
  onChange,
}: {
  campaign: CampaignDto;
  dirty: boolean;
  onChange: (c: CampaignDto) => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [testTo, setTestTo] = useState('');
  const [at, setAt] = useState('');
  const [confirmNow, setConfirmNow] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const test = useMutation({ mutationFn: () => marketingApi.sendTest(campaign.id, testTo.trim()) });
  const schedule = useMutation({
    mutationFn: (when: string | null) => marketingApi.schedule(campaign.id, when),
    onSuccess: async (c) => {
      setConfirmNow(false);
      await onChange(c);
    },
  });
  const cancel = useMutation({
    mutationFn: () => marketingApi.cancel(campaign.id),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: () => marketingApi.removeCampaign(campaign.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns });
      router.push('/marketing/campaigns');
    },
  });

  if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
    return (
      <Card>
        <CardTitle className="mb-2">Results</CardTitle>
        <DetailList
          items={[
            {
              label: 'Sent',
              value: campaign.sentAt ? formatDateTime(campaign.sentAt) : 'Sending…',
            },
            { label: 'Recipients', value: campaign.stats?.recipients ?? null },
            { label: 'Emails queued', value: campaign.stats?.queued ?? null },
            { label: 'Failed', value: campaign.stats?.skipped ?? null },
          ]}
        />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {dirty ? <Alert tone="warning">Save your changes before testing or sending.</Alert> : null}
      <Card className="space-y-3">
        <CardTitle>Send a test</CardTitle>
        <Input
          aria-label="Test email address"
          type="email"
          placeholder="you@example.com"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={dirty || !testTo.includes('@')}
          loading={test.isPending}
          onClick={() => test.mutate()}
        >
          Send test
        </Button>
        {test.data ? <Alert tone="success">{test.data.message}</Alert> : null}
        {test.error ? <Alert tone="error">{test.error.message}</Alert> : null}
      </Card>
      <Card className="space-y-3">
        <CardTitle>Send</CardTitle>
        {campaign.status === 'SCHEDULED' && campaign.scheduledAt ? (
          <>
            <p className="text-sm text-gray-600">
              Scheduled for {formatDateTime(campaign.scheduledAt)}.
            </p>
            <Button variant="outline" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel schedule
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Send at"
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={dirty || !at}
              loading={schedule.isPending && schedule.variables !== null}
              onClick={() => schedule.mutate(localInputToIso(at))}
            >
              Schedule
            </Button>
            <Button
              disabled={dirty}
              onClick={() => {
                schedule.reset();
                setConfirmNow(true);
              }}
            >
              Send now
            </Button>
          </>
        )}
        {schedule.error && !confirmNow ? (
          <Alert tone="error">{schedule.error.message}</Alert>
        ) : null}
        {cancel.error ? <Alert tone="error">{cancel.error.message}</Alert> : null}
      </Card>
      <Button
        variant="ghost"
        className="text-red-600 hover:bg-red-50"
        onClick={() => {
          remove.reset();
          setDeleting(true);
        }}
      >
        Delete campaign
      </Button>
      <ConfirmDialog
        open={confirmNow}
        title="Send this campaign now?"
        description="Emails start going out within a minute. This cannot be undone."
        confirmLabel="Send now"
        tone="primary"
        loading={schedule.isPending}
        error={schedule.error?.message}
        onConfirm={() => schedule.mutate(null)}
        onCancel={() => setConfirmNow(false)}
      />
      <ConfirmDialog
        open={deleting}
        title={`Delete "${campaign.name}"?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleting(false)}
      />
      <Link
        href="/marketing/subscribers"
        className={buttonStyles({ variant: 'ghost', size: 'sm' })}
      >
        Newsletter subscribers →
      </Link>
    </div>
  );
}
