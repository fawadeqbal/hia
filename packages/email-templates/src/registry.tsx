import * as React from 'react';
import { EmailTemplateKey } from '@ecommerce/types';
import WelcomeEmail from './templates/welcome';
import VerifyEmail from './templates/verify-email';
import OtpCodeEmail from './templates/otp-code';
import PasswordResetEmail from './templates/password-reset';
import OrderConfirmationEmail from './templates/order-confirmation';
import OrderStatusEmail from './templates/order-status';
import GenericNotificationEmail from './templates/generic-notification';

type Data = Record<string, unknown>;

export interface TemplateDefinition {
  subject: (data: Data) => string;
  render: (data: Data) => React.ReactElement;
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' && v.length > 0 ? v : fallback);

/** Shortcut for emails that use the generic layout until a dedicated design exists. */
function generic(subject: string | ((d: Data) => string), heading?: string): TemplateDefinition {
  const subjectFn = typeof subject === 'string' ? () => subject : subject;
  return {
    subject: subjectFn,
    render: (d) => (
      <GenericNotificationEmail heading={heading ?? subjectFn(d)} {...(d as object)} />
    ),
  };
}

function status(
  subject: (d: Data) => string,
  headline: string,
  message: string,
): TemplateDefinition {
  return {
    subject,
    render: (d) => <OrderStatusEmail headline={headline} message={message} {...(d as object)} />,
  };
}

const order = (d: Data) => str(d.orderNumber, 'your order');

/**
 * One entry per EmailTemplateKey.
 * TypeScript enforces that every key is handled.
 */
export const templateRegistry: Record<EmailTemplateKey, TemplateDefinition> = {
  // Account
  [EmailTemplateKey.WELCOME]: {
    subject: () => 'Welcome to HIA Furniture Solutions',
    render: (d) => <WelcomeEmail {...(d as object)} />,
  },
  [EmailTemplateKey.VERIFY_EMAIL]: {
    subject: () => 'Confirm your email',
    render: (d) => <VerifyEmail {...(d as object)} />,
  },
  [EmailTemplateKey.LOGIN_OTP]: {
    subject: (d) => `Your login code: ${str(d.code)}`,
    render: (d) => <OtpCodeEmail {...(d as object)} />,
  },
  [EmailTemplateKey.PASSWORD_RESET]: {
    subject: () => 'Reset your password',
    render: (d) => <PasswordResetEmail {...(d as object)} />,
  },
  [EmailTemplateKey.PASSWORD_CHANGED]: generic('Your password was changed'),
  [EmailTemplateKey.ACCOUNT_DELETED]: generic('Your account has been deleted'),

  // Orders
  [EmailTemplateKey.ORDER_CONFIRMATION]: {
    subject: (d) => `Order ${order(d)} confirmed`,
    render: (d) => <OrderConfirmationEmail {...(d as object)} />,
  },
  [EmailTemplateKey.PAYMENT_FAILED]: status(
    (d) => `Payment failed for ${order(d)}`,
    'Payment failed',
    'your payment could not be processed. Please try again.',
  ),
  [EmailTemplateKey.ORDER_CONFIRMED_BY_VENDOR]: status(
    (d) => `${order(d)} is being prepared`,
    'Your order is being prepared',
    'we have confirmed your order and are preparing it.',
  ),
  [EmailTemplateKey.ORDER_SHIPPED]: status(
    (d) => `${order(d)} has shipped`,
    'Your order has shipped',
    'your order is on its way.',
  ),
  [EmailTemplateKey.ORDER_OUT_FOR_DELIVERY]: status(
    (d) => `${order(d)} is out for delivery`,
    'Out for delivery',
    'your order will arrive today.',
  ),
  [EmailTemplateKey.ORDER_DELIVERED]: status(
    (d) => `${order(d)} was delivered`,
    'Delivered',
    'your order has been delivered. Enjoy!',
  ),
  [EmailTemplateKey.ORDER_CANCELLED]: status(
    (d) => `${order(d)} was cancelled`,
    'Order cancelled',
    'your order has been cancelled.',
  ),

  // Returns
  [EmailTemplateKey.RETURN_RECEIVED]: generic('We received your return request'),
  [EmailTemplateKey.RETURN_APPROVED]: generic('Your return was approved'),
  [EmailTemplateKey.RETURN_REJECTED]: generic('Update on your return request'),
  [EmailTemplateKey.REFUND_PROCESSED]: generic('Your refund has been processed'),

  // Customer updates
  [EmailTemplateKey.BACK_IN_STOCK]: generic(
    (d) => `${str(d.productName, 'An item you wanted')} is back in stock`,
  ),
  [EmailTemplateKey.WISHLIST_PRICE_DROP]: generic(
    (d) => `Price drop on ${str(d.productName, 'your wishlist item')}`,
  ),
  [EmailTemplateKey.REVIEW_REQUEST]: generic('How was your order? Leave a review'),

  // To the shop (admin)
  [EmailTemplateKey.VENDOR_NEW_ORDER]: generic((d) => `New order ${order(d)}`),
  [EmailTemplateKey.VENDOR_LOW_STOCK]: generic('Low stock alert'),
  [EmailTemplateKey.VENDOR_RETURN_REQUEST]: generic('New return request'),
  [EmailTemplateKey.ADMIN_NEW_TICKET]: generic((d) => `New inquiry ${str(d.ticketNumber)}`),

  // Contact / repair inquiries
  [EmailTemplateKey.TICKET_CREATED]: generic(
    (d) => `We received your request ${str(d.ticketNumber)}`,
  ),
};
