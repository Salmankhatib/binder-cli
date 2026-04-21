from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="Robustness Test API")

class UserRecord(BaseModel):
    uid: str
    fullName: str
    emailAddress: str
    role_type: str # Backend uses snake_case, maybe frontend uses camelCase
    is_active: bool

users_db = [
    UserRecord(uid="1", fullName="Alice Smith", emailAddress="alice@example.com", role_type="admin", is_active=True),
    UserRecord(uid="2", fullName="Bob Jones", emailAddress="bob@example.com", role_type="user", is_active=False),
]

@app.get("/users/all", response_model=List[UserRecord])
async def get_all_users():
    return users_db

@app.post("/users/create", response_model=UserRecord)
async def create_user(user: UserRecord):
    users_db.append(user)
    return user

@app.put("/users/update/{user_id}", response_model=UserRecord)
async def update_user(user_id: str, updated_user: UserRecord):
    for i, user in enumerate(users_db):
        if user.uid == user_id:
            users_db[i] = updated_user
            return updated_user
    raise HTTPException(status_code=404, detail="User not found")

@app.delete("/users/remove/{user_id}")
async def delete_user(user_id: str):
    global users_db
    users_db = [u for u in users_db if u.uid != user_id]
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
