'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  INQUIRY_TOPIC_LABELS,
  INQUIRY_TOPICS,
  emptyInquiryForm,
  inquiryFormSchema,
  inquiryFormToInput,
  type InquiryFormValues,
  type InquiryTopic,
} from '@ecommerce/types';
import { Alert, Button, Input, Textarea, cn } from '@ecommerce/ui';
import { inquiriesApi } from '@/lib/api-client';

const TOPIC_FROM_URL: Record<string, InquiryTopic> = {
  repair: 'REPAIR',
  quote: 'QUOTE',
  wholesale: 'QUOTE',
  question: 'GENERAL',
};

const PLACEHOLDERS: Record<InquiryTopic, string> = {
  REPAIR:
    'What is wrong with the chair? e.g. "Executive chair sinks when I sit, one wheel is broken." How many chairs, and where are they?',
  QUOTE:
    'What do you need and how many? e.g. "40 gas lifts and 200 castor wheels for our computer lab."',
  GENERAL: 'How can we help?',
};

/** Contact page form → POST /inquiries → shows up in Admin → Inquiries. */
export function ContactForm() {
  const params = useSearchParams();
  const initialTopic = TOPIC_FROM_URL[(params.get('topic') ?? '').toLowerCase()] ?? 'GENERAL';
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: emptyInquiryForm(initialTopic),
  });
  const topic = watch('topic');

  const send = useMutation({
    mutationFn: (values: InquiryFormValues) => inquiriesApi.create(inquiryFormToInput(values)),
    onSuccess: () => reset(emptyInquiryForm(topic)),
  });

  if (send.data) {
    return (
      <div className="space-y-4 rounded-md border border-gray-200 bg-white p-6">
        <p className="type-eyebrow text-brand-600">Message sent</p>
        <h2 className="text-[clamp(22px,2.4vw,30px)] font-extrabold text-gray-900">
          Thank you — we will contact you soon.
        </h2>
        <p className="text-sm text-gray-600">
          Your reference number is <strong className="font-mono">{send.data.number}</strong>. Keep
          it handy if you call us.
        </p>
        <Button variant="outline" onClick={() => send.reset()}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((v) => send.mutate(v))}
      noValidate
      className="space-y-5 rounded-md border border-gray-200 bg-white p-6"
    >
      <fieldset>
        <legend className="type-eyebrow mb-3 text-gray-700">What can we help with?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {INQUIRY_TOPICS.map((t) => (
            <label
              key={t}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors',
                topic === t
                  ? 'border-gray-900 bg-gray-50 font-semibold text-gray-900'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400',
              )}
            >
              <input
                type="radio"
                value={t}
                className="mt-0.5 accent-gray-900"
                {...register('topic')}
                onChange={() => setValue('topic', t)}
                checked={topic === t}
              />
              {INQUIRY_TOPIC_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Your name"
          autoComplete="name"
          {...register('name')}
          error={errors.name?.message}
        />
        <Input
          label="Phone / WhatsApp"
          type="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          {...register('phone')}
          error={errors.phone?.message}
        />
        <Input
          label="Email (optional)"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <Input
          label={topic === 'QUOTE' ? 'Company / institution' : 'Company (optional)'}
          autoComplete="organization"
          {...register('company')}
          error={errors.company?.message}
        />
      </div>
      <Textarea
        label="Message"
        rows={5}
        placeholder={PLACEHOLDERS[topic]}
        {...register('message')}
        error={errors.message?.message}
      />
      {send.error ? <Alert tone="error">{send.error.message}</Alert> : null}
      <Button type="submit" loading={send.isPending} className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
