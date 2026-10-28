import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SUPPORT_MESSAGE_MAX, type SupportChatInput, type SupportFeedback } from '@ecommerce/types';

export class SupportChatDto implements SupportChatInput {
  @IsOptional()
  @IsUUID()
  conversationId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(SUPPORT_MESSAGE_MAX)
  message!: string;
}

export class SupportFeedbackDto {
  /** null clears the vote. */
  @IsOptional()
  @IsIn(['up', 'down'])
  value!: SupportFeedback;
}
