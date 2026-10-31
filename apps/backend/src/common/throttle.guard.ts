import { Injectable, type ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/** Limitarea ratei cererilor, care poate fi oprită cu RATE_LIMIT=off (simulări de încărcare). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  static enabled = true

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return !AppThrottlerGuard.enabled || super.shouldSkip(context)
  }
}
