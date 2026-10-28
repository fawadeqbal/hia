import PDFDocument from 'pdfkit';

/** Plain data for one invoice page (one seller's sub-order). Amounts are already formatted. */
export interface InvoiceData {
  number: string;
  issuedAt: Date;
  orderNumber: string;
  placedAt: Date;
  store: { name: string; address: string | null; email: string | null; phone: string | null };
  seller: { name: string; email: string; phone: string | null };
  billTo: string[];
  payment: string;
  lines: {
    name: string;
    sku: string;
    qty: number;
    unit: string;
    total: string;
    tax: string | null;
  }[];
  totals: { label: string; value: string; strong?: boolean }[];
  notes: string[];
}

export interface PackingSlipData {
  orderNumber: string;
  placedAt: Date;
  seller: string;
  shipTo: string[];
  shippingMethod: string | null;
  lines: { name: string; sku: string; qty: number }[];
  customerNote: string | null;
}

/** Storefront design tokens ("Bazaar Bright"), so documents match the shop. */
const C = {
  brand: '#6445df',
  brandDark: '#532bc7',
  brandSoft: '#ebebff',
  accent: '#ffd32e',
  ink: '#1b1830',
  muted: '#6c6883',
  line: '#e6e3f0',
  canvas: '#f5f4fa',
  white: '#ffffff',
};
const PAGE = { w: 595.28, h: 841.89, x: 40, right: 555.28 };
const WIDTH = PAGE.right - PAGE.x;

const date = (d: Date) =>
  d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function newDoc(compress?: boolean): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margin: 0,
    compress: compress ?? true,
    autoFirstPage: false,
    info: { Producer: 'Storefront', Creator: 'Storefront' },
  });
}

/** Text that never triggers pdfkit's automatic page break. */
function put(
  doc: PDFKit.PDFDocument,
  s: string,
  x: number,
  y: number,
  o: PDFKit.Mixins.TextOptions & { size?: number; bold?: boolean; color?: string } = {},
) {
  const { size = 10, bold = false, color = C.ink, ...rest } = o;
  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(size)
    .fillColor(color)
    .text(s, x, y, { lineBreak: rest.width !== undefined, ...rest });
}

/** Violet band: store name with the yellow dot, document title and meta on the right. */
function band(doc: PDFKit.PDFDocument, store: string, title: string, meta: [string, string][]) {
  doc.rect(0, 0, PAGE.w, 132).fill(C.brand);
  // soft decorative circle
  doc
    .circle(PAGE.w - 40, -20, 90)
    .fillOpacity(0.08)
    .fill(C.white)
    .fillOpacity(1);

  doc.font('Helvetica-Bold').fontSize(22);
  const nameW = doc.widthOfString(store);
  put(doc, store, PAGE.x, 38, { size: 22, bold: true, color: C.white });
  doc.circle(PAGE.x + nameW + 7, 52, 4).fill(C.accent);
  put(doc, title.toUpperCase(), PAGE.x, 72, {
    size: 30,
    bold: true,
    color: C.white,
    characterSpacing: 1,
  });

  // meta pairs, right aligned
  let y = 38;
  for (const [k, v] of meta) {
    put(doc, k, 330, y, { size: 8, color: '#d8d7ff', width: 90, align: 'right' });
    put(doc, v, 425, y, { size: 9.5, bold: true, color: C.white, width: 130, align: 'right' });
    y += 17;
  }
}

/** Height a card needs for its lines (label, bold first line, then the rest). */
function cardHeight(lines: string[]): number {
  const n = lines.filter(Boolean).length;
  return 27 + (n > 0 ? 15 : 0) + Math.max(0, n - 1) * 12.5 + 14;
}

/** Rounded light card with a label and lines. */
function card(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  lines: string[],
) {
  doc.roundedRect(x, y, w, h, 12).fill(C.canvas);
  put(doc, label.toUpperCase(), x + 14, y + 12, {
    size: 7.5,
    bold: true,
    color: C.muted,
    characterSpacing: 0.6,
  });
  let ly = y + 27;
  lines.filter(Boolean).forEach((l, i) => {
    put(doc, l, x + 14, ly, {
      size: i === 0 ? 10.5 : 9,
      bold: i === 0,
      color: i === 0 ? C.ink : C.muted,
      width: w - 28,
      height: 13,
      ellipsis: true,
    });
    ly += i === 0 ? 15 : 12.5;
  });
}

function pill(doc: PDFKit.PDFDocument, text: string, x: number, y: number, bg: string, fg: string) {
  doc.font('Helvetica-Bold').fontSize(8);
  const w = doc.widthOfString(text) + 16;
  doc.roundedRect(x, y, w, 16, 8).fill(bg);
  put(doc, text, x + 8, y + 4.5, { size: 8, bold: true, color: fg });
  return w;
}

function footer(doc: PDFKit.PDFDocument, lines: string[], page: string) {
  const y = PAGE.h - 58;
  doc.moveTo(PAGE.x, y).lineTo(PAGE.right, y).lineWidth(1).strokeColor(C.line).stroke();
  lines.slice(0, 2).forEach((l, i) =>
    put(doc, l, PAGE.x, y + 12 + i * 11, {
      size: 7.5,
      color: C.muted,
      width: WIDTH - 60,
      height: 11,
      ellipsis: true,
    }),
  );
  put(doc, page, PAGE.right - 60, y + 12, { size: 7.5, color: C.muted, width: 60, align: 'right' });
}

/** One page per invoice (each seller's sub-order of the order). */
export function renderInvoices(
  invoices: InvoiceData[],
  opts: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = newDoc(opts.compress);
  invoices.forEach((inv, index) => {
    doc.addPage();
    band(doc, inv.store.name, 'Invoice', [
      ['Invoice no.', inv.number],
      ['Issued', date(inv.issuedAt)],
      ['Order', inv.orderNumber],
      ['Placed', date(inv.placedAt)],
    ]);

    // Parties + payment
    const top = 152;
    const gap = 12;
    const cw = (WIDTH - gap * 2) / 3;
    const sold = [
      inv.seller.name,
      inv.seller.email,
      inv.seller.phone ?? '',
      `via ${inv.store.name}`,
    ];
    // All three cards share the tallest one's height, so nothing spills out.
    const cardH = Math.max(92, cardHeight(sold), cardHeight(inv.billTo));
    card(doc, PAGE.x, top, cw, cardH, 'Sold by', sold);
    card(doc, PAGE.x + cw + gap, top, cw, cardH, 'Bill / ship to', inv.billTo);
    const [method, status] = inv.payment.split(' · ');
    card(doc, PAGE.x + (cw + gap) * 2, top, cw, cardH, 'Payment', [method ?? inv.payment]);
    if (status) {
      const paid = /paid/i.test(status) && !/unpaid|pending/i.test(status);
      pill(
        doc,
        status,
        PAGE.x + (cw + gap) * 2 + 14,
        top + 50,
        paid ? '#c6f5da' : '#ffefb1',
        paid ? '#065f46' : '#92400e',
      );
    }

    // Items table
    let y = top + cardH + 24;
    const col = { name: PAGE.x + 14, qty: 330, unit: 370, tax: 440, total: 495 };
    doc.roundedRect(PAGE.x, y, WIDTH, 26, 8).fill(C.brandSoft);
    const head = (s: string, x: number, w?: number) =>
      put(doc, s, x, y + 9, {
        size: 7.5,
        bold: true,
        color: C.brandDark,
        characterSpacing: 0.6,
        ...(w ? { width: w, align: 'right' as const } : {}),
      });
    head('ITEM', col.name);
    head('QTY', col.qty, 30);
    head('PRICE', col.unit, 62);
    head('TAX', col.tax, 48);
    head('TOTAL', col.total, PAGE.right - 14 - col.total);
    y += 34;

    const totalsHeight = inv.totals.length * 18 + 30;
    const limit = PAGE.h - 80 - totalsHeight - 40;
    inv.lines.forEach((l, i) => {
      doc.font('Helvetica-Bold').fontSize(9.5);
      const nameH = Math.min(doc.heightOfString(l.name, { width: 260 }), 24);
      const rowH = Math.max(nameH + 14, 30);
      if (y + rowH > limit) {
        footer(doc, [], `Page continues`);
        doc.addPage();
        y = 50;
      }
      if (i % 2 === 1) doc.roundedRect(PAGE.x, y - 4, WIDTH, rowH, 6).fill('#faf9fd');
      put(doc, l.name, col.name, y, {
        size: 9.5,
        bold: true,
        width: 260,
        height: 24,
        ellipsis: true,
      });
      put(doc, l.sku, col.name, y + nameH + 1, { size: 7.5, color: C.muted });
      put(doc, String(l.qty), col.qty, y, { size: 9.5, width: 30, align: 'right' });
      put(doc, l.unit, col.unit, y, { size: 9.5, width: 62, align: 'right' });
      put(doc, l.tax ?? '—', col.tax, y, { size: 8.5, color: C.muted, width: 48, align: 'right' });
      put(doc, l.total, col.total, y, {
        size: 9.5,
        bold: true,
        width: PAGE.right - 14 - col.total,
        align: 'right',
      });
      y += rowH;
      doc
        .moveTo(PAGE.x, y - 4)
        .lineTo(PAGE.right, y - 4)
        .lineWidth(0.5)
        .strokeColor(C.line)
        .stroke();
    });

    // Totals
    y += 14;
    const tx = 315;
    const tw = PAGE.right - tx;
    const plain = inv.totals.filter((t) => !t.strong);
    const strong = inv.totals.filter((t) => t.strong);
    plain.forEach((t) => {
      put(doc, t.label, tx + 14, y, { size: 9.5, color: C.muted });
      put(doc, t.value, tx, y, { size: 9.5, bold: true, width: tw - 14, align: 'right' });
      y += 18;
    });
    strong.forEach((t) => {
      y += 4;
      doc.roundedRect(tx, y, tw, 38, 10).fill(C.brand);
      put(doc, t.label, tx + 14, y + 13, { size: 11, bold: true, color: C.white });
      put(doc, t.value, tx, y + 11, {
        size: 15,
        bold: true,
        color: C.white,
        width: tw - 14,
        align: 'right',
      });
      y += 44;
    });

    // Thank-you note on the left of the totals
    const noteTop = y - 18 * plain.length - 44 * strong.length - 4;
    put(doc, 'Thank you for your order!', PAGE.x, Math.max(noteTop, top + cardH + 60), {
      size: 13,
      bold: true,
      color: C.ink,
    });
    put(
      doc,
      'Questions about this invoice? Reply to your order email or contact us below.',
      PAGE.x,
      Math.max(noteTop, top + cardH + 60) + 18,
      { size: 8.5, color: C.muted, width: 250 },
    );

    footer(
      doc,
      [
        inv.notes.join(' '),
        [inv.store.name, inv.store.address, inv.store.email, inv.store.phone]
          .filter(Boolean)
          .join('  ·  '),
      ].filter(Boolean),
      invoices.length > 1 ? `${index + 1} / ${invoices.length}` : '',
    );
  });
  if (invoices.length === 0) {
    doc.addPage();
    put(doc, 'No invoice available.', PAGE.x, 60);
  }
  return toBuffer(doc);
}

/** One page per seller parcel: what to pack, no prices. */
export function renderPackingSlips(
  slips: PackingSlipData[],
  opts: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = newDoc(opts.compress);
  slips.forEach((s) => {
    doc.addPage();
    band(doc, s.seller, 'Packing slip', [
      ['Order', s.orderNumber],
      ['Placed', date(s.placedAt)],
      ['Delivery', s.shippingMethod ?? 'Standard'],
      ['Items', String(s.lines.reduce((n, l) => n + l.qty, 0))],
    ]);
    const top = 152;
    const cardH = Math.max(92, cardHeight(s.shipTo));
    card(doc, PAGE.x, top, WIDTH / 2 - 6, cardH, 'Ship to', s.shipTo);
    if (s.customerNote) {
      doc.roundedRect(PAGE.x + WIDTH / 2 + 6, top, WIDTH / 2 - 6, cardH, 12).fill('#fff7d6');
      put(doc, 'CUSTOMER NOTE', PAGE.x + WIDTH / 2 + 20, top + 12, {
        size: 7.5,
        bold: true,
        color: '#92400e',
        characterSpacing: 0.6,
      });
      put(doc, s.customerNote, PAGE.x + WIDTH / 2 + 20, top + 27, {
        size: 9.5,
        color: C.ink,
        width: WIDTH / 2 - 34,
        height: 56,
        ellipsis: true,
      });
    }
    let y = top + cardH + 24;
    doc.roundedRect(PAGE.x, y, WIDTH, 26, 8).fill(C.brandSoft);
    put(doc, 'PACKED', PAGE.x + 14, y + 9, { size: 7.5, bold: true, color: C.brandDark });
    put(doc, 'ITEM', PAGE.x + 64, y + 9, { size: 7.5, bold: true, color: C.brandDark });
    put(doc, 'SKU', 370, y + 9, { size: 7.5, bold: true, color: C.brandDark });
    put(doc, 'QTY', PAGE.right - 64, y + 9, {
      size: 7.5,
      bold: true,
      color: C.brandDark,
      width: 50,
      align: 'right',
    });
    y += 36;
    for (const l of s.lines) {
      if (y > PAGE.h - 90) {
        doc.addPage();
        y = 50;
      }
      doc
        .roundedRect(PAGE.x + 16, y - 2, 14, 14, 3)
        .lineWidth(1.2)
        .strokeColor(C.brand)
        .stroke();
      put(doc, l.name, PAGE.x + 64, y, {
        size: 10.5,
        bold: true,
        width: 290,
        height: 26,
        ellipsis: true,
      });
      put(doc, l.sku, 370, y + 1, { size: 9, color: C.muted, width: 110 });
      doc.roundedRect(PAGE.right - 50, y - 4, 36, 20, 6).fill(C.canvas);
      put(doc, String(l.qty), PAGE.right - 50, y + 1, {
        size: 11,
        bold: true,
        width: 36,
        align: 'center',
      });
      y += 30;
      doc
        .moveTo(PAGE.x, y - 6)
        .lineTo(PAGE.right, y - 6)
        .lineWidth(0.5)
        .strokeColor(C.line)
        .stroke();
    }
    footer(doc, ['Tick each item as you pack it. No prices are shown on this slip.'], '');
  });
  if (slips.length === 0) {
    doc.addPage();
    put(doc, 'Nothing to pack.', PAGE.x, 60);
  }
  return toBuffer(doc);
}
