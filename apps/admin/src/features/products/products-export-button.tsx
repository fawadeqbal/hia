'use client';

import { useMutation } from '@tanstack/react-query';
import { Button, downloadCsv } from '@ecommerce/ui';
import { toolsApi } from '@/lib/api-client';

export function ProductsExportButton() {
  const run = useMutation({
    mutationFn: toolsApi.adminProductsCsv,
    onSuccess: (d) => downloadCsv(d.filename, d.rows),
  });
  return (
    <Button
      variant="outline"
      loading={run.isPending}
      onClick={() => run.mutate()}
      title={run.error?.message}
    >
      Export CSV
    </Button>
  );
}
