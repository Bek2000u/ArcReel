import { useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useProjectsStore } from "@/stores/projects-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useWorkflowStore, workflowPlanKey } from "@/stores/workflow-store";

export function useWorkflowPlan(projectName: string, episode: number | null) {
  const key = workflowPlanKey(projectName, episode);
  const plan = useWorkflowStore((s) => s.planKey === key ? s.plan : null);
  const loading = useWorkflowStore((s) => s.loading);
  const error = useWorkflowStore((s) => s.error);
  const confirmedDurations = useWorkflowStore((s) => s.confirmedDurations);
  const refreshPlan = useWorkflowStore((s) => s.refreshPlan);
  const resetTarget = useWorkflowStore((s) => s.resetTarget);
  const snapshotRevision = useProjectsStore((s) => s.projectSnapshotRevisions[projectName] ?? 0);
  const taskFingerprint = useTasksStore((s) => s.tasks
    .filter((task) => task.project_name === projectName)
    .map((task) => `${task.task_id}:${task.status}`)
    .join("|"));
  const settledTaskFingerprint = useDebouncedValue(taskFingerprint, 250);

  // Project events and task transitions can both change the production plan.
  useEffect(() => {
    if (projectName) void refreshPlan(projectName, episode);
  }, [projectName, episode, snapshotRevision, settledTaskFingerprint, confirmedDurations, refreshPlan]);

  useEffect(() => () => resetTarget(), [resetTarget]);
  return { key, plan, loading, error, refreshPlan };
}
