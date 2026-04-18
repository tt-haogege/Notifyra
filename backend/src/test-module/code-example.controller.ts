import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateCodeQueryDto } from './dto/generate-code.query.dto';

@Controller('test/code')
@UseGuards(JwtAuthGuard)
export class CodeExampleController {
  @Get()
  generate(@Query() query: GenerateCodeQueryDto) {
    if (query.type === 'notification') {
      if (!query.webhookToken) {
        throw new BadRequestException(
          'webhookToken required for notification type',
        );
      }
      return this.generateNotificationCode(query.lang, query.webhookToken);
    } else {
      if (!query.channelToken) {
        throw new BadRequestException('channelToken required for channel type');
      }
      return this.generateChannelCode(query.lang, query.channelToken);
    }
  }

  private generateNotificationCode(
    lang: 'curl' | 'javascript' | 'python',
    token: string,
  ) {
    const baseUrl = '{{YOUR_BASE_URL}}';

    // 示例同时演示两种用法：
    //   1) 请求体传 title / content → 覆盖通知里配置的标题和正文
    //   2) 请求体传任意其它字段 → 可在通知配置的 title / content 中通过 {{body.xxx}} 引用
    if (lang === 'curl') {
      return {
        lang,
        code: `curl -X POST "${baseUrl}/open/webhook/notify/${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "服务告警",
    "content": "server-01 CPU 使用率超过 90%",
    "device": {
      "name": "server-01"
    }
  }'

# 提示：title / content 可选，不传则使用通知中预设的内容；
#       title / content 内可使用 {{body.device.name}} 等占位符引用 body 字段。`,
      };
    }

    if (lang === 'javascript') {
      return {
        lang,
        code: `// title / content 可选，传入即覆盖通知配置；
// 通知配置里的 title / content 可通过 {{body.xxx}} 引用请求体字段。
const response = await fetch('${baseUrl}/open/webhook/notify/${token}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '服务告警',
    content: 'server-01 CPU 使用率超过 90%',
    device: { name: 'server-01' }
  })
});
const result = await response.json();
console.log(result);`,
      };
    }

    return {
      lang,
      code: `import requests

# title / content 可选，传入即覆盖通知配置；
# 通知配置里的 title / content 可通过 {{body.xxx}} 引用请求体字段。
url = "${baseUrl}/open/webhook/notify/${token}"
payload = {
    "title": "服务告警",
    "content": "server-01 CPU 使用率超过 90%",
    "device": {"name": "server-01"},
}
headers = {"Content-Type": "application/json"}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    };
  }

  private generateChannelCode(
    lang: 'curl' | 'javascript' | 'python',
    token: string,
  ) {
    const baseUrl = '{{YOUR_BASE_URL}}';

    if (lang === 'curl') {
      return {
        lang,
        code: `curl -X POST "${baseUrl}/open/channels/${token}/send" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "测试标题",
    "content": "测试内容"
  }'`,
      };
    }

    if (lang === 'javascript') {
      return {
        lang,
        code: `const response = await fetch('${baseUrl}/open/channels/${token}/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '测试标题',
    content: '测试内容'
  })
});
const result = await response.json();
console.log(result);`,
      };
    }

    return {
      lang,
      code: `import requests

url = "${baseUrl}/open/channels/${token}/send"
payload = {
    "title": "测试标题",
    "content": "测试内容"
}
headers = {"Content-Type": "application/json"}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    };
  }
}
