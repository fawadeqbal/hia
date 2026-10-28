import type { Metadata } from 'next';
import { OnboardingStatus } from './onboarding-status';

export const metadata: Metadata = { title: 'Application status' };

export default function OnboardingPage() {
  return <OnboardingStatus />;
}
