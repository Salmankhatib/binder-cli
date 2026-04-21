from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date
from typing import List

app = FastAPI(title="E-Commerce API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Sale(BaseModel):
    id: int
    total_amount: float
    transaction_date: date
    customer_name: str
    region: str

@app.get("/api/sales", response_model=List[Sale])
async def get_sales(region: str | None = None):
    sales = [
        Sale(
            id=1,
            total_amount=150.00,
            transaction_date=date(2024, 1, 15),
            customer_name="Acme Corp",
            region="North"
        ),
        Sale(
            id=2,
            total_amount=230.50,
            transaction_date=date(2024, 1, 16),
            customer_name="Globex",
            region="South"
        )
    ]
    if region:
        sales = [s for s in sales if s.region.lower() == region.lower()]
    return sales

@app.post("/api/sales", response_model=Sale)
async def create_sale(sale: Sale):
    return sale

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
