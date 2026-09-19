import React from 'react';
import { Shield, User, Briefcase } from 'lucide-react';

export const RoleBadge = ({ role }) => {
  if (!role) return null;

  const roleConfig = {
    CITIZEN: {
      label: 'Citizen',
      icon: <User size={13} />,
      className: 'CITIZEN',
    },
    STAFF: {
      label: 'Staff / Field Officer',
      icon: <Briefcase size={13} />,
      className: 'STAFF',
    },
    ADMIN: {
      label: 'Administrator',
      icon: <Shield size={13} />,
      className: 'ADMIN',
    },
  };

  const config = roleConfig[role] || {
    label: role,
    icon: <User size={13} />,
    className: 'CITIZEN',
  };

  return (
    <span className={`role-badge ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
};
