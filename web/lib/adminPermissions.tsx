"use client";
import { createContext, useContext } from "react";

// AdminShell already fetches the caller's permission set server-side
// (getAdminSession) for nav filtering — this shares that same set with
// page components via context instead of every page re-fetching its own
// copy via PermissionService, while still ultimately reading from the
// same has_permission()/my_permissions() source.
const AdminPermissionsContext = createContext<string[]>([]);

export function AdminPermissionsProvider({ permissions, children }: { permissions: string[]; children: React.ReactNode }) {
  return <AdminPermissionsContext.Provider value={permissions}>{children}</AdminPermissionsContext.Provider>;
}

export function useAdminPermissions() {
  const permissions = useContext(AdminPermissionsContext);
  const hasPermission = (key: string) => permissions.includes(key);
  return { permissions, hasPermission };
}
