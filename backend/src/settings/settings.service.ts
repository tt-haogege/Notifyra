import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    return {
      aiBaseUrl: settings.aiBaseUrl,
      aiModel: settings.aiModel,
      hasAiApiKey: !!settings.aiApiKeyEncrypted,
      afternoonTime: settings.afternoonTime,
      eveningTime: settings.eveningTime,
      tomorrowMorningTime: settings.tomorrowMorningTime,
      allowHighFrequencyScheduling: settings.allowHighFrequencyScheduling,
    };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    const data: Prisma.UserSettingsUpdateInput = {};

    if (dto.aiBaseUrl !== undefined) {
      data.aiBaseUrl = dto.aiBaseUrl;
    }
    if (typeof dto.aiApiKey === 'string' && dto.aiApiKey !== '') {
      data.aiApiKeyEncrypted = dto.aiApiKey;
    }
    if (dto.aiModel !== undefined) {
      data.aiModel = dto.aiModel;
    }
    if (dto.afternoonTime !== undefined) {
      data.afternoonTime = dto.afternoonTime;
    }
    if (dto.eveningTime !== undefined) {
      data.eveningTime = dto.eveningTime;
    }
    if (dto.tomorrowMorningTime !== undefined) {
      data.tomorrowMorningTime = dto.tomorrowMorningTime;
    }
    if (dto.allowHighFrequencyScheduling !== undefined) {
      data.allowHighFrequencyScheduling = dto.allowHighFrequencyScheduling;
    }

    const updated = await this.prisma.userSettings.update({
      where: { userId },
      data,
    });

    return {
      aiBaseUrl: updated.aiBaseUrl,
      aiModel: updated.aiModel,
      hasAiApiKey: !!updated.aiApiKeyEncrypted,
      afternoonTime: updated.afternoonTime,
      eveningTime: updated.eveningTime,
      tomorrowMorningTime: updated.tomorrowMorningTime,
      allowHighFrequencyScheduling: updated.allowHighFrequencyScheduling,
    };
  }
}
