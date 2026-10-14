import { setWorkspaceHeader, supabase } from "@/integrations/supabase/client";
import type { Deal, DealTask } from "@/lib/dealsStore";
import { formatLocalDateInput } from "@/lib/utils";

const db = supabase as any;

const buildDueDate = (baseDate: Date, dueDays: number) => {
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + dueDays);
  return formatLocalDateInput(dueDate);
};

export interface TaskAutomationResult {
  tasks: DealTask[];
  taskTitles: string[];
}

export async function runTaskAutomationsForStageChange(
  deal: Deal,
  stageId: string,
  movementDate: Date,
  stageLabel?: string,
): Promise<TaskAutomationResult> {
  if (!deal.workspaceId || !deal.pipelineId) {
    return { tasks: [], taskTitles: [] };
  }

  setWorkspaceHeader(deal.workspaceId);

  const { data: rules, error: rulesError } = await db
    .from("task_automation_rules")
    .select("*")
    .eq("workspace_id", deal.workspaceId)
    .eq("pipeline_id", deal.pipelineId)
    .eq("stage_id", stageId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (rulesError) throw rulesError;
  if (!rules?.length) return { tasks: [], taskTitles: [] };

  const createdTasks: DealTask[] = [];
  const taskTitles: string[] = [];

  for (const rule of rules) {
    const executionId = crypto.randomUUID();
    const reservationPayload = {
      id: executionId,
      rule_id: rule.id,
      negotiation_id: deal.id,
      stage_id: stageId,
      task_id: null,
    };

    const { error: reservationError } = await db.from("task_automation_executions").insert(reservationPayload);

    if (reservationError) {
      if (reservationError.code === "23505") {
        continue;
      }
      throw reservationError;
    }

    const taskId = crypto.randomUUID();
    const createdAt = movementDate.toISOString();
    const task: DealTask = {
      id: taskId,
      title: rule.task_title,
      description: rule.task_description || "",
      dueDate: buildDueDate(movementDate, Number(rule.due_days) || 0),
      assignedTo: deal.assignedTo || undefined,
      taskType: stageLabel ? `${stageLabel}:` : "Automacao",
      companyId: deal.companyId,
      status: "pending",
      completed: false,
      createdAt,
    };

    const { error: taskError } = await db.from("crm_tasks").insert({
      id: task.id,
      deal_id: deal.id,
      company_id: deal.companyId || null,
      title: task.title,
      description: task.description || null,
      due_date: task.dueDate || null,
      due_time: null,
      assigned_to: typeof task.assignedTo === "string" && task.assignedTo.length === 36 ? task.assignedTo : null,
      task_type: task.taskType,
      status: "pending",
      completed: false,
      created_at: createdAt,
      updated_at: createdAt,
    });

    if (taskError) {
      await db.from("task_automation_executions").delete().eq("id", executionId);
      throw taskError;
    }

    const { error: updateExecutionError } = await db
      .from("task_automation_executions")
      .update({ task_id: task.id })
      .eq("id", executionId);

    if (updateExecutionError) throw updateExecutionError;

    createdTasks.push(task);
    taskTitles.push(task.title);
  }

  return { tasks: createdTasks, taskTitles };
}
