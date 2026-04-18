/**
 * 共享类型声明。
 *
 * 这里存放跨多个 api 模块复用的类型，以及与后端保持契约一致的类型别名。
 *
 * 注意：各 api/*.ts 中的业务枚举（TriggerType / ChannelType / NotificationStatus 等）
 * 必须与 backend 的 Prisma schema + DTO 保持一致，修改时需同步两端。
 */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
