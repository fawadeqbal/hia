import { z } from 'zod';
import { LINK_REGEX } from '../cms/cms';
import { CAMPAIGN_AUDIENCES, type CampaignDto, type CampaignInput } from '../marketing/marketing';
import { CUSTOMER_SEGMENTS } from '../users/customer';

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    subject: z.string().trim().min(3, 'Write a subject line').max(150, 'At most 150 characters'),
    heading: z.string().trim().min(1, 'Heading is required').max(150),
    body: z.string().trim().min(10, 'Write the message').max(10_000),
    ctaLabel: z.string().trim().max(40),
    ctaUrl: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || LINK_REGEX.test(v),
        'Use a site path like /products or a full https:// link',
      ),
    audience: z.enum(CAMPAIGN_AUDIENCES),
    segment: z.union([z.enum(CUSTOMER_SEGMENTS), z.literal('')]),
  })
  .refine((v) => (v.ctaLabel === '') === (v.ctaUrl === ''), {
    path: ['ctaUrl'],
    message: 'Fill in both the button text and the link, or neither',
  });
export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const emptyCampaignForm: CampaignFormValues = {
  name: '',
  subject: '',
  heading: '',
  body: '',
  ctaLabel: 'Shop now',
  ctaUrl: '/products',
  audience: 'everyone',
  segment: '',
};

export const campaignToForm = (c: CampaignDto): CampaignFormValues => ({
  name: c.name,
  subject: c.subject,
  heading: c.content.heading,
  body: c.content.body,
  ctaLabel: c.content.ctaLabel ?? '',
  ctaUrl: c.content.ctaUrl ?? '',
  audience: c.audience,
  segment: c.segment ?? '',
});

export const campaignFormToInput = (v: CampaignFormValues): CampaignInput => ({
  name: v.name.trim(),
  subject: v.subject.trim(),
  content: {
    heading: v.heading.trim(),
    body: v.body.trim(),
    ctaLabel: v.ctaLabel.trim() || null,
    ctaUrl: v.ctaUrl.trim() || null,
  },
  audience: v.audience,
  segment: v.audience === 'subscribers' || v.segment === '' ? null : v.segment,
});

export const newsletterFormSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});
export type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;
