import AdminShell from "./AdminShell";
import { getAdminSession } from "@/lib/supabase-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  // No redirect here — middleware.ts handles all /admin/* auth redirects.
  // If there's no session (e.g. /admin/login), just render children without the sidebar.
  if (!session) return <>{children}</>;
  return <AdminShell profile={session.profile} permissions={session.permissions}>{children}</AdminShell>;
}
