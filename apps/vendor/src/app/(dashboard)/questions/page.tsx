import type { Metadata } from 'next';
import { PageHeader } from '@ecommerce/ui';
import { QuestionList } from '@/features/reviews/question-list';

export const metadata: Metadata = { title: 'Questions' };

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Questions"
        description="Customers' questions about your products. Your answer is public."
      />
      <QuestionList />
    </div>
  );
}
