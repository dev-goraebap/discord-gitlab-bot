import {Module} from '@nestjs/common';
import {WebhookModule} from './webhook/webhook.module';
import {ConfigModule} from '../shared/config';

@Module({
    imports: [ConfigModule, WebhookModule],
})
export class AppModule {
}