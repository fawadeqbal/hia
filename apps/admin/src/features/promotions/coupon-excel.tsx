'use client';

import { useQueryClient } from '@tanstack/react-query';
import { DISCOUNT_TYPE_LABELS, type CouponDto } from '@ecommerce/types';
import { ExcelDownloadButton } from '@/components/excel/excel-download-button';
import { ExcelUploadButton } from '@/components/excel/excel-upload-button';
import { promotionsApi, queryKeys } from '@/lib/api-client';
import { downloadExcel, excelDate, excelFilename, yesNo, type ExcelColumn } from '@/lib/excel';

const columns: ExcelColumn<CouponDto>[] = [
  { header: 'Code', value: (c) => c.code, width: 16 },
  { header: 'Description', value: (c) => c.description ?? '', width: 30 },
  { header: 'Type', value: (c) => DISCOUNT_TYPE_LABELS[c.discountType], width: 17 },
  { header: 'Value', value: (c) => (c.discountType === 'FREE_SHIPPING' ? '' : c.value), width: 9 },
  { header: 'Min order', value: (c) => c.minOrderTotal ?? '', width: 11 },
  { header: 'Max discount', value: (c) => c.maxDiscount ?? '', width: 13 },
  { header: 'Usage limit', value: (c) => c.usageLimit ?? '', width: 12 },
  { header: 'Per customer limit', value: (c) => c.usageLimitPerCustomer ?? '', width: 18 },
  { header: 'Starts', value: (c) => excelDate(c.startsAt, true), width: 17 },
  { header: 'Ends', value: (c) => excelDate(c.endsAt, true), width: 17 },
  { header: 'Active', value: (c) => yesNo(c.isActive), width: 9 },
  { header: 'Used', value: (c) => c.usedCount, width: 8 },
];

/** Download / upload Excel on the coupon list. */
export function CouponExcelTools() {
  const queryClient = useQueryClient();
  return (
    <>
      <ExcelDownloadButton
        name="coupons"
        columns={columns}
        load={promotionsApi.adminCoupons.list}
      />
      <ExcelUploadButton
        title="Upload coupons from Excel"
        keyLabel="Code"
        requiredColumns={['code']}
        onTemplate={async () =>
          downloadExcel(
            excelFilename('coupons-template'),
            columns,
            await promotionsApi.adminCoupons.list(),
            'Coupons',
          )
        }
        help={
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Coupons are matched by <b>Code</b>; a new code makes a new coupon (for every product).
            </li>
            <li>
              <b>Type</b>: Percentage off, Fixed amount off or Free delivery. <b>Value</b>: the % or
              the amount in Rs.
            </li>
            <li>
              Min order, Max discount and limits: <code>0</code> = none. Dates like{' '}
              <code>2026-12-01</code> or <code>2026-12-01 09:00</code>. Active: Yes / No.
            </li>
            <li>Empty cells keep the current value. The Used column is not read.</li>
          </ul>
        }
        run={(rows, dryRun) => promotionsApi.adminCoupons.importRows({ rows, dryRun })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all })}
      />
    </>
  );
}
