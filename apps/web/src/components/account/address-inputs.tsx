import { Input, type InputProps } from '@ecommerce/ui';

export type AddressFieldName =
  | 'fullName'
  | 'phone'
  | 'line1'
  | 'line2'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'countryCode';

/**
 * The address fields grid shared by checkout and the address book.
 * Each form passes `fieldProps(name)` = register(name) + its error message.
 */
export function AddressInputs({
  fieldProps,
}: {
  fieldProps: (name: AddressFieldName) => InputProps;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Full name" autoComplete="name" {...fieldProps('fullName')} />
      <Input label="Phone" type="tel" autoComplete="tel" {...fieldProps('phone')} />
      <div className="sm:col-span-2">
        <Input label="Street address" autoComplete="address-line1" {...fieldProps('line1')} />
      </div>
      <div className="sm:col-span-2">
        <Input
          label="Apartment, suite, etc. (optional)"
          autoComplete="address-line2"
          {...fieldProps('line2')}
        />
      </div>
      <Input label="City" autoComplete="address-level2" {...fieldProps('city')} />
      <Input
        label="State / province (optional)"
        autoComplete="address-level1"
        {...fieldProps('state')}
      />
      <Input
        label="Postal code (optional)"
        autoComplete="postal-code"
        {...fieldProps('postalCode')}
      />
      <Input
        label="Country code"
        hint="2 letters, e.g. PK, US"
        maxLength={2}
        autoComplete="country"
        {...fieldProps('countryCode')}
      />
    </div>
  );
}
