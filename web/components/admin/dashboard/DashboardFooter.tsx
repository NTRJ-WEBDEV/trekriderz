interface DashboardFooterProps {
  version: string;
  commit: string | null;
  env: string | null;
}

export default function DashboardFooter({ version, commit, env }: DashboardFooterProps) {
  const items: { label: string; value: string }[] = [
    { label: "System Version", value: `v${version}` },
    { label: "Last Deployment", value: commit ? commit : "n/a (local)" },
    { label: "Database Version", value: "—" },
    { label: "Last Backup", value: "—" },
    { label: "Environment", value: env || "development" },
  ];
  return (
    <footer className="mt-4 pt-6 flex flex-wrap gap-x-8 gap-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {items.map((item) => (
        <div key={item.label} className="text-xs">
          <span className="text-white/25">{item.label}: </span>
          <span className="text-white/45">{item.value}</span>
        </div>
      ))}
    </footer>
  );
}
