import { useAppStore } from "@/stores/app-store";
import { useAssistantStore, type ShotDraftContext } from "@/stores/assistant-store";

/** 把一段指令预填进 Agent 输入框并打开面板；只填不发送，用户核对后自行发送。 */
export function prefillAssistant(text: string): void {
  const store = useAssistantStore.getState();
  store.setShotDraftContext(null);
  store.setInput(text);
  useAppStore.getState().setAssistantPanelOpen(true);
}

export function discussShot(context: ShotDraftContext): void {
  useAssistantStore.getState().setShotDraftContext(context);
  useAppStore.getState().setAssistantPanelOpen(true);
}
