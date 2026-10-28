'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { newsletterFormSchema } from '@ecommerce/types';
import { marketingApi } from '@/lib/api-client';
import { toast } from '@/lib/toast';

/**
 * Footer signup (double opt-in: a confirmation email is sent). Sits on the ink footer:
 * an underlined field whose line turns marigold on focus, with an arrow submit button.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const join = useMutation({
    mutationFn: (value: string) => marketingApi.subscribe(value),
    onSuccess: () =>
      toast.success('Check your inbox', { description: 'Confirm your email to subscribe.' }),
  });
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="type-display text-[clamp(40px,5vw,72px)] text-gray-50">
          <span className="block">First in line</span>
          <span className="block text-gray-500">for every drop</span>
        </h2>
        <p className="mt-3 max-w-[420px] text-[15px] text-white/65">
          New arrivals, restocks and price drops — once a week, no noise. Unsubscribe any time.
        </p>
      </div>
      {join.isSuccess ? (
        <p
          className="max-w-[460px] border-b border-accent pb-3 font-semibold text-gray-50"
          role="status"
        >
          {join.data.message}
        </p>
      ) : (
        <form
          noValidate
          className="group/nl flex max-w-[460px] items-center gap-3 border-b border-white/30 pb-1 transition-colors focus-within:border-accent"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = newsletterFormSchema.safeParse({ email });
            if (!parsed.success)
              return setInvalid(parsed.error.issues[0]?.message ?? 'Enter a valid email');
            setInvalid(null);
            join.mutate(parsed.data.email);
          }}
        >
          <input
            type="email"
            aria-label="Email address"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-gray-50 placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={join.isPending}
            className="group/sub flex h-11 items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.1em] text-gray-50 hover:text-accent disabled:opacity-60"
          >
            {join.isPending ? 'Joining…' : 'Sign up'}
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover/sub:translate-x-1"
            >
              →
            </span>
          </button>
        </form>
      )}
      {invalid || join.error ? (
        <p className="text-sm font-medium text-accent">{invalid ?? join.error?.message}</p>
      ) : null}
    </div>
  );
}
