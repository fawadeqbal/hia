import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface PasswordResetEmailProps {
  firstName?: string;
  resetUrl?: string;
  expiresInMinutes?: number;
}

export default function PasswordResetEmail({
  firstName = 'there',
  resetUrl = '#',
  expiresInMinutes = 30,
}: PasswordResetEmailProps) {
  return (
    <Layout preview="Reset your password">
      <Heading style={styles.heading}>Reset your password</Heading>
      <Text style={styles.text}>
        Hi {firstName}, we received a request to reset your password. This link expires in{' '}
        {expiresInMinutes} minutes.
      </Text>
      <Button href={resetUrl} style={styles.button}>
        Reset password
      </Button>
    </Layout>
  );
}
