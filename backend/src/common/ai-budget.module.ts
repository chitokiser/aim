import { Global, Module } from '@nestjs/common';
import { AiBudgetService } from './ai-budget.service';

@Global()
@Module({
  providers: [AiBudgetService],
  exports: [AiBudgetService],
})
export class AiBudgetModule {}
