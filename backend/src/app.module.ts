import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RecordsModule } from './records/records.module';
import { SettingsModule } from './settings/settings.module';
import { TestModuleModule } from './test-module/test-module.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiModule,
    ChannelsModule,
    NotificationsModule,
    RecordsModule,
    SettingsModule,
    TestModuleModule,
  ],
})
export class AppModule {}
