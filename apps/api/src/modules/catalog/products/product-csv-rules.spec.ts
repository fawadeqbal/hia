import { parseCsv } from '@ecommerce/types';
import { changedFields, createProblems, readRow } from './product-csv-rules';

const now = {
  name: 'Gas Lift',
  category: 'gas-lifts',
  price: 2200,
  compareAtPrice: null,
  shortDescription: null,
  description: 'Class 4',
  weightGrams: null,
};

describe('product upload rows', () => {
  it('parses CSV quotes, commas and new lines inside quotes', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('reads a valid row and treats empty cells as unchanged', () => {
    const { row, problems } = readRow({
      sku: 'HIA-GL-1',
      name: 'Gas Lift',
      price: '2,200',
      compare_at_price: '',
    });
    expect(problems).toEqual([]);
    expect(row).toEqual({ sku: 'HIA-GL-1', name: 'Gas Lift', price: 2200 });
    expect(createProblems(row)).toEqual(['new product needs category']);
  });

  it('reports bad values', () => {
    const { problems } = readRow({
      sku: 'bad sku!',
      price: '-5',
      compare_at_price: '1',
      weight_grams: '2.5',
    });
    expect(problems).toHaveLength(3);
  });

  it('lists only the fields that really change', () => {
    expect(changedFields(readRow({ sku: 'A', name: 'Gas Lift', price: '2200' }).row, now)).toEqual(
      [],
    );
    expect(
      changedFields(
        readRow({ sku: 'A', price: '2500', description: 'Class 4', weight_grams: '900' }).row,
        now,
      ),
    ).toEqual(['price', 'weight']);
  });
});
