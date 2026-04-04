import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateCodeQueryDto } from './dto/generate-code.query.dto';

@Controller('test/code')
@UseGuards(JwtAuthGuard)
export class CodeExampleController {
  @Get()
  generate(@Query() query: GenerateCodeQueryDto) {
    if (query.type === 'notification') {
      if (!query.webhookToken) {
        throw new BadRequestException('webhookToken required for notification type');
      }
      return this.generateNotificationCode(query.lang, query.webhookToken);
    } else {
      if (!query.channelToken) {
        throw new BadRequestException('channelToken required for channel type');
      }
      return this.generateChannelCode(query.lang, query.channelToken);
    }
  }

  private generateNotificationCode(lang: 'curl' | 'javascript' | 'python', token: string) {
    const baseUrl = '{{YOUR_BASE_URL}}';

    if (lang === 'curl') {
      return {
        lang,
        code: `curl -X POST "${baseUrl}/open/webhook/notify/${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "这是一条测试消息",
    "device": {
      "name": "server-01"
    }
  }'`,
      };
    }

    if (lang === 'javascript') {
      return {
        lang,
        code: `const response = await fetch('${baseUrl}/open/webhook/notify/${token}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '这是一条测试消息',
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
import json

url = "${baseUrl}/open/webhook/notify/${token}"
payload = {
    "message": "这是一条测试消息",
    "device": {"name": "server-01"}
}
headers = {"Content-Type": "application/json"}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
    };
  }

  private generateChannelCode(lang: 'curl' | 'javascript' | 'python', token: string) {
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
