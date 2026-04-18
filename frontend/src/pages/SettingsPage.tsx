import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';
import { Card } from '../components/common/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { AiConfigForm } from '../components/settings/AiConfigForm';
import { AvatarUploader } from '../components/settings/AvatarUploader';
import { PasswordForm } from '../components/settings/PasswordForm';
import { TimePrefsForm } from '../components/settings/TimePrefsForm';

/**
 * 个人设置页：纯布局容器，所有业务逻辑已拆入 components/settings/ 下的独立子组件。
 */
export default function SettingsPage() {
  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  if (isLoading) {
    return (
      <div className="page-stack">
        <div className="card">加载中...</div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="个人设置" description="管理账号信息、修改密码与全局偏好。" />

      <div className="two-panel-layout">
        <Card className="stack-gap">
          <div>
            <h3>账号信息</h3>
            <p className="muted-text">更新头像与账号密码。</p>
          </div>
          <AvatarUploader />
          <PasswordForm />
        </Card>

        <Card className="stack-gap">
          <div>
            <h3>时间偏好</h3>
            <p className="muted-text">设置你希望接收通知的时间段。</p>
          </div>
          <TimePrefsForm />
        </Card>
      </div>

      <Card className="stack-gap">
        <div>
          <h3>AI 配置</h3>
          <p className="muted-text">配置 AI 对话功能的模型参数。</p>
        </div>
        <AiConfigForm />
      </Card>
    </div>
  );
}
