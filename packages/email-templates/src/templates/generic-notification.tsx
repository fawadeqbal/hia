import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { Layout, styles } from '../components/layout';

export interface GenericNotificationEmailProps {
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}

/**
 * Fallback template for catalogue emails that don't have a dedicated design yet.
 * Replace with a dedicated template as each email is designed.
 */
export default function GenericNotificationEmail({
  heading = 'Notification',
  body = 'You have a new update.',
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
}: GenericNotificationEmailProps) {
  return (
    <Layout preview={heading} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={styles.heading}>{heading}</Heading>
      {body.split('\n').map((line, i) => (
        <Text key={i} style={styles.text}>
          {line}
        </Text>
      ))}
      {ctaLabel && ctaUrl ? (
        <Button href={ctaUrl} style={styles.button}>
          {ctaLabel}
        </Button>
      ) : null}
    </Layout>
  );
}
