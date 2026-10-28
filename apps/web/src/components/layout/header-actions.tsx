'use client';

import Link from 'next/link';
import { Tooltip, cn } from '@ecommerce/ui';
import { useCart, useMe } from '@/hooks/use-cart';
import { useWishlist } from '@/hooks/use-wishlist';
import { useLocale } from '@/components/locale/locale-provider';
import { BagIcon, HeartIcon, UserIcon } from '@/components/icons';
import { openCartDrawer } from '@/lib/cart-drawer';
import { AccountMenu } from './account-menu';

const iconButton =
  'relative grid h-11 w-11 place-items-center rounded-lg text-gray-900 transition-colors hover:bg-gray-100 hover:text-gray-900';

/** Right side of the header: account, wishlist, bag (opens the cart drawer). */
export function HeaderActions() {
  const { data: cart } = useCart();
  const { t } = useLocale();
  const { data: me } = useMe();
  const count = cart?.itemCount ?? 0;
  const saved = useWishlist().data?.items.length ?? 0;

  return (
    <div className="flex flex-none items-center gap-0.5">
      {me ? (
        <AccountMenu
          firstName={me.firstName}
          lastName={me.lastName}
          email={me.email}
          greeting={t('header.hi', { name: me.firstName })}
          wishlistCount={saved}
        />
      ) : (
        <Tooltip content={t('header.signIn')}>
          <Link href="/login" aria-label={t('header.signIn')} className={iconButton}>
            <UserIcon size={22} />
          </Link>
        </Tooltip>
      )}

      <Tooltip content="Wishlist">
        <Link
          href="/account/wishlist"
          aria-label={`Wishlist (${saved})`}
          className={cn(iconButton, 'hidden sm:grid')}
        >
          <HeartIcon size={22} />
          {saved > 0 ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
          ) : null}
        </Link>
      </Tooltip>

      <Tooltip content={t('header.cart')}>
        <button
          type="button"
          onClick={() => openCartDrawer()}
          aria-label={`${t('header.cart')} (${count})`}
          aria-haspopup="dialog"
          className={iconButton}
        >
          <BagIcon size={22} />
          {count > 0 ? (
            <span
              key={count}
              className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] animate-bump place-items-center rounded-full bg-gray-900 px-1 text-[10.5px] font-bold tabular-nums text-white ring-2 ring-white"
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}
