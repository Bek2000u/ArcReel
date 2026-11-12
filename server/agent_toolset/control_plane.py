"""Read persisted task and final cut state through the shared ArcReel MCP tools."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from lib.edit_timeline.errors import EditTimelineError
from lib.final_cut.basis import SubtitleMode
from lib.final_cut.errors import FinalCutError
from lib.final_cut.service import FinalCutService
from lib.generation.task_failure import parse_failure
from lib.jianying_draft.basis import DraftNarration
from server.agent_toolset.declaration import Exempt, ToolDeclaration
from server.media_tools.final_cuts import final_cut_download_url
from server.tool_runtime import CallerContext, ProjectScope, Services, ToolOutcome, ToolProblem, ToolRequest


class ListProjectTasksRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: str | None = Field(default=None, description="Optional task status filter")
    task_type: str | None = Field(default=None, description="Optional task type filter")
    source: str | None = Field(default=None, description="Optional submission source filter")
    page: int = Field(default=1, ge=1, description="One-based page number")
    page_size: int = Field(default=25, ge=1, le=100, description="Maximum tasks returned per page")


class GetTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    task_id: str = Field(min_length=1, description="ID from list_project_tasks or get_generation_batch")


class FinalCutStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    timeline: str = Field(min_length=1, description="Timeline ID from list_timelines")
    narration: DraftNarration | None = Field(default=None, description="Which narration variant to look up")
    subtitles: SubtitleMode = Field(default="burned_subtitles", description="Which subtitle variant to look up")


def _task_readout(task: dict[str, Any]) -> dict[str, Any]:
    fields = (
        "task_id",
        "batch_id",
        "project_name",
        "task_type",
        "resource_id",
        "resource_type",
        "script_file",
        "status",
        "source",
        "provider_id",
        "provider_job_id",
        "queued_at",
        "started_at",
        "finished_at",
        "updated_at",
    )
    value = {key: task[key] for key in fields if key in task}
    failure = parse_failure(task.get("error_message"))
    if failure is not None:
        value["error_code"] = failure[0]
    return value


async def list_project_tasks(
    request: ToolRequest[ListProjectTasksRequest], scope: ProjectScope, _caller: CallerContext, services: Services
) -> ToolOutcome[dict[str, Any]]:
    result = await services.queue.list_tasks(project_name=scope.project_name, **request.value.model_dump())
    return ToolOutcome(value={**result, "items": [_task_readout(task) for task in result["items"]]})


async def get_task(
    request: ToolRequest[GetTaskRequest], scope: ProjectScope, _caller: CallerContext, services: Services
) -> ToolOutcome[dict[str, Any]]:
    task = await services.queue.get_task(request.value.task_id)
    if task is None or task.get("project_name") != scope.project_name:
        return ToolOutcome(problem=ToolProblem("task_not_found", "The task does not exist in this project."))
    return ToolOutcome(value=_task_readout(task))


async def get_final_cut_status(
    request: ToolRequest[FinalCutStatusRequest], scope: ProjectScope, _caller: CallerContext, services: Services
) -> ToolOutcome[dict[str, Any]]:
    value = request.value
    try:
        status = await FinalCutService(services.projects).status(
            scope.project_name, value.timeline, narration=value.narration, subtitles=value.subtitles
        )
    except (FinalCutError, EditTimelineError) as exc:
        return ToolOutcome(problem=ToolProblem(exc.code, str(exc), params=exc.params or None))
    download_url = (
        final_cut_download_url(scope.project_name, status.artifact_path, status.version)
        if status.version is not None
        else None
    )
    return ToolOutcome(value={**status.model_dump(mode="json"), "download_url": download_url})


CONTROL_PLANE_TOOLS = (
    ToolDeclaration(
        name="list_project_tasks",
        description="List persisted tasks in this project, including batches and known provider job IDs. Read-only.",
        request_model=ListProjectTasksRequest,
        migration=Exempt("Task state can be inspected even when project migration is blocked."),
        domain_key="project_tasks",
        handler=list_project_tasks,
    ),
    ToolDeclaration(
        name="get_task",
        description="Inspect one persisted task in this project by task ID. Read-only.",
        request_model=GetTaskRequest,
        migration=Exempt("Task state can be inspected even when project migration is blocked."),
        domain_key="task",
        handler=get_task,
    ),
    ToolDeclaration(
        name="get_final_cut_status",
        description="Find the existing MP4 for a timeline and narration/subtitle variant. Reports missing, stale or current without rendering.",
        request_model=FinalCutStatusRequest,
        migration=Exempt("Delivery status is a read-only lookup."),
        domain_key="final_cut_status",
        handler=get_final_cut_status,
    ),
)
