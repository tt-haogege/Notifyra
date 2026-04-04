import { BadRequestException, Injectable } from '@nestjs/common';
import { ChannelDriver, ChannelType } from './channel-driver.interface';

@Injectable()
export class ChannelDriverRegistry {
  private readonly driversByType = new Map<string, ChannelDriver>();

  constructor(drivers: ChannelDriver[]) {
    drivers.forEach((driver) => {
      this.driversByType.set(driver.type, driver);
    });
  }

  getDriver(type: string): ChannelDriver {
    const driver = this.driversByType.get(type as ChannelType);
    if (!driver) throw new BadRequestException('暂不支持该渠道类型');
    return driver;
  }
}
