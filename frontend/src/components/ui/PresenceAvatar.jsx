import React, { useEffect, useState } from 'react';
import { resolveAssetSrc } from '../../utils/orgLogo';

function initials(name, email) {
  const source = String(name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const DOT = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-stone-300',
};

export default function PresenceAvatar({
  name,
  email,
  photo,
  status,
  size = 32,
  ringClass = 'ring-white',
  className = '',
}) {
  const src = resolveAssetSrc(photo);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showPhoto = Boolean(src) && !failed;
  const dim = typeof size === 'number' ? `${size}px` : size;
  const textClass = size >= 40 ? 'text-sm' : size >= 32 ? 'text-[10px]' : 'text-[9px]';

  return (
    <span className={`relative inline-flex flex-shrink-0 ${className}`} style={{ width: dim, height: dim }}>
      <span
        className={`w-full h-full rounded-full bg-gradient-to-br from-brand-500 to-teal-600 text-white font-bold flex items-center justify-center overflow-hidden ring-2 ${ringClass} ${textClass}`}
      >
        {showPhoto ? (
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          initials(name, email)
        )}
      </span>
      {status ? (
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${ringClass} ${DOT[status] || DOT.offline}`} />
      ) : null}
    </span>
  );
}
