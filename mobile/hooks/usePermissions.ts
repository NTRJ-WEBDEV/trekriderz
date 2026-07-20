import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { fetchMyPermissions } from '@/lib/services/PermissionService';

// The RBAC entry point for screens — mirrors how usePostActions/
// usePostRealtime wrap a service module as a hook. isStaff is true for
// anyone with at least one permission (i.e. profiles.role_id is set);
// individual actions should still gate on the specific permission key.
export function usePermissions() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setPermissions(new Set()); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchMyPermissions().then((perms) => {
      if (!cancelled) { setPermissions(perms); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const hasPermission = useCallback((key: string) => permissions.has(key), [permissions]);

  return { permissions, hasPermission, isStaff: permissions.size > 0, loading };
}
