import { BadRequestException, Injectable } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiChatService {
  async chat(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`AI 调用失败: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadRequestException('AI 响应格式错误');
    }

    return content;
  }
}
