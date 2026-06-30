import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";
import { getAdminSession } from "@/lib/supabase-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell profile={session.profile}>
      {children}
    </AdminShell>
  );
}
