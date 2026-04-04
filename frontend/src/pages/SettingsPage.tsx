import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/common/Toast';
import { authApi } from '../api/auth';
import { settingsApi } from '../api/settings';

const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AvatarCircle({ username, avatar, size = 56 }: { username: string; avatar?: string | null; size?: number }) {
  const bg = avatar ? 'transparent' : getAvatarColor(username);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        backgroundImage: avatar ? `url(${avatar})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'grid',
        placeItems: 'center',
        color: 'white',
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {!avatar && username.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Profile
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  // Settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  // Local avatar preview (before upload)
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [afternoonTime, setAfternoonTime] = useState('');
  const [eveningTime, setEveningTime] = useState('');
  const [tomorrowMorningTime, setTomorrowMorningTime] = useState('');

  // Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setAiBaseUrl(settings.aiBaseUrl || '');
      setAiModel(settings.aiModel || '');
      setAfternoonTime(settings.afternoonTime || '');
      setEveningTime(settings.eveningTime || '');
      setTomorrowMorningTime(settings.tomorrowMorningTime || '');
    }
  }, [settings]);

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: authApi.uploadAvatar,
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setPendingAvatar(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '头像上传失败，请重试';
      toast(msg, 'error');
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => authApi.uploadAvatar(''),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setPendingAvatar(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      setPasswordError((err as { message?: string })?.message || '修改失败');
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      toast('设置已保存', 'success');
      setAiApiKey('');
    },
  });

  const updateTimePrefsMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      toast('设置已保存', 'success');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('图片大小不能超过 4MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingAvatar(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = () => {
    if (pendingAvatar) {
      uploadAvatarMutation.mutate(pendingAvatar);
    }
  };

  const handleRemoveAvatar = () => {
    setPendingAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasswordSubmit = () => {
    setPasswordError('');
    if (!oldPassword) { setPasswordError('请输入旧密码'); return; }
    if (newPassword.length < 6) { setPasswordError('新密码至少6位'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('两次输入的密码不一致'); return; }
    changePasswordMutation.mutate({ oldPassword, newPassword });
  };

  const handleSettingsSubmit = () => {
    updateSettingsMutation.mutate({
      aiBaseUrl: aiBaseUrl || null,
      aiApiKey: aiApiKey || null,
      aiModel: aiModel || null,
      afternoonTime: afternoonTime || null,
      eveningTime: eveningTime || null,
      tomorrowMorningTime: tomorrowMorningTime || null,
    });
  };

  if (settingsLoading) return <div className="page-stack"><div className="card">加载中...</div></div>;

  return (
    <div className="page-stack">
      <PageHeader
        title="个人设置"
        description="管理账号信息、修改密码与全局偏好。"
      />
      {/* 第一行：账号信息 + 时间偏好 */}
      <div className="two-panel-layout">
        <Card className="stack-gap">
          <div>
            <h3>账号信息</h3>
            <p className="muted-text">更新头像与账号密码。</p>
          </div>

          {/* 头像上传区 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <AvatarCircle
                username={profile?.username || 'U'}
                avatar={pendingAvatar ?? profile?.avatar}
                size={56}
              />
              <button
                className="ghost-button"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 22,
                  height: 22,
                  padding: 0,
                  borderRadius: '50%',
                  fontSize: 11,
                  lineHeight: 1,
                  background: 'var(--primary)',
                  color: 'white',
                  border: '2px solid var(--surface)',
                  zIndex: 1,
                }}
                onClick={() => fileInputRef.current?.click()}
                title="上传头像"
              >
                ✎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{profile?.username || '-'}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 0 }}>{profile?.email || '未设置邮箱'}</div>
              {pendingAvatar && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    className="ghost-button"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={handleAvatarUpload}
                    disabled={uploadAvatarMutation.isPending}
                  >
                    {uploadAvatarMutation.isPending ? '保存中...' : '保存头像'}
                  </button>
                  <button
                    className="ghost-button"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={handleRemoveAvatar}
                    disabled={removeAvatarMutation.isPending}
                  >
                    取消
                  </button>
                </div>
              )}
              {(uploadAvatarMutation.isSuccess || removeAvatarMutation.isSuccess) && !pendingAvatar && (
                <div className="helper-text" style={{ color: 'var(--success)', marginTop: 0 }}>头像已更新</div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>修改密码</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div className="field-label">旧密码</div>
                <input
                  className="input-shell full-width"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => { setOldPassword(e.target.value); setPasswordError(''); }}
                  placeholder="请输入当前密码"
                />
              </div>
              <div>
                <div className="field-label">新密码</div>
                <input
                  className="input-shell full-width"
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  placeholder="至少6位"
                />
              </div>
              <div>
                <div className="field-label">确认新密码</div>
                <input
                  className="input-shell full-width"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>
            {passwordError && <div className="warning-banner" style={{ marginTop: 8 }}>{passwordError}</div>}
            {passwordSuccess && (
              <div className="preview-box success" style={{ marginTop: 8 }}>
                <strong>密码修改成功</strong>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                className="primary-button"
                type="button"
                onClick={handlePasswordSubmit}
                disabled={changePasswordMutation.isPending || !oldPassword || !newPassword}
              >
                {changePasswordMutation.isPending ? '修改中...' : '修改密码'}
              </button>
            </div>
          </div>
        </Card>

        <Card className="stack-gap">
          <div>
            <h3>时间偏好</h3>
            <p className="muted-text">设置你希望接收通知的时间段。</p>
          </div>
          <div>
            <div className="field-label">下午时间</div>
            <input
              className="input-shell full-width"
              value={afternoonTime}
              onChange={(e) => setAfternoonTime(e.target.value)}
              placeholder="例如 14:00"
            />
          </div>
          <div>
            <div className="field-label">晚间时间</div>
            <input
              className="input-shell full-width"
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
              placeholder="例如 20:00"
            />
          </div>
          <div>
            <div className="field-label">次日上午时间</div>
            <input
              className="input-shell full-width"
              value={tomorrowMorningTime}
              onChange={(e) => setTomorrowMorningTime(e.target.value)}
              placeholder="例如 09:00"
            />
          </div>
          <div>
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                updateTimePrefsMutation.mutate({
                  afternoonTime: afternoonTime || null,
                  eveningTime: eveningTime || null,
                  tomorrowMorningTime: tomorrowMorningTime || null,
                })
              }
              disabled={updateTimePrefsMutation.isPending}
            >
              {updateTimePrefsMutation.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </Card>
      </div>

      {/* 第二行：AI 配置（全宽） */}
      <Card className="stack-gap">
        <div>
          <h3>AI 配置</h3>
          <p className="muted-text">配置 AI 对话功能的模型参数。</p>
        </div>
        <div>
          <div className="field-label">AI Base URL</div>
          <input
            className="input-shell full-width"
            value={aiBaseUrl}
            onChange={(e) => setAiBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1 或其他兼容 API 地址"
          />
        </div>
        <div>
          <div className="field-label">API Key</div>
          <input
            className="input-shell full-width"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={settings?.hasAiApiKey ? '已设置（留空则保持不变）' : 'sk-...'}
            type="password"
          />
          <p className="helper-text">
            {settings?.hasAiApiKey
              ? '已保存 API Key。留空保存时将保持当前 Key，不会明文回显。'
              : 'API Key 仅在保存时传输，不会明文显示。'}
          </p>
        </div>
        <div>
          <div className="field-label">模型名称</div>
          <input
            className="input-shell full-width"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="gpt-4o、gpt-3.5-turbo 等"
          />
        </div>
        <div>
          <button
            className="primary-button"
            type="button"
            onClick={handleSettingsSubmit}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? '保存中...' : '保存'}
          </button>
        </div>
      </Card>
    </div>
  );
}
