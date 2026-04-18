import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { getApiErrorMessage } from '../../api/errors';
import { useToast } from '../common/toast-context';
import { AvatarCircle } from './AvatarCircle';

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/**
 * 头像上传子组件：自带头像预览、文件选择、上传与清除操作。
 * 自己负责 profile query，父组件无需再传数据。
 */
export function AvatarUploader() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  const uploadAvatar = useMutation({
    mutationFn: authApi.uploadAvatar,
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setPendingAvatar(null);
    },
    onError: (err: unknown) => {
      toast(getApiErrorMessage(err, '头像上传失败，请重试'), 'error');
    },
  });

  const removeAvatar = useMutation({
    mutationFn: () => authApi.uploadAvatar(''),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setPendingAvatar(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast('图片大小不能超过 4MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPendingAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    setPendingAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const showSavedBanner =
    (uploadAvatar.isSuccess || removeAvatar.isSuccess) && !pendingAvatar;

  return (
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
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 0 }}>
          {profile?.email || '未设置邮箱'}
        </div>
        {pendingAvatar && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              className="ghost-button"
              style={{ fontSize: 12, padding: '4px 8px' }}
              onClick={() => uploadAvatar.mutate(pendingAvatar)}
              disabled={uploadAvatar.isPending}
            >
              {uploadAvatar.isPending ? '保存中...' : '保存头像'}
            </button>
            <button
              className="ghost-button"
              style={{ fontSize: 12, padding: '4px 8px' }}
              onClick={handleCancel}
              disabled={removeAvatar.isPending}
            >
              取消
            </button>
          </div>
        )}
        {showSavedBanner && (
          <div
            className="helper-text"
            style={{ color: 'var(--success)', marginTop: 0 }}
          >
            头像已更新
          </div>
        )}
      </div>
    </div>
  );
}
