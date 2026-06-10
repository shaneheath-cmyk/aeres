import { useGetAeresStatus, useTriggerAeresScan, useListAeresThreats, getListAeresThreatsQueryKey } from "@workspace/api-client-react";
import { Activity, RadioTower, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export default function MissionControl() {
  const { data: status, isLoading: statusLoading } = useGetAeresStatus();
  const { data: threats, isLoading: threatsLoading } = useListAeresThreats({ status: 'active' });
  const triggerScan = useTriggerAeresScan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTriggerScan = () => {
    triggerScan.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "SCAN INITIATED",
          description: "Drone sweeping threat surface. Awaiting telemetry...",
        });
        queryClient.invalidateQueries({ queryKey: getListAeresThreatsQueryKey() });
        // In a real app we might poll status or wait for websocket push
      },
      onError: (err) => {
        toast({
          title: "SCAN FAILED",
          description: "Uplink interrupted. Please retry.",
          variant: "destructive"
        })
      }
    });
  };

  const criticalCount = threats?.filter(t => t.severity === 'critical').length || 0;
  const highCount = threats?.filter(t => t.severity === 'high').length || 0;
  const medCount = threats?.filter(t => t.severity === 'medium').length || 0;
  const lowCount = threats?.filter(t => t.severity === 'low').length || 0;

  const chartData = [
    { name: 'CRIT', count: criticalCount, fill: 'hsl(var(--destructive))' },
    { name: 'HIGH', count: highCount, fill: 'hsl(var(--chart-3))' },
    { name: 'MED', count: medCount, fill: 'hsl(var(--chart-2))' },
    { name: 'LOW', count: lowCount, fill: 'hsl(var(--chart-5))' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-foreground">Mission Control</h1>
          <p className="text-muted-foreground uppercase text-sm tracking-widest mt-1">Live Telemetry & Global Status</p>
        </div>

        <div className="flex items-center gap-4">
          {statusLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <div className={`flex items-center gap-3 px-4 py-2 rounded border bg-card/50 backdrop-blur ${status?.status === 'scanning' ? 'border-primary text-primary' : 'border-border text-foreground'}`}>
              <div className="relative flex items-center justify-center">
                {(status?.status === 'scanning' || status?.status === 'responding') && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={`absolute inset-0 rounded-full ${status.status === 'responding' ? 'bg-destructive' : 'bg-primary'}`}
                  />
                )}
                {status?.status === 'responding' ? <Activity className="w-5 h-5 text-destructive relative z-10" /> : <RadioTower className="w-5 h-5 relative z-10" />}
              </div>
              <span className="font-bold uppercase tracking-wider text-sm">{status?.status || 'UNKNOWN'}</span>
            </div>
          )}

          <Button 
            onClick={handleTriggerScan} 
            disabled={triggerScan.isPending || status?.status === 'scanning'}
            className="uppercase tracking-widest font-bold"
          >
            {triggerScan.isPending ? "INITIATING..." : "FORCE SCAN"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Active Threats" 
          value={status?.activeThreatCount ?? '--'} 
          icon={<ShieldAlert className={criticalCount > 0 ? "text-destructive" : "text-primary"} />}
          alert={criticalCount > 0}
        />
        <StatCard 
          title="Pending Actions" 
          value={status?.pendingApprovalCount ?? '--'} 
          icon={<CheckCircle2 className="text-amber-500" />}
        />
        <StatCard 
          title="Autonomy Mode" 
          value={status?.autonomyMode || '--'} 
          icon={<Cpu className="text-chart-2" />}
        />
        <StatCard 
          title="Last Sweep" 
          value={status?.lastScanAt ? new Date(status.lastScanAt).toLocaleTimeString() : '--'} 
          icon={<Activity className="text-muted-foreground" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        {/* Active Threats List */}
        <Card className="lg:col-span-2 flex flex-col border-border/50 bg-card/40 backdrop-blur overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4 bg-card/60">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-destructive" />
              Live Threat Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {threatsLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : threats && threats.length > 0 ? (
              <div className="divide-y divide-border/30">
                {threats.slice(0, 10).map(threat => (
                  <div key={threat.id} className="p-4 hover:bg-secondary/30 transition-colors flex items-start gap-4">
                    <div className={`mt-1 w-2 h-2 rounded-full ${
                      threat.severity === 'critical' ? 'bg-destructive shadow-[0_0_8px_var(--color-destructive)]' :
                      threat.severity === 'high' ? 'bg-chart-3 shadow-[0_0_8px_var(--color-chart-3)]' :
                      threat.severity === 'medium' ? 'bg-chart-2' : 'bg-chart-5'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm tracking-wide">{threat.title}</h4>
                        <span className="text-[10px] text-muted-foreground font-mono">{new Date(threat.detectedAt).toISOString().split('T')[1].slice(0,8)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{threat.description}</p>
                      <div className="flex gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded uppercase tracking-wider border border-border/50">{threat.category}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded uppercase tracking-wider border border-border/50">{threat.targetAsset}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="uppercase tracking-widest text-sm">No active threats</p>
                <p className="text-xs mt-2 opacity-50">Perimeter secure</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card className="flex flex-col border-border/50 bg-card/40 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4 bg-card/60">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-chart-3" />
              Severity Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center">
            {threatsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--secondary))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-destructive/10 border border-destructive/20 p-3 rounded text-center">
                <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
                <div className="text-[10px] uppercase tracking-widest text-destructive/80 mt-1">Critical</div>
              </div>
              <div className="bg-chart-3/10 border border-chart-3/20 p-3 rounded text-center">
                <div className="text-2xl font-bold text-chart-3">{highCount}</div>
                <div className="text-[10px] uppercase tracking-widest text-chart-3/80 mt-1">High</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, alert }: { title: string, value: string | number, icon: React.ReactNode, alert?: boolean }) {
  return (
    <Card className={`border-border/50 bg-card/40 backdrop-blur ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
          <h3 className={`text-2xl font-bold ${alert ? 'text-destructive' : 'text-foreground'}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${alert ? 'bg-destructive/10' : 'bg-secondary/50'}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
