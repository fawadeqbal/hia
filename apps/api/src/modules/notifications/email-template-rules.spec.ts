import { EmailTemplateKey } from '@ecommerce/types';
import { placeholdersIn, validateTemplateEdit } from './email-template-rules';

const input = (over: Record<string, unknown> = {}) => ({
  subject: null,
  overrides: {},
  isActive: true,
  ...over,
});

describe('email template rules', () => {
  it('finds placeholders', () => {
    expect(placeholdersIn('Hi {{ firstName }}, order {{orderNumber}}')).toEqual([
      'firstName',
      'orderNumber',
    ]);
  });

  it('normalises empty values to defaults', () => {
    const r = validateTemplateEdit(
      EmailTemplateKey.WELCOME,
      input({ subject: '  ', overrides: { heading: '' } }),
      { blocks: false },
    );
    expect(r).toEqual({ problems: [], subject: null, overrides: null });
  });

  it('accepts known placeholders and rejects unknown ones', () => {
    const ok = validateTemplateEdit(
      EmailTemplateKey.ORDER_SHIPPED,
      input({ subject: 'Order {{orderNumber}} shipped' }),
      { blocks: false },
    );
    expect(ok.problems).toEqual([]);
    const bad = validateTemplateEdit(
      EmailTemplateKey.ORDER_SHIPPED,
      input({ subject: 'Hi {{password}}' }),
      { blocks: false },
    );
    expect(bad.problems[0]).toContain('{{password}}');
  });

  it('keeps required emails on and blocks campaign content', () => {
    expect(
      validateTemplateEdit(EmailTemplateKey.PASSWORD_RESET, input({ isActive: false }), {
        blocks: false,
      }).problems,
    ).toHaveLength(1);
    expect(
      validateTemplateEdit(EmailTemplateKey.CAMPAIGN, input({ subject: 'x' }), { blocks: true })
        .problems,
    ).toHaveLength(1);
  });

  it('allows blocks only on generic-layout emails', () => {
    const edit = input({ overrides: { body: 'Thanks {{firstName}}!' } });
    expect(
      validateTemplateEdit(EmailTemplateKey.WELCOME, edit, { blocks: false }).problems,
    ).toHaveLength(1);
    const r = validateTemplateEdit(EmailTemplateKey.GIFT_CARD_RECEIVED, edit, { blocks: true });
    expect(r.problems).toEqual([]);
    expect(r.overrides).toEqual({ heading: null, body: 'Thanks {{firstName}}!', ctaLabel: null });
  });
});
