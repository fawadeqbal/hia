import { renderInvoices, renderPackingSlips, type InvoiceData } from './pdf';

const inv = (n: string): InvoiceData => ({
  number: n,
  issuedAt: new Date('2026-10-12'),
  orderNumber: 'ORD-261012-ABCDE',
  placedAt: new Date('2026-10-11'),
  store: { name: 'Ecommerce', address: 'Lahore', email: 'support@example.com', phone: null },
  seller: { name: 'Demo Electronics', email: 'vendor@example.com', phone: null },
  billTo: ['Sana Ali', 'House 1', 'Lahore, Punjab', 'PK'],
  payment: 'Cash on delivery · Pending',
  lines: [
    {
      name: 'Galaxy A55',
      sku: 'SAM-A55',
      qty: 2,
      unit: '$10.00',
      total: '$20.00',
      tax: '18% incl.',
    },
  ],
  totals: [{ label: 'Total', value: '$20.00', strong: true }],
  notes: ['Prices include GST.'],
});
const pages = (b: Buffer) => (b.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('order PDFs', () => {
  it('renders one invoice page per sub-order', async () => {
    const b = await renderInvoices([inv('INV-1'), inv('INV-2')], { compress: false });
    expect(b.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(b)).toBe(2);
  });

  it('renders packing slips without prices', async () => {
    const b = await renderPackingSlips(
      [
        {
          orderNumber: 'ORD-1',
          placedAt: new Date(),
          seller: 'Demo',
          shipTo: ['Sana'],
          shippingMethod: 'Standard',
          lines: [{ name: 'A', sku: 'S', qty: 1 }],
          customerNote: 'Call first',
        },
      ],
      { compress: false },
    );
    expect(pages(b)).toBe(1);
  });
});
