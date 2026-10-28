import * as React from 'react';
import { Button, Column, Heading, Row, Section, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface OrderLine {
  name: string;
  quantity: number;
  total: string;
}

export interface OrderConfirmationEmailProps {
  firstName?: string;
  orderNumber?: string;
  items?: OrderLine[];
  subtotal?: string;
  shipping?: string;
  discount?: string;
  grandTotal?: string;
  paymentMethod?: string;
  orderUrl?: string;
}

export default function OrderConfirmationEmail({
  firstName = 'there',
  orderNumber = 'ORD-0001',
  items = [{ name: 'Sample product', quantity: 1, total: 'Rs 0' }],
  subtotal = 'Rs 0',
  shipping = 'Rs 0',
  discount,
  grandTotal = 'Rs 0',
  paymentMethod = 'Cash on Delivery',
  orderUrl = '#',
}: OrderConfirmationEmailProps) {
  const totals: [string, string | undefined][] = [
    ['Subtotal', subtotal],
    ['Discount', discount],
    ['Shipping', shipping],
  ];
  return (
    <Layout preview={`Order ${orderNumber} confirmed`}>
      <Heading style={styles.heading}>Thanks for your order, {firstName}!</Heading>
      <Text style={styles.text}>
        Order <strong>{orderNumber}</strong> has been placed. Payment: {paymentMethod}.
      </Text>
      <Section style={{ margin: '16px 0' }}>
        {items.map((item, i) => (
          <Row key={i} style={{ borderBottom: '1px solid #eceef1' }}>
            <Column style={{ padding: '8px 0', fontSize: 14 }}>
              {item.name} × {item.quantity}
            </Column>
            <Column align="right" style={{ padding: '8px 0', fontSize: 14 }}>
              {item.total}
            </Column>
          </Row>
        ))}
        {totals
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <Row key={label}>
              <Column style={{ padding: '4px 0', fontSize: 13, color: '#6b7280' }}>{label}</Column>
              <Column align="right" style={{ padding: '4px 0', fontSize: 13, color: '#6b7280' }}>
                {value}
              </Column>
            </Row>
          ))}
        <Row>
          <Column style={{ padding: '8px 0', fontSize: 15, fontWeight: 700 }}>Total</Column>
          <Column align="right" style={{ padding: '8px 0', fontSize: 15, fontWeight: 700 }}>
            {grandTotal}
          </Column>
        </Row>
      </Section>
      <Button href={orderUrl} style={styles.button}>
        View order
      </Button>
    </Layout>
  );
}
