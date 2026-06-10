import { useListAeresApprovals, useDecideAeresApproval, getListAeresApprovalsQueryKey, getListAeresThreatsQueryKey, getGetAeresStatusQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Clock, CheckSquare, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ApprovalQueue() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: approvals, isLoading } = useListAeresApprovals(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const decide = useDecideAeresApproval();

  const handleDecide = (id: number, decision: "approved" | "rejected") => {
    decide.mutate(
      { id, data: { decision } },
      {
        onSuccess: () => {
          toast({
            title: decision === "approved" ? "ACTION AUTHORISED" : "ACTION REJECTED",
            description: decision === "approved"
              ? "Aeres will execute the approved countermeasure."
              : "Threat has been dismissed.",
          });
          queryClient.invalidateQueries({ queryKey: getListAeresApprovalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAeresThreatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAeresStatusQueryKey() });
        },
        onError: () => toast({ title: "DECISION FAILED", variant: "destructive" }),
      }
    );
  };

  const tabs: { value: "pending" | "approved" | "rejected" | "all"; label: string }[] = [
    { value: "pending", label: "PENDING" },
    { value: "approved", label: "APPROVED" },
    { value: "rejected", label: "REJECTED" },
    { value: "all", label: "ALL" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-foreground">Approval Queue</h1>
          <p className="text-muted-foreground uppercase text-sm tracking-widest mt-1">Authorise or reject pending AI countermeasures</p>
        </div>
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 mb-6 border border-border/50 rounded p-1 bg-card/40 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            data-testid={`tab-${tab.value}`}
            className={`px-4 py-1.5 text-xs uppercase tracking-widest rounded transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))
        ) : !approvals || approvals.length === 0 ? (
          <Card className="border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="uppercase tracking-widest text-sm">Queue empty</p>
              <p className="text-xs mt-2 opacity-50">No {statusFilter !== "all" ? statusFilter : ""} approval requests</p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {approvals.map((approval) => (
              <motion.div
                key={approval.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                layout
              >
                <Card className={`border-border/50 bg-card/40 overflow-hidden ${
                  approval.status === "pending" ? "border-chart-3/40" : ""
                }`}>
                  <CardHeader className="pb-3 border-b border-border/50 bg-card/60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {approval.status === "pending" ? (
                          <Clock className="w-5 h-5 text-chart-3 mt-0.5 flex-shrink-0" />
                        ) : approval.status === "approved" ? (
                          <CheckCircle2 className="w-5 h-5 text-chart-5 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <CardTitle className="text-sm font-bold tracking-wide">
                            {approval.threatTitle || `Threat #${approval.threatId}`}
                          </CardTitle>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            REQ-{String(approval.id).padStart(4, "0")} · {new Date(approval.requestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold flex-shrink-0 ${
                        approval.status === "pending"
                          ? "text-chart-3 border-chart-3/40 bg-chart-3/10"
                          : approval.status === "approved"
                          ? "text-chart-5 border-chart-5/40 bg-chart-5/10"
                          : "text-muted-foreground border-border bg-secondary/50"
                      }`}>
                        {approval.status}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Proposed Action
                      </p>
                      <p className="text-sm font-mono text-chart-3 bg-chart-3/5 border border-chart-3/20 rounded p-3">
                        {approval.action}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">AI Reasoning</p>
                      <p className="text-sm text-foreground/70 border-l-2 border-primary/40 pl-3 italic">
                        {approval.reasoning}
                      </p>
                    </div>

                    {approval.status === "pending" && (
                      <div className="flex gap-3 pt-2">
                        <Button
                          data-testid={`btn-approve-${approval.id}`}
                          onClick={() => handleDecide(approval.id, "approved")}
                          disabled={decide.isPending}
                          className="flex-1 uppercase tracking-widest font-bold bg-chart-5/20 border border-chart-5/40 text-chart-5 hover:bg-chart-5/30 hover:text-chart-5"
                          variant="outline"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Authorise
                        </Button>
                        <Button
                          data-testid={`btn-reject-${approval.id}`}
                          onClick={() => handleDecide(approval.id, "rejected")}
                          disabled={decide.isPending}
                          className="flex-1 uppercase tracking-widest font-bold"
                          variant="destructive"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {approval.status !== "pending" && approval.resolvedAt && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Resolved {new Date(approval.resolvedAt).toLocaleString()}
                        {approval.resolvedBy ? ` by ${approval.resolvedBy}` : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
