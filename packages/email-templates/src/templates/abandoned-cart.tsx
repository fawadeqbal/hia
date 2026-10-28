import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface AbandonedCartEmailProps {
  firstName?: string;
  itemCount?: number;
  cartUrl?: string;
  couponCode?: string;
  unsubscribeUrl?: string;
}

export default function AbandonedCartEmail({
  firstName = 'there',
  itemCount = 1,
  cartUrl = '#',
  couponCode,
  unsubscribeUrl = '#',
}: AbandonedCartEmailProps) {
  return (
    <Layout preview="You left something in your cart" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={styles.heading}>Still thinking it over?</Heading>
      <Text style={styles.text}>
        Hi {firstName}, you have {itemCount} item{itemCount === 1 ? '' : 's'} waiting in your cart.
      </Text>
      {couponCode ? (
        <Text style={styles.text}>
          Use code <strong>{couponCode}</strong> at checkout for a little extra off.
        </Text>
      ) : null}
      <Button href={cartUrl} style={styles.button}>
        Return to cart
      </Button>
    </Layout>
  );
}
