import type { NavGroup } from '@ecommerce/ui';

export const navigation: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
      },
      {
        label: 'Analytics',
        href: '/analytics',
      },
    ],
  },
  {
    title: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/products',
      },
      {
        label: 'Add product',
        href: '/products/new',
      },
      {
        label: 'Inventory',
        href: '/inventory',
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        label: 'Orders',
        href: '/orders',
      },
      {
        label: 'Returns',
        href: '/returns',
      },
      {
        label: 'Coupons',
        href: '/coupons',
      },
    ],
  },
  {
    title: 'Customers',
    items: [
      {
        label: 'Reviews',
        href: '/reviews',
      },
      {
        label: 'Questions',
        href: '/questions',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Earnings',
        href: '/finance',
      },
      {
        label: 'Payouts',
        href: '/finance/payouts',
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        label: 'Store profile',
        href: '/settings/store',
      },
      {
        label: 'Payout details',
        href: '/settings/payout',
      },
      {
        label: 'Staff',
        href: '/settings/staff',
      },
    ],
  },
];
