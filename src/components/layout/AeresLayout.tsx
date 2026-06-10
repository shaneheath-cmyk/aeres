import { Link, useLocation } from "wouter";
import {
  ShieldAlert,
  RadioTower,
  Activity,
  CheckSquare,
  Search,
  Radar,
  Terminal,
} from "lucide-react";
import { ReactNode } from "react";
import { useGetAeresStatus } from "@workspace/api-client-react";

export function AeresLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const { data: status } = useGetAeresStatus();

  return (
    <div className="flex min-h-screen bg-background text-foreground font-mono">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col z-10">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="relative">
            <RadioTower className="w-6 h-6 text-primary" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-widest text-lg leading-tight uppercase">
              AERES
            </span>
            <span className="text-[10px] text-muted-foreground uppercase">
              Ops Console v{status?.version || "2.4.1"}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
          <NavItem
            href="/"
            current={location}
            icon={<Activity className="w-4 h-4" />}
            label="Mission Control"
          />
          <NavItem
            href="/threats"
            current={location}
            icon={<ShieldAlert className="w-4 h-4" />}
            label="Threat Surface"
          />
          <NavItem
            href="/approvals"
            current={location}
            icon={<CheckSquare className="w-4 h-4" />}
            label="Approval Queue"
            badge={status?.pendingApprovalCount}
          />
          <NavItem
            href="/analyse"
            current={location}
            icon={<Search className="w-4 h-4" />}
            label="Intel Query"
          />
        </nav>

        <div className="p-4 border-t border-border bg-background/50 text-xs">
          <div className="flex justify-between mb-2 text-muted-foreground">
            <span>Uplink:</span>
            <span className="text-primary">SECURE</span>
          </div>
          <div className="flex justify-between mb-2 text-muted-foreground">
            <span>Autonomy:</span>
            <span className="text-amber-500">{status?.autonomyMode || "SUPERVISED"}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Last Scan:</span>
            <span>{status?.lastScanAt ? new Date(status.lastScanAt).toLocaleTimeString() : "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
        {/* Subtle scanline effect overlay */}
        <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
        {children}
      </main>
    </div>
  );
}

function NavItem({
  href,
  current,
  icon,
  label,
  badge,
}: {
  href: string;
  current: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  const isActive = current === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group ${
        isActive
          ? "bg-primary/10 text-primary border-l-2 border-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent"
      }`}
    >
      <span className={isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}>
        {icon}
      </span>
      <span className="text-sm tracking-wide uppercase">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </Link>
  );
}
