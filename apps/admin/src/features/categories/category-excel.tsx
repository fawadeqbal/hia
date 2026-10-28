'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { CategoryListItem } from '@ecommerce/types';
import { ExcelDownloadButton } from '@/components/excel/excel-download-button';
import { ExcelUploadButton } from '@/components/excel/excel-upload-button';
import { categoriesApi, queryKeys } from '@/lib/api-client';
import { downloadExcel, excelFilename, yesNo, type ExcelColumn } from '@/lib/excel';

/** Parent is written as the parent's slug, so the downloaded file can be uploaded again. */
function columns(all: CategoryListItem[]): ExcelColumn<CategoryListItem>[] {
  const slugOf = new Map(all.map((c) => [c.id, c.slug]));
  return [
    { header: 'Slug', value: (c) => c.slug, width: 24 },
    { header: 'Name', value: (c) => c.name, width: 28 },
    {
      header: 'Parent',
      value: (c) => (c.parentId ? (slugOf.get(c.parentId) ?? '') : ''),
      width: 22,
    },
    { header: 'Description', value: (c) => c.description ?? '', width: 40 },
    { header: 'Position', value: (c) => c.position, width: 10 },
    { header: 'Active', value: (c) => yesNo(c.isActive), width: 9 },
    { header: 'Products', value: (c) => c.productCount, width: 10 },
  ];
}

/** Download / upload Excel on the category list (a whole tree in one file). */
export function CategoryExcelTools({ rows }: { rows: CategoryListItem[] | undefined }) {
  const queryClient = useQueryClient();
  const load = async () => rows ?? (await categoriesApi.adminList());
  return (
    <>
      <ExcelDownloadButton name="categories" columns={columns(rows ?? [])} load={load} />
      <ExcelUploadButton
        title="Upload categories from Excel"
        keyLabel="Slug"
        requiredColumns={['name']}
        onTemplate={async () => {
          const all = await load();
          await downloadExcel(
            excelFilename('categories-template'),
            columns(all),
            all,
            'Categories',
          );
        }}
        help={
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Categories are matched by <b>Slug</b>. For a new category leave Slug empty — it is
              made from the Name.
            </li>
            <li>
              <b>Parent</b>: the parent&apos;s slug or name (it can be a new category higher up in
              the file). Empty keeps the current parent; <code>-</code> makes it a main category.
            </li>
            <li>
              <b>Position</b> orders the menu (small numbers first). <b>Active</b>: Yes / No.
            </li>
            <li>Empty cells keep the current value. The Products column is not read.</li>
          </ul>
        }
        run={(sheet, dryRun) => categoriesApi.importRows({ rows: sheet, dryRun })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })}
      />
    </>
  );
}
