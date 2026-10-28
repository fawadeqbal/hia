import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface OtpCodeEmailProps {
  code?: string;
  expiresInMinutes?: number;
}

export default function OtpCodeEmail({
  code = '000000',
  expiresInMinutes = 10,
}: OtpCodeEmailProps) {
  return (
    <Layout preview={`Your login code is ${code}`}>
      <Heading style={styles.heading}>Your login code</Heading>
      <Text style={styles.text}>
        Use this code to sign in. It expires in {expiresInMinutes} minutes.
      </Text>
      <Text style={styles.code}>{code}</Text>
    </Layout>
  );
}
