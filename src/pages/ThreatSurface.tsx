import { useState } from "react";
import { useListAeresThreats, useUpdateAeresThreatStatus, getListAeresThreatsQueryKey } from "@workspace/api-client-react";
import { ShieldAlert, ShieldCheck, Network, Globe, Cpu, Wifi, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEVERITY_CONFIG = {
  critical: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", dot: "bg-destructive shadow-[0_0_8px_var(--color-destructive)]", label: "CRITICAL" },
  high:     { color: "text-chart-3", bg: "bg-chart-3/10", border: "border-chart-3/30", dot: "bg-chart-3", label: "HIGH" },
  medium:   { color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/30", dot: "bg-chart-2", label: "MED" },
  low:      { color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/30", dot: "bg-chart-5", label: "LOW" },
};

const STATUS_CONFIG = {
  active:           { label: "ACTIVE", color: "text-destructive border-destructive/40 bg-destructive/10" },
  pending_approval: { label: "PENDING", color: "text-chart-3 border-chart-3/40 bg-chart-3/10" },
  investigating:    { label: "INVESTIGATING", color: "text-primary border-primary/40 bg-primary/10" },
  mitigated:        { label: "MITIGATED", color: "text-chart-5 border-chart-5/40 bg-chart-5/10" },
  dismissed:        { label: "DISMISSED", color: "text-muted-foreground border-border bg-secondary/50" },
};

const CATEGORY_ICONS = {
  network:     <Network className="w-3 h-3" />,
  application: <Globe className="w-3 h-3" />,
  physical:    <Cpu className="w-3 h-3" />,
  iot:         <Wifi className="w-3 h-3" />,
};

export default function ThreatSurface() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, string> = {};
  if (severityFilter !== "all") params.severity = severityFilter;
  if (categoryFilter !== "all") params.category = categoryFilter;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data: threats, isLoading } = useListAeresThreats(
    Object.keys(params).length > 0 ? params : undefined
  );

  const updateStatus = useUpdateAeresThreatStatus();

  const handleStatusChange = (id: number, status: string) => {
    updateStatus.mutate(
      { id, data: { status: status as "active" | "mitigated" | "dismissed" | "investigating" | "pending_approval" } },
      {
        onSuccess: () => {
          toast({ title: "STATUS UPDATED", description: `Threat #${id} marked as ${status.toUpperCase()}` });
          queryClient.invalidateQueries({ queryKey: getListAeresThreatsQueryKey() });
        },
        onError: () => toast({ title: "UPDATE FAILED", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-foreground">Threat Surface</h1>
          <p className="text-muted-foreground uppercase text-sm tracking-widest mt-1">All detected threats across the unified surface</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border/50 rounded px-3 py-2 bg-card/40">
          <Filter className="w-3 h-3 mr-1" />
          <span className="uppercase tracking-wider">{threats?.length ?? 0} records</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40 uppercase text-xs tracking-wider bg-card/40 border-border/50" data-testid="filter-severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 uppercase text-xs tracking-wider bg-card/40 border-border/50" data-testid="filter-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="network">Network</SelectItem>
            <SelectItem value="application">Application</SelectItem>
            <SelectItem value="physical">Physical</SelectItem>
            <SelectItem value="iot">IoT</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 uppercase text-xs tracking-wider bg-card/40 border-border/50" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="mitigated">Mitigated</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Threat List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : !threats || threats.length === 0 ? (
          <Card className="border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
              <p className="uppercase tracking-widest text-sm">No threats detected</p>
              <p className="text-xs mt-2 opacity-50">Perimeter secure — no matching records</p>
            </CardContent>
          </Card>
        ) : (
          threats.map((threat) => {
            const sev = SEVERITY_CONFIG[threat.severity as keyof typeof SEVERITY_CONFIG];
            const stat = STATUS_CONFIG[threat.status as keyof typeof STATUS_CONFIG];
            const isExpanded = expandedId === threat.id;

            return (
              <motion.div
                key={threat.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                layout
              >
                <Card className={`border-border/50 bg-card/40 overflow-hidden transition-colors ${sev.border} hover:bg-card/60`}>
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : threat.id)}
                    data-testid={`threat-row-${threat.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-sm tracking-wide truncate">{threat.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${sev.color} ${sev.bg} ${sev.border}`}>
                          {sev.label}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 text-muted-foreground border-border/50 bg-secondary/50">
                          {CATEGORY_ICONS[threat.category as keyof typeof CATEGORY_ICONS]}
                          {threat.category}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${stat.color}`}>
                          {stat.label}
                        </span>
                        {threat.targetAsset && (
                          <span className="text-[10px] text-muted-foreground font-mono">→ {threat.targetAsset}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono hidden md:block">
                        {new Date(threat.detectedAt).toLocaleString()}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="border-t border-border/50 p-4 bg-background/30 space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                            <p className="text-sm text-foreground/80">{threat.description}</p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {threat.sourceIp && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Source IP</p>
                                <p className="text-sm font-mono text-chart-2">{threat.sourceIp}</p>
                              </div>
                            )}
                            {threat.targetAsset && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Target</p>
                                <p className="text-sm font-mono">{threat.targetAsset}</p>
                              </div>
                            )}
                            {threat.autoActed && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Auto Action</p>
                                <p className="text-sm text-primary">{threat.actionTaken || "Yes"}</p>
                              </div>
                            )}
                            {threat.resolvedAt && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Resolved</p>
                                <p className="text-sm font-mono">{new Date(threat.resolvedAt).toLocaleString()}</p>
                              </div>
                            )}
                          </div>

                          {threat.aiReasoning && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">AI Reasoning</p>
                              <p className="text-sm text-foreground/70 italic border-l-2 border-primary/40 pl-3">{threat.aiReasoning}</p>
                            </div>
                          )}

                          {(threat.status === "active" || threat.status === "investigating") && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs uppercase tracking-wider border-primary/40 text-primary hover:bg-primary/10"
                                data-testid={`btn-investigate-${threat.id}`}
                                onClick={() => handleStatusChange(threat.id, "investigating")}
                                disabled={updateStatus.isPending || threat.status === "investigating"}
                              >
                                Investigate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs uppercase tracking-wider border-chart-5/40 text-chart-5 hover:bg-chart-5/10"
                                data-testid={`btn-mitigate-${threat.id}`}
                                onClick={() => handleStatusChange(threat.id, "mitigated")}
                                disabled={updateStatus.isPending}
                              >
                                Mark Mitigated
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs uppercase tracking-wider border-border/50 text-muted-foreground hover:bg-secondary"
                                data-testid={`btn-dismiss-${threat.id}`}
                                onClick={() => handleStatusChange(threat.id, "dismissed")}
                                disabled={updateStatus.isPending}
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
