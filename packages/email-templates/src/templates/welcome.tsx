import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface WelcomeEmailProps {
  firstName?: string;
  shopUrl?: string;
}

export default function WelcomeEmail({
  firstName = 'there',
  shopUrl = 'http://localhost:3000',
}: WelcomeEmailProps) {
  return (
    <Layout preview="Welcome! Your account is ready.">
      <Heading style={styles.heading}>Welcome, {firstName}!</Heading>
      <Text style={styles.text}>
        Your account is ready. Start exploring thousands of products from trusted sellers.
      </Text>
      <Button href={shopUrl} style={styles.button}>
        Start shopping
      </Button>
    </Layout>
  );
}
