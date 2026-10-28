import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsObject } from 'class-validator';
import { IMPORT_MAX_ROWS, type ImportRowsInput, type SheetRow } from '@ecommerce/types';

/** Body of every Excel upload: the file's rows as { column: text } plus check-only / save. */
export class ImportRowsDto implements ImportRowsInput {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: { type: 'string' } },
    example: [{ sku: 'HIA-WH-60', quantity: '50' }],
  })
  @IsArray()
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @IsObject({ each: true })
  rows: SheetRow[];

  @ApiProperty({ description: 'true = check only, nothing is saved' })
  @IsBoolean()
  dryRun: boolean;
}

/** Cell values may arrive as numbers / booleans from other clients: always work with trimmed text. */
export function sheetRowsAsText(rows: SheetRow[]): SheetRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row ?? {}).map(([k, v]) => [
        k,
        v === null || v === undefined ? '' : String(v).trim(),
      ]),
    ),
  );
}
