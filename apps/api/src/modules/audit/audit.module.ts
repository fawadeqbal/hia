import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global so every module can inject AuditService without importing AuditModule. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
