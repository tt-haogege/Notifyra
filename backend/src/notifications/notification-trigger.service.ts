import { BadRequestException, Injectable } from '@nestjs/common';
import { parseExpression } from 'cron-parser';
import { Job, scheduleJob } from 'node-schedule';
import { z } from 'zod';
import { PrismaService } from '../shared/prisma/prisma.service';

export type TriggerType = 'once' | 'recurring' | 'webhook';
export type TriggerConfig = Record<string, unknown>;

const CRON_PART_PATTERN = /^([\d*/,-]+)$/;
const MIN_RECURRING_CRON_INTERVAL_MS = 5 * 60 * 1000;
const MIN_RECURRING_CRON_INTERVAL_MESSAGE =
  'Cron 执行频率不能高于每 5 分钟一次';

const cronExpressionSchema = z
  .string()
  .trim()
  .refine((value) => {
    const parts = value.split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }, 'Cron 表达式不合法')
  .refine(
    (value) => value.split(/\s+/).every((part) => CRON_PART_PATTERN.test(part)),
    'Cron 表达式不合法',
  );

/**
 * 通知触发相关的纯业务服务：
 *  - 校验 triggerConfig（once / recurring / webhook 三种）
 *  - 计算 nextTriggerAt
 *  - Cron 频率限制（需要查用户设置，故依赖 PrismaService）
 *
 * 本服务不持有通知实体本身的状态，只为 NotificationsService 提供工具能力。
 */
@Injectable()
export class NotificationTriggerService {
  constructor(private prisma: PrismaService) {}

  /**
   * 校验并规范化 triggerConfig。
   *
   * @param skipFrequencyCheck 更新非启用态通知时可跳过频率下限校验。
   */
  async validateConfig(
    userId: string,
    triggerType: TriggerType,
    triggerConfig: TriggerConfig,
    skipFrequencyCheck = false,
  ): Promise<TriggerConfig> {
    if (triggerType === 'webhook') {
      return {};
    }

    if (triggerType === 'once') {
      const executeAt = triggerConfig.executeAt;
      if (
        typeof executeAt !== 'string' ||
        Number.isNaN(Date.parse(executeAt))
      ) {
        throw new BadRequestException('一次性触发时间不合法');
      }
      return { executeAt };
    }

    const cron = triggerConfig.cron;
    if (typeof cron !== 'string') {
      throw new BadRequestException('Cron 表达式不合法');
    }

    const normalizedCron = this.normalizeCronExpression(cron);
    if (!skipFrequencyCheck) {
      await this.ensureCronAllowed(userId, normalizedCron);
    }

    return { cron: normalizedCron };
  }

  /** 根据 triggerType 计算下一次触发时间；webhook 永远为 null。 */
  calculateNextTriggerAt(
    triggerType: TriggerType,
    triggerConfig: TriggerConfig,
  ): Date | null {
    if (triggerType === 'webhook') return null;
    if (triggerType === 'once') {
      return new Date(triggerConfig.executeAt as string);
    }
    return this.calculateRecurringNextTriggerAt(triggerConfig.cron as string);
  }

  /** 计算 recurring cron 的下一次触发时间。 */
  calculateRecurringNextTriggerAt(cron: string): Date {
    let job: Job | null = null;
    try {
      const normalizedCron = this.normalizeCronExpression(cron);
      job = scheduleJob(normalizedCron, () => undefined);
      const nextInvocation = job?.nextInvocation();
      const nextTriggerAt = nextInvocation
        ? new Date(nextInvocation.getTime())
        : null;
      if (!nextTriggerAt) {
        throw new BadRequestException('Cron 表达式不合法');
      }
      return nextTriggerAt;
    } finally {
      job?.cancel();
    }
  }

  /** 结合用户设置判断该 cron 频率是否被允许。 */
  async ensureCronAllowed(userId: string, cron: string): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (settings?.allowHighFrequencyScheduling) return;
    this.ensureCronInterval(cron);
  }

  normalizeCronExpression(cron: string): string {
    const parsed = cronExpressionSchema.safeParse(cron);
    if (!parsed.success) {
      throw new BadRequestException('Cron 表达式不合法');
    }
    return parsed.data;
  }

  private ensureCronInterval(cron: string): void {
    try {
      const interval = parseExpression(cron);
      const first = interval.next().toDate();
      const second = interval.next().toDate();
      if (second.getTime() - first.getTime() < MIN_RECURRING_CRON_INTERVAL_MS) {
        throw new BadRequestException(MIN_RECURRING_CRON_INTERVAL_MESSAGE);
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Cron 表达式不合法');
    }
  }
}
