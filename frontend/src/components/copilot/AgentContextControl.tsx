import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API } from "@/api";
import { InputGroupButton } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import type { AgentContextUsage } from "@/types";

interface SessionRef {
  projectName: string;
  sessionId: string;
}

export function AgentContextControl({ projectName, sessionId, busy }: SessionRef & { busy: boolean }) {
  const { t } = useTranslation("dashboard");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<InputGroupButton size="icon-sm" aria-label={t("chat_context_title")} />}>
        <Gauge aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64">
        <PopoverTitle>{t("chat_context_title")}</PopoverTitle>
        {open && (busy ? (
          <p className="text-xs text-muted-foreground">{t("chat_context_busy")}</p>
        ) : (
          <ContextDetails projectName={projectName} sessionId={sessionId} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ContextDetails({ projectName, sessionId }: SessionRef) {
  const { t, i18n } = useTranslation("dashboard");
  const [usage, setUsage] = useState<AgentContextUsage | null>();

  useEffect(() => {
    const abort = new AbortController();
    void API.getAssistantContextUsage(projectName, sessionId, abort.signal).then(
      (result) => { if (!abort.signal.aborted) setUsage(result); },
      () => { if (!abort.signal.aborted) setUsage(null); },
    );
    return () => abort.abort();
  }, [projectName, sessionId]);

  if (usage === undefined) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        {t("chat_context_loading")}
      </p>
    );
  }
  if (usage === null) return <p className="text-xs text-muted-foreground">{t("chat_context_unavailable")}</p>;

  const { used_tokens: used, limit_tokens: limit, compact_at_tokens: compactAt } = usage;
  const ratio = Math.min(used / limit, 1);
  const numbers = new Intl.NumberFormat(i18n.resolvedLanguage);
  const percent = new Intl.NumberFormat(i18n.resolvedLanguage, { style: "percent", maximumFractionDigits: 1 });
  const usedPercent = t("chat_context_used_percent", { percent: percent.format(ratio) });

  return (
    <div className="flex flex-col gap-2 text-xs tabular-nums">
      <div className="flex flex-wrap justify-between gap-x-2">
        <span>{usedPercent}</span>
        <span className="text-muted-foreground">{t("chat_context_free_percent", { percent: percent.format(1 - ratio) })}</span>
      </div>
      <Progress value={ratio * 100} aria-label={usedPercent} />
      <p>{t("chat_context_tokens", { used: numbers.format(used), limit: numbers.format(limit) })}</p>
      {compactAt !== null && (
        <p className="text-muted-foreground">
          {t("chat_context_before_compaction", { tokens: numbers.format(Math.max(0, compactAt - used)) })}
        </p>
      )}
    </div>
  );
}
