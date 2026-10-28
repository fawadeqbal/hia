import { parseCsv } from '@ecommerce/types';
import { createProblems, mapHeader, readRow } from './product-csv-rules';

describe('product CSV', () => {
  it('parses quotes, commas and new lines inside quotes', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('maps headers loosely and requires sku', () => {
    expect(mapHeader(['SKU', 'Compare at price']).index.get('compare_at_price')).toBe(1);
    expect(mapHeader(['name']).missing).toEqual(['sku']);
  });

  it('reads a valid row and treats empty cells as unchanged', () => {
    const { index } = mapHeader(['sku', 'name', 'price', 'compare_at_price', 'weight_grams']);
    const { row, problems } = readRow(['HIA-GL-1', 'Gas Lift', '2,200', '', ''], index);
    expect(problems).toEqual([]);
    expect(row).toEqual({ sku: 'HIA-GL-1', name: 'Gas Lift', price: 2200 });
    expect(createProblems(row)).toEqual(['new product needs category']);
  });

  it('reports bad values', () => {
    const { index } = mapHeader(['sku', 'price', 'compare_at_price', 'weight_grams']);
    const { problems } = readRow(['bad sku!', '-5', '1', '2.5'], index);
    expect(problems).toHaveLength(3);
  });
});
