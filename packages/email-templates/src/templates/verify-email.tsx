import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface VerifyEmailProps {
  firstName?: string;
  verifyUrl?: string;
}

export default function VerifyEmail({ firstName = 'there', verifyUrl = '#' }: VerifyEmailProps) {
  return (
    <Layout preview="Confirm your email address">
      <Heading style={styles.heading}>Confirm your email</Heading>
      <Text style={styles.text}>
        Hi {firstName}, please confirm your email address to activate your account.
      </Text>
      <Button href={verifyUrl} style={styles.button}>
        Verify email
      </Button>
      <Text style={{ ...styles.text, fontSize: 13, color: '#6b7280', marginTop: 16 }}>
        If you didn&apos;t create an account, you can ignore this email.
      </Text>
    </Layout>
  );
}
