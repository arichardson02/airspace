import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

/** Used by the hosting platform to check the backend is up before routing traffic to it. */
@Controller('health')
@AllowAnonymous()
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
