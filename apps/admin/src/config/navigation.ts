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
        label: 'Reports',
        href: '/reports',
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
        label: 'Customers',
        href: '/customers',
      },
    ],
  },
  {
    title: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/catalog/products',
      },
      {
        label: 'Categories',
        href: '/catalog/categories',
      },
      {
        label: 'Brands',
        href: '/catalog/brands',
      },
      {
        label: 'Attributes',
        href: '/catalog/attributes',
      },
      {
        label: 'Inventory',
        href: '/inventory',
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        label: 'Vendors',
        href: '/vendors',
      },
      {
        label: 'Payouts',
        href: '/vendors/payouts',
      },
      {
        label: 'Commissions',
        href: '/vendors/commissions',
      },
      {
        label: 'Disputes',
        href: '/vendors/disputes',
      },
    ],
  },
  {
    title: 'Marketing',
    items: [
      {
        label: 'Coupons',
        href: '/promotions/coupons',
      },
      {
        label: 'Discounts',
        href: '/promotions/discounts',
      },
      {
        label: 'Gift cards',
        href: '/promotions/gift-cards',
      },
      {
        label: 'Loyalty',
        href: '/loyalty',
      },
      {
        label: 'Rewards activity',
        href: '/loyalty/activity',
      },
      {
        label: 'Campaigns',
        href: '/marketing/campaigns',
      },
      {
        label: 'Subscribers',
        href: '/marketing/subscribers',
      },
    ],
  },
  {
    title: 'Content',
    items: [
      {
        label: 'Pages',
        href: '/cms/pages',
      },
      {
        label: 'Banners',
        href: '/cms/banners',
      },
      {
        label: 'Menus',
        href: '/cms/menus',
      },
      {
        label: 'Blog',
        href: '/cms/blog',
      },
      {
        label: 'FAQs',
        href: '/cms/faqs',
      },
      {
        label: 'SEO',
        href: '/seo',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        label: 'Tickets',
        href: '/support/tickets',
      },
      {
        label: 'Reviews & Q&A',
        href: '/support/reviews',
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        label: 'Store',
        href: '/settings',
      },
      {
        label: 'Shipping',
        href: '/settings/shipping',
      },
      {
        label: 'Payments',
        href: '/settings/payments',
      },
      {
        label: 'Taxes',
        href: '/settings/taxes',
      },
      {
        label: 'Localization',
        href: '/settings/localization',
      },
      {
        label: 'Email templates',
        href: '/settings/email-templates',
      },
      {
        label: 'Roles',
        href: '/settings/roles',
      },
      {
        label: 'Admin users',
        href: '/settings/users',
      },
      {
        label: 'Audit logs',
        href: '/settings/audit-logs',
      },
    ],
  },
];
