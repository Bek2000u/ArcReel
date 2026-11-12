from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from server.agent_toolset.control_plane import GetTaskRequest, ListProjectTasksRequest, get_task, list_project_tasks
from server.tool_runtime import CallerContext, ProjectScope, Services, ToolRequest


@pytest.mark.asyncio
async def test_project_tasks_keep_receipt_and_omit_raw_provider_payload() -> None:
    queue = AsyncMock()
    queue.list_tasks.return_value = {
        "items": [
            {
                "task_id": "task-1",
                "project_name": "film",
                "provider_job_id": "provider-1",
                "status": "running",
                "payload": {"prompt": "private"},
                "result": {"secret_url": "ignored"},
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 25,
    }
    services = Services(AsyncMock(), AsyncMock(), AsyncMock(), queue=queue)
    outcome = await list_project_tasks(
        ToolRequest(ListProjectTasksRequest(status="running")),
        ProjectScope("film", Path(".")),
        CallerContext("user", "mcp"),
        services,
    )
    assert outcome.value is not None
    assert outcome.value["items"] == [
        {"task_id": "task-1", "project_name": "film", "status": "running", "provider_job_id": "provider-1"}
    ]
    assert queue.list_tasks.call_args.kwargs["project_name"] == "film"


@pytest.mark.asyncio
async def test_get_task_rejects_a_task_from_another_project() -> None:
    queue = AsyncMock()
    queue.get_task.return_value = {"task_id": "task-1", "project_name": "other-film"}
    services = Services(AsyncMock(), AsyncMock(), AsyncMock(), queue=queue)
    outcome = await get_task(
        ToolRequest(GetTaskRequest(task_id="task-1")),
        ProjectScope("film", Path(".")),
        CallerContext("user", "mcp"),
        services,
    )
    assert outcome.problem is not None
    assert outcome.problem.code == "task_not_found"
