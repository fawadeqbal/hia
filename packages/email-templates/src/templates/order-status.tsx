import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface OrderStatusEmailProps {
  firstName?: string;
  orderNumber?: string;
  headline?: string;
  message?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  orderUrl?: string;
}

/** Used for shipped / out-for-delivery / delivered / cancelled / payment updates. */
export default function OrderStatusEmail({
  firstName = 'there',
  orderNumber = 'ORD-0001',
  headline = 'Your order has shipped',
  message = 'Good news, your order is on its way.',
  trackingNumber,
  trackingUrl,
  orderUrl = '#',
}: OrderStatusEmailProps) {
  return (
    <Layout preview={`${headline} · ${orderNumber}`}>
      <Heading style={styles.heading}>{headline}</Heading>
      <Text style={styles.text}>
        Hi {firstName}, {message}
      </Text>
      <Text style={styles.text}>
        Order: <strong>{orderNumber}</strong>
        {trackingNumber ? (
          <>
            <br />
            Tracking number: <strong>{trackingNumber}</strong>
          </>
        ) : null}
      </Text>
      <Button href={trackingUrl ?? orderUrl} style={styles.button}>
        {trackingUrl ? 'Track package' : 'View order'}
      </Button>
    </Layout>
  );
}
