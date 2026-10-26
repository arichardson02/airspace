import { Controller, Get } from '@nestjs/common';

/** Used by the hosting platform to check the backend is up before routing traffic to it. */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
