import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiApi, type AiMessage } from '../../api/ai';
import { channelsApi } from '../../api/channels';
import {
  notificationsApi,
  type CreateNotificationDto,
} from '../../api/notifications';
import { emitToast } from '../common/toast-events';
import { getApiErrorMessage } from '../../api/errors';
import {
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  SparklesIcon,
} from '../common/icons';

/**
 * 清洗 AI 原始输出，只保留面向用户的自然语言：
 *  - 移除成对的 <think>...</think> 思考块
 *  - 移除孤立的 <think> / </think>（流式未闭合或只剩一侧的情况）
 *  - 移除 [PARAMS]...[/PARAMS] 内部 JSON 参数块（包括未闭合：吃到结尾）
 *  - 移除 [READY] 就绪标记
 *  - 合并 3+ 空行
 *
 * 注意：不要写 `<think>[\s\S]*$` 这种把"未闭合 think 吞到结尾"的规则——
 * AI 经常把正文放在 </think> 之后，这种规则会把正文也吃掉，导致气泡空白。
 */
function cleanAiContent(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/\[PARAMS\][\s\S]*?\[\/PARAMS\]/gi, '')
    .replace(/\[PARAMS\][\s\S]*$/gi, '')
    .replace(/\[READY\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const WELCOME_TEXT = [
  '你好，我来帮你快速创建通知。',
  '',
  '告诉我想做什么，例如：',
  '',
  '- 每天早上 8 点提醒我喝水，发到钉钉',
  '- 2026 年 5 月 1 日 9 点发一条节日祝福到企业微信',
].join('\n');

interface CollectedParams {
  name?: string;
  title?: string;
  content?: string;
  triggerType?: CreateNotificationDto['triggerType'];
  triggerConfig?: { executeAt?: string; cron?: string };
  channelIds?: string[];
}

/** 将采集参数规整为可提交的 payload；字段不全返回 null。 */
const buildCreatePayload = (
  params: CollectedParams,
): CreateNotificationDto | null => {
  const { name, title, content, triggerType } = params;
  if (!name || !title || !content || !triggerType) return null;
  const channelIds = Array.isArray(params.channelIds) ? params.channelIds : [];
  if (triggerType !== 'webhook' && channelIds.length === 0) return null;

  const triggerConfig: CreateNotificationDto['triggerConfig'] = {};
  if (triggerType === 'once') {
    if (!params.triggerConfig?.executeAt) return null;
    triggerConfig.executeAt = params.triggerConfig.executeAt;
  } else if (triggerType === 'recurring') {
    if (!params.triggerConfig?.cron) return null;
    triggerConfig.cron = params.triggerConfig.cron;
  }

  return { name, title, content, triggerType, channelIds, triggerConfig };
};

const TRIGGER_LABEL: Record<CreateNotificationDto['triggerType'], string> = {
  once: '一次性',
  recurring: '循环',
  webhook: 'Webhook',
};

const describeTrigger = (params: CollectedParams): string => {
  if (params.triggerType === 'once')
    return `一次性 · ${params.triggerConfig?.executeAt ?? '—'}`;
  if (params.triggerType === 'recurring')
    return `循环 · cron ${params.triggerConfig?.cron ?? '—'}`;
  if (params.triggerType === 'webhook') return 'Webhook 触发';
  return '—';
};

const bubbleStyle = (role: 'user' | 'assistant'): CSSProperties => ({
  maxWidth: '82%',
  padding: '10px 14px',
  borderRadius: 16,
  background:
    role === 'user'
      ? 'var(--accent-color, #2563eb)'
      : 'var(--table-row-hover, rgba(15,23,42,0.06))',
  color: role === 'user' ? 'white' : 'inherit',
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: role === 'user' ? 'pre-wrap' : 'normal',
  wordBreak: 'break-word',
});

/** 闪烁光标，表示 AI 正在"打字"。 */
const CARET_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 2,
  height: '1em',
  marginLeft: 2,
  verticalAlign: '-0.15em',
  background: 'currentColor',
  opacity: 0.7,
  animation: 'ai-caret-blink 1s steps(1) infinite',
};

/**
 * 渲染助手消息：支持 GFM markdown，在气泡内统一样式。
 * 通过限制裸 Markdown 组件的 margin，避免气泡上下撑得过大。
 */
function AssistantMarkdown({
  text,
  typing,
}: {
  text: string;
  typing: boolean;
}) {
  return (
    <div className="ai-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ margin: '4px 0' }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: '2px 0' }}>{children}</li>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600 }}>{children}</strong>
          ),
          code: ({ children }) => (
            <code
              style={{
                background: 'rgba(0,0,0,0.07)',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: '0.92em',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }}
            >
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h4 style={{ margin: '8px 0 4px', fontSize: 15 }}>{children}</h4>
          ),
          h2: ({ children }) => (
            <h4 style={{ margin: '8px 0 4px', fontSize: 14 }}>{children}</h4>
          ),
          h3: ({ children }) => (
            <h4 style={{ margin: '6px 0 4px', fontSize: 14 }}>{children}</h4>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: 'var(--accent-color, #2563eb)' }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '4px 0',
                padding: '2px 10px',
                borderLeft: '3px solid rgba(0,0,0,0.15)',
                color: 'inherit',
                opacity: 0.85,
              }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
      {typing && <span style={CARET_STYLE} aria-hidden />}
    </div>
  );
}

/**
 * 外层：用 open 决定是否挂载 Inner。Modal 每次打开都是新实例，
 * 避免"关闭时重置状态"的 setState-in-effect 陷阱。
 */
export function AiQuickCreateModal({ open, onClose }: Props) {
  if (!open) return null;
  return <AiQuickCreateModalInner onClose={onClose} />;
}

function AiQuickCreateModalInner({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [collectedParams, setCollectedParams] = useState<CollectedParams>({});
  const [isReady, setIsReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: channels } = useQuery({
    queryKey: ['channels', { pageSize: 100 }],
    queryFn: () => channelsApi.list({ pageSize: 100 }),
    enabled: isReady,
  });

  const channelNameMap = useMemo(() => {
    const map = new Map<string, string>();
    channels?.items.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [channels]);

  const createPayload = useMemo(
    () => buildCreatePayload(collectedParams),
    [collectedParams],
  );

  // mount 时创建 session
  useEffect(() => {
    let cancelled = false;
    aiApi
      .createSession()
      .then((session) => {
        if (cancelled) return;
        setSessionId(session.id);
        setMessages([
          {
            role: 'assistant',
            content: WELCOME_TEXT,
            timestamp: new Date().toISOString(),
          },
        ]);
        setTimeout(() => inputRef.current?.focus(), 50);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        emitToast(
          getApiErrorMessage(err, '无法创建 AI 会话，请先在设置中配置 AI'),
          'error',
        );
        onClose();
      });

    return () => {
      cancelled = true;
    };
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  /**
   * 打字机：只针对"最新一条 assistant 消息"逐字显示。历史消息默认全量展示。
   * 使用 ref 保存进度，避免在 effect body 中直接 setState 触发 react-hooks 警告；
   * setTick 只是触发重渲染。
   */
  const typingRef = useRef<{ idx: number; shown: number } | null>(null);
  const [, setTypingTick] = useState(0);

  useEffect(() => {
    const idx = messages.length - 1;
    const last = messages[idx];
    if (!last || last.role !== 'assistant') return;
    const cleaned = cleanAiContent(last.content);
    if (cleaned.length === 0) return;

    if (typingRef.current?.idx !== idx) {
      typingRef.current = { idx, shown: 0 };
    }

    const timer = setInterval(() => {
      const cur = typingRef.current;
      if (!cur || cur.idx !== idx) {
        clearInterval(timer);
        return;
      }
      if (cur.shown >= cleaned.length) {
        clearInterval(timer);
        return;
      }
      const step = Math.max(2, Math.ceil(cleaned.length / 80));
      cur.shown = Math.min(cur.shown + step, cleaned.length);
      setTypingTick((t) => t + 1);
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
      });
    }, 22);

    return () => clearInterval(timer);
  }, [messages]);

  const isTypingIdx = (idx: number, cleanedLen: number): boolean => {
    const t = typingRef.current;
    return !!t && t.idx === idx && t.shown < cleanedLen;
  };

  const chatMutation = useMutation({
    mutationFn: (text: string) => {
      if (!sessionId) throw new Error('会话尚未就绪');
      return aiApi.chat(sessionId, text);
    },
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.response,
          timestamp: new Date().toISOString(),
        },
      ]);
      setCollectedParams(res.collectedParams as CollectedParams);
      if (res.isReady) setIsReady(true);
    },
    onError: (err: unknown) => {
      emitToast(getApiErrorMessage(err, 'AI 对话失败，请稍后重试'), 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateNotificationDto) =>
      notificationsApi.create(payload),
    onSuccess: (data) => {
      if (sessionId) {
        aiApi.linkNotification(sessionId, data.id).catch(() => undefined);
      }
      emitToast('通知创建成功', 'success');
      onClose();
      navigate(`/notifications/${data.id}`);
    },
    onError: (err: unknown) => {
      emitToast(getApiErrorMessage(err, '创建失败，请稍后重试'), 'error');
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || !sessionId || chatMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, timestamp: new Date().toISOString() },
    ]);
    setInput('');
    chatMutation.mutate(text);
  };

  const handleCreate = () => {
    if (!createPayload || createMutation.isPending) return;
    createMutation.mutate(createPayload);
  };

  const handleGoToForm = () => {
    if (!sessionId) return;
    onClose();
    navigate(`/notifications/new?ai_session=${sessionId}`);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-quick-create-title"
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '82vh',
          overflow: 'hidden',
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3
            id="ai-quick-create-title"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <SparklesIcon size={18} />
            <span>AI 一句话新建通知</span>
          </h3>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>
        <div
          ref={scrollRef}
          style={{
            flex: '1 1 auto',
            minHeight: 240,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '4px 2px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {messages.map((m, i) => {
              if (m.role === 'user') {
                return (
                  <div
                    key={i}
                    style={{ display: 'flex', justifyContent: 'flex-end' }}
                  >
                    <div style={bubbleStyle('user')}>{m.content}</div>
                  </div>
                );
              }
              const cleaned = cleanAiContent(m.content);
              if (cleaned.length === 0) return null;
              const typing = isTypingIdx(i, cleaned.length);
              const shown = typing
                ? cleaned.slice(0, typingRef.current?.shown ?? 0)
                : cleaned;
              return (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'flex-start' }}
                >
                  <div style={bubbleStyle('assistant')}>
                    <AssistantMarkdown text={shown} typing={typing} />
                  </div>
                </div>
              );
            })}
            {chatMutation.isPending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    ...bubbleStyle('assistant'),
                    opacity: 0.7,
                    fontStyle: 'italic',
                  }}
                >
                  思考中...
                </div>
              </div>
            )}
          </div>
          {isReady && (
            <div
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                background: 'rgba(34, 197, 94, 0.10)',
                border: '1px solid rgba(34, 197, 94, 0.32)',
                minHeight: 0,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  color: '#16a34a',
                }}
              >
                <CheckCircleIcon size={16} />
                <strong style={{ fontSize: 14 }}>信息已收集完整</strong>
                <span
                  style={{
                    fontSize: 12,
                    opacity: 0.75,
                    fontWeight: 400,
                  }}
                >
                  核对无误后直接创建
                </span>
              </div>
              <SummaryList
                params={collectedParams}
                channelNameMap={channelNameMap}
              />
              {!createPayload && (
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 12,
                    color: '#f59e0b',
                  }}
                >
                  缺少必填字段，请继续对话补充，或点"去编辑页调整"手动填完。
                </p>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 12,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {isReady ? (
            <>
              <button
                className="ghost-button"
                type="button"
                onClick={handleGoToForm}
                disabled={createMutation.isPending}
              >
                去编辑页调整
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="primary-button"
                type="button"
                onClick={handleCreate}
                disabled={!createPayload || createMutation.isPending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckIcon size={16} />
                {createMutation.isPending ? '创建中...' : '直接创建'}
              </button>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                className="input-shell"
                style={{ flex: 1 }}
                placeholder={
                  sessionId
                    ? '请输入，例如"每天 9 点提醒喝水，发到钉钉"'
                    : '加载中...'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!sessionId || chatMutation.isPending}
              />
              <button
                className="primary-button"
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || !sessionId || chatMutation.isPending}
              >
                发送
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryList({
  params,
  channelNameMap,
}: {
  params: CollectedParams;
  channelNameMap: Map<string, string>;
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: '名称', value: params.name ?? '—' },
    { label: '标题', value: params.title ?? '—' },
    { label: '正文', value: params.content ?? '—' },
    {
      label: '触发',
      value:
        params.triggerType != null
          ? `${TRIGGER_LABEL[params.triggerType]} · ${describeTrigger(params).replace(/^.+?·\s*/, '')}`
          : describeTrigger(params),
    },
  ];
  if (params.triggerType !== 'webhook') {
    const ids = Array.isArray(params.channelIds) ? params.channelIds : [];
    const names = ids.map((id) => channelNameMap.get(id) ?? id);
    rows.push({
      label: '渠道',
      value: names.length > 0 ? names.join('、') : '—',
    });
  }

  return (
    <dl
      style={{
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        columnGap: 12,
        rowGap: 6,
        fontSize: 13,
      }}
    >
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'contents' }}>
          <dt
            style={{
              whiteSpace: 'nowrap',
              color: 'inherit',
              opacity: 0.65,
              fontWeight: 500,
            }}
          >
            {r.label}
          </dt>
          <dd
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'inherit',
            }}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
