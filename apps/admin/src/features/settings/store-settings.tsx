'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  SETTING_DEFINITIONS,
  SETTING_GROUP_LABELS,
  validateSetting,
  type SettingDefinition,
  type SettingValue,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@ecommerce/ui';
import { queryKeys, settingsApi } from '@/lib/api-client';

export function StoreSettings() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.get });
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  useEffect(() => {
    if (data) setValues(data.values);
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, SettingDefinition[]>();
    for (const d of SETTING_DEFINITIONS) map.set(d.group, [...(map.get(d.group) ?? []), d]);
    return [...map.entries()];
  }, []);

  const errors = Object.fromEntries(
    SETTING_DEFINITIONS.map((d) => [
      d.key,
      values[d.key] === undefined ? null : validateSetting(d, values[d.key]),
    ]),
  );
  const dirty = !!data && SETTING_DEFINITIONS.some((d) => values[d.key] !== data.values[d.key]);
  const invalid = Object.values(errors).some(Boolean);

  const save = useMutation({
    mutationFn: () => {
      const changed = Object.fromEntries(
        SETTING_DEFINITIONS.filter((d) => values[d.key] !== data?.values[d.key]).map((d) => [
          d.key,
          values[d.key],
        ]),
      );
      return settingsApi.save(changed);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.settings, saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicSettings });
    },
  });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert tone="error" title="Could not load settings">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!data) return <Spinner className="p-6" />;

  const field = (d: SettingDefinition) => {
    const v = values[d.key];
    const err = errors[d.key] ?? undefined;
    if (d.type === 'boolean') {
      return (
        <Checkbox
          key={d.key}
          label={d.label}
          description={d.hint}
          checked={v === true}
          onChange={(e) => setValues({ ...values, [d.key]: e.target.checked })}
        />
      );
    }
    if (d.type === 'text') {
      return (
        <Textarea
          key={d.key}
          label={d.label}
          hint={d.hint}
          rows={3}
          value={String(v ?? '')}
          error={err}
          onChange={(e) => setValues({ ...values, [d.key]: e.target.value })}
        />
      );
    }
    return (
      <Input
        key={d.key}
        label={d.label}
        hint={d.hint}
        type={d.type === 'number' ? 'number' : d.type === 'email' ? 'email' : 'text'}
        step={d.type === 'number' ? 'any' : undefined}
        value={String(v ?? '')}
        error={err}
        onChange={(e) =>
          setValues({
            ...values,
            [d.key]:
              d.type === 'number'
                ? e.target.value === ''
                  ? Number.NaN
                  : Number(e.target.value)
                : e.target.value,
          })
        }
      />
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        title="Store settings"
        description="Store details, checkout, shipping, seller, returns, loyalty and customer-segment settings."
        actions={
          <Button
            loading={save.isPending}
            disabled={!dirty || invalid}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        }
      />
      {save.error ? (
        <Alert tone="error" className="mb-4">
          {save.error.message}
        </Alert>
      ) : null}
      {save.isSuccess && !dirty ? (
        <Alert tone="success" className="mb-4">
          Settings saved.
        </Alert>
      ) : null}
      {values['store.maintenanceMode'] === true ? (
        <Alert tone="warning" className="mb-4" title="Maintenance mode is on">
          Shoppers see a maintenance page and checkout is closed.
        </Alert>
      ) : null}
      <div className="space-y-6">
        {groups.map(([group, defs]) => (
          <Card key={group} className="space-y-4">
            <CardTitle>{SETTING_GROUP_LABELS[group] ?? group}</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">{defs.map(field)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
