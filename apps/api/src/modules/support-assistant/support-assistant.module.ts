import { Module } from '@nestjs/common';
import { SupportAssistantController } from './support-assistant.controller';
import { SupportAssistantService } from './support-assistant.service';

/** Customer support chat, answered by the RAG service in services/support-ai. */
@Module({
  controllers: [SupportAssistantController],
  providers: [SupportAssistantService],
})
export class SupportAssistantModule {}
