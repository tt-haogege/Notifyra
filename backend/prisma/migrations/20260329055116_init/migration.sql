-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "aiBaseUrl" TEXT,
    "aiApiKeyEncrypted" TEXT,
    "aiModel" TEXT,
    "afternoonTime" TEXT,
    "eveningTime" TEXT,
    "tomorrowMorningTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "tokenHash" TEXT,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "triggerJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "webhookToken" TEXT,
    "webhookTokenHash" TEXT,
    "nextTriggerAt" DATETIME,
    "stopReason" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "NotificationChannel_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "channelId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorSummary" TEXT,
    "pushedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushRecord_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PushRecord_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelPushResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pushRecordId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorMessage" TEXT,
    "retryAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelPushResult_pushRecordId_fkey" FOREIGN KEY ("pushRecordId") REFERENCES "PushRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelPushResult_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pushRecordId" TEXT,
    "notificationId" TEXT NOT NULL,
    "sourceIp" TEXT,
    "requestBodyJson" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookRequestLog_pushRecordId_fkey" FOREIGN KEY ("pushRecordId") REFERENCES "PushRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookRequestLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'collecting',
    "messagesJson" TEXT NOT NULL DEFAULT '[]',
    "collectedParamsJson" TEXT NOT NULL DEFAULT '{}',
    "createdNotificationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChannel_notificationId_channelId_key" ON "NotificationChannel"("notificationId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookRequestLog_pushRecordId_key" ON "WebhookRequestLog"("pushRecordId");
