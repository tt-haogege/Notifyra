const AVATAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AvatarCircleProps {
  username: string;
  avatar?: string | null;
  size?: number;
}

export function AvatarCircle({ username, avatar, size = 56 }: AvatarCircleProps) {
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
