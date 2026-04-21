from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from datetime import datetime

app = FastAPI(title="Team Manager API")

class Task(BaseModel):
    id: Optional[int] = None
    title: str
    description: str
    status: str  # "todo", "in_progress", "done"
    assigned_to: str
    created_at: datetime = datetime.now()

class DashboardStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    team_members: int

# In-memory DB
tasks_db: List[Task] = [
    Task(id=1, title="Design API", description="Create OpenAPI spec", status="done", assigned_to="Alice"),
    Task(id=2, title="Fix CSS", description="Update dashboard layout", status="todo", assigned_to="Bob"),
]

@app.get("/tasks", response_model=List[Task])
async def get_tasks():
    return tasks_db

@app.post("/tasks", response_model=Task)
async def create_task(task: Task):
    task.id = len(tasks_db) + 1
    tasks_db.append(task)
    return task

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    global tasks_db
    tasks_db = [t for t in tasks_db if t.id != task_id]
    return {"message": "Task deleted"}

@app.get("/stats", response_model=DashboardStats)
async def get_stats():
    done = len([t for t in tasks_db if t.status == "done"])
    return DashboardStats(
        total_tasks=len(tasks_db),
        completed_tasks=done,
        pending_tasks=len(tasks_db) - done,
        team_members=3
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
