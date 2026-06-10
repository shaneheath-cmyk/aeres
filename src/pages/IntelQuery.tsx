import { useState } from "react";
import { useAnalyseAeresThreats, useListAeresThreats } from "@workspace/api-client-react";
import { Search, Zap, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

interface AnalysisResult {
  analysis: string;
  recommendations: string[];
  riskScore: number;
}

const RISK_COLOUR = (score: number) => {
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-chart-3";
  if (score >= 25) return "text-chart-2";
  return "text-chart-5";
};

const RISK_BG = (score: number) => {
  if (score >= 75) return "from-destructive/20 to-transparent border-destructive/30";
  if (score >= 50) return "from-chart-3/20 to-transparent border-chart-3/30";
  if (score >= 25) return "from-chart-2/20 to-transparent border-chart-2/30";
  return "from-chart-5/20 to-transparent border-chart-5/30";
};

const PRESET_QUERIES = [
  "Summarise all active threats and their potential blast radius.",
  "What is the most likely attack vector based on current threat patterns?",
  "Recommend a prioritised response plan for the next 30 minutes.",
  "Are there indicators of a coordinated multi-vector intrusion?",
];

export default function IntelQuery() {
  const [context, setContext] = useState("");
  const [selectedThreatIds, setSelectedThreatIds] = useState<number[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const { data: activeThreats } = useListAeresThreats({ status: "active" });
  const analyse = useAnalyseAeresThreats();

  const handleToggleThreat = (id: number) => {
    setSelectedThreatIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!context.trim()) return;
    setResult(null);
    analyse.mutate(
      { data: { context: context.trim(), threatIds: selectedThreatIds.length > 0 ? selectedThreatIds : undefined } },
      {
        onSuccess: (data) => setResult(data as AnalysisResult),
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-foreground">Intel Query</h1>
        <p className="text-muted-foreground uppercase text-sm tracking-widest mt-1">
          Direct uplink to Aeres AI — analyse threats and get countermeasure recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-3 border-b border-border/50 bg-card/60">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Query Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Intelligence Query
                </Label>
                <Textarea
                  data-testid="input-query-context"
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="Describe what you want the AI to analyse or assess..."
                  className="font-mono text-sm bg-background/50 border-border/50 resize-none h-32 focus:border-primary/60 focus:ring-0"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Quick Queries
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_QUERIES.map((q, i) => (
                    <button
                      key={i}
                      data-testid={`preset-query-${i}`}
                      onClick={() => setContext(q)}
                      className="text-left text-xs text-muted-foreground border border-border/50 rounded p-2.5 bg-secondary/30 hover:bg-secondary/60 hover:text-foreground transition-colors leading-relaxed"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                data-testid="btn-submit-query"
                onClick={handleSubmit}
                disabled={!context.trim() || analyse.isPending}
                className="w-full uppercase tracking-widest font-bold"
              >
                {analyse.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Querying Aeres...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run Intelligence Query
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <AnimatePresence>
            {analyse.isPending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aeres is analysing...
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-full mt-4" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {result && !analyse.isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Card className={`border bg-gradient-to-b ${RISK_BG(result.riskScore)}`}>
                  <CardHeader className="pb-3 border-b border-border/50 bg-card/60">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Intelligence Report
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Risk Score</span>
                        <span className={`text-2xl font-bold font-mono ${RISK_COLOUR(result.riskScore)}`}>
                          {result.riskScore}
                        </span>
                        <span className="text-muted-foreground text-xs">/100</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Analysis</p>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{result.analysis}</p>
                    </div>

                    {result.recommendations && result.recommendations.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Recommendations
                        </p>
                        <ul className="space-y-2">
                          {result.recommendations.map((rec, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="flex items-start gap-3 text-sm"
                              data-testid={`recommendation-${i}`}
                            >
                              <span className="flex-shrink-0 w-5 h-5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-foreground/80">{rec}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Threat Selection Sidebar */}
        <div>
          <Card className="border-border/50 bg-card/40 sticky top-0">
            <CardHeader className="pb-3 border-b border-border/50 bg-card/60">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-chart-3" />
                Include Threats
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                Select active threats to include in the analysis context
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {!activeThreats || activeThreats.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 uppercase tracking-wider">
                  No active threats
                </p>
              ) : (
                <div className="space-y-2">
                  {activeThreats.map((threat) => (
                    <label
                      key={threat.id}
                      className="flex items-start gap-3 p-2.5 rounded border border-border/50 bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors group"
                      data-testid={`threat-checkbox-${threat.id}`}
                    >
                      <Checkbox
                        checked={selectedThreatIds.includes(threat.id)}
                        onCheckedChange={() => handleToggleThreat(threat.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{threat.title}</p>
                        <div className="flex gap-1 mt-0.5">
                          <span className={`text-[9px] uppercase font-bold ${
                            threat.severity === "critical" ? "text-destructive" :
                            threat.severity === "high" ? "text-chart-3" :
                            threat.severity === "medium" ? "text-chart-2" : "text-chart-5"
                          }`}>{threat.severity}</span>
                          <span className="text-[9px] text-muted-foreground">· {threat.category}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedThreatIds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-[10px] text-primary uppercase tracking-widest">
                    {selectedThreatIds.length} threat{selectedThreatIds.length > 1 ? "s" : ""} selected
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
