import type { NavGroup } from '@ecommerce/ui';

/**
 * HIA Furniture Solutions — shop owner menu. Kept short on purpose.
 * Marketplace screens (sellers, payouts, commissions, loyalty, gift cards, campaigns, blog, taxes,
 * languages, roles…) still exist in the code base but are not linked from the menu.
 */
export const navigation: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Reports', href: '/reports' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Orders', href: '/orders' },
      { label: 'Inquiries', href: '/inquiries' },
      { label: 'Customers', href: '/customers' },
      { label: 'Returns', href: '/returns' },
    ],
  },
  {
    title: 'Products',
    items: [
      { label: 'Products', href: '/catalog/products' },
      { label: 'Categories', href: '/catalog/categories' },
      { label: 'Stock', href: '/inventory' },
      { label: 'Options (size, colour)', href: '/catalog/attributes' },
      { label: 'Coupons', href: '/promotions/coupons' },
    ],
  },
  {
    title: 'Website',
    items: [
      { label: 'Home page banners', href: '/cms/banners' },
      { label: 'Pages', href: '/cms/pages' },
      { label: 'Menus', href: '/cms/menus' },
      { label: 'FAQs', href: '/cms/faqs' },
      { label: 'Reviews & questions', href: '/support/reviews' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Shop settings', href: '/settings' },
      { label: 'Delivery zones', href: '/settings/shipping' },
      { label: 'Payments', href: '/settings/payments' },
    ],
  },
];
