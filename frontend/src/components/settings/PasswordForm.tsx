import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/auth';

const MIN_PASSWORD_LENGTH = 6;
const SUCCESS_BANNER_DURATION_MS = 3000;

/** 修改密码子组件：自包含所有本地状态与校验。 */
export function PasswordForm() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setTimeout(() => setSuccess(false), SUCCESS_BANNER_DURATION_MS);
    },
    onError: (err: unknown) => {
      setError((err as { message?: string })?.message || '修改失败');
    },
  });

  const handleSubmit = () => {
    setError('');
    if (!oldPassword) return setError('请输入旧密码');
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return setError(`新密码至少${MIN_PASSWORD_LENGTH}位`);
    }
    if (newPassword !== confirmPassword) {
      return setError('两次输入的密码不一致');
    }
    changePassword.mutate({ oldPassword, newPassword });
  };

  const resetError = () => setError('');

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>修改密码</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div className="field-label">旧密码</div>
          <input
            className="input-shell full-width"
            type="password"
            value={oldPassword}
            onChange={(e) => {
              setOldPassword(e.target.value);
              resetError();
            }}
            placeholder="请输入当前密码"
          />
        </div>
        <div>
          <div className="field-label">新密码</div>
          <input
            className="input-shell full-width"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              resetError();
            }}
            placeholder={`至少${MIN_PASSWORD_LENGTH}位`}
          />
        </div>
        <div>
          <div className="field-label">确认新密码</div>
          <input
            className="input-shell full-width"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              resetError();
            }}
            placeholder="再次输入新密码"
          />
        </div>
      </div>
      {error && <div className="warning-banner" style={{ marginTop: 8 }}>{error}</div>}
      {success && (
        <div className="preview-box success" style={{ marginTop: 8 }}>
          <strong>密码修改成功</strong>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <button
          className="primary-button"
          type="button"
          onClick={handleSubmit}
          disabled={changePassword.isPending || !oldPassword || !newPassword}
        >
          {changePassword.isPending ? '修改中...' : '修改密码'}
        </button>
      </div>
    </div>
  );
}
