from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import stock_collection, stock_movements_collection
from models import StockItem, StockItemCreate, StockItemUpdate, StockMovement, StockMovementCreate
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/", response_model=StockItem)
async def create_stock_item(data: StockItemCreate, request: Request):
    """Create new stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    new_item = StockItem(**data.model_dump())
    item_dict = new_item.model_dump(by_alias=True)
    
    await stock_collection.insert_one(item_dict)
    
    return new_item

@router.get("/", response_model=List[StockItem])
async def get_stock_items(
    request: Request,
    location: Optional[str] = None,
    critical_only: bool = False,
    expired_only: bool = False
):
    """Get all stock items with filters"""
    await get_current_user(request)
    
    query = {}
    
    if location:
        query["location"] = location
    
    if critical_only:
        # Find items below minimum quantity
        query["$expr"] = {"$lt": ["$quantity", "$min_quantity"]}
    
    if expired_only:
        query["expiry_date"] = {"$lte": datetime.utcnow()}
    
    items = await stock_collection.find(query).to_list(1000)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return items

@router.get("/{item_id}", response_model=StockItem)
async def get_stock_item(item_id: str, request: Request):
    """Get stock item by ID"""
    await get_current_user(request)
    
    item_doc = await stock_collection.find_one({"_id": item_id})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    item_doc["id"] = item_doc.pop("_id")
    return StockItem(**item_doc)

@router.get("/qr/{qr_code}", response_model=StockItem)
async def get_stock_item_by_qr(qr_code: str, request: Request):
    """Get stock item by QR code"""
    await get_current_user(request)
    
    item_doc = await stock_collection.find_one({"qr_code": qr_code})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    item_doc["id"] = item_doc.pop("_id")
    return StockItem(**item_doc)

@router.patch("/{item_id}", response_model=StockItem)
async def update_stock_item(item_id: str, data: StockItemUpdate, request: Request):
    """Update stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await stock_collection.find_one_and_update(
        {"_id": item_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    result["id"] = result.pop("_id")
    return StockItem(**result)

@router.delete("/{item_id}")
async def delete_stock_item(item_id: str, request: Request):
    """Delete stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    result = await stock_collection.delete_one({"_id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    return {"message": "Stock item deleted successfully"}

@router.get("/alerts/summary")
async def get_stock_alerts(request: Request):
    """Get stock alerts summary"""
    await get_current_user(request)
    
    # Critical stock (below minimum)
    critical = await stock_collection.count_documents({
        "$expr": {"$lt": ["$quantity", "$min_quantity"]}
    })
    
    # Expired items
    expired = await stock_collection.count_documents({
        "expiry_date": {"$lte": datetime.utcnow()}
    })
    
    # Expiring soon (within 30 days)
    expiring_soon = await stock_collection.count_documents({
        "expiry_date": {
            "$gt": datetime.utcnow(),
            "$lte": datetime.utcnow() + timedelta(days=30)
        }
    })
    
    return {
        "critical_stock": critical,
        "expired": expired,
        "expiring_soon": expiring_soon
    }

# Stock Movement Endpoints
@router.post("/movements", response_model=StockMovement)
async def create_stock_movement(data: StockMovementCreate, request: Request):
    """Record stock movement"""
    user = await get_current_user(request)
    
    # Get stock item
    stock_item = await stock_collection.find_one({"_id": data.stock_item_id})
    if not stock_item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    # Create movement
    movement = StockMovement(
        stock_item_id=data.stock_item_id,
        movement_type=data.movement_type,
        quantity=data.quantity,
        from_location=data.from_location,
        to_location=data.to_location,
        reason=data.reason,
        notes=data.notes,
        performed_by=user.id
    )
    
    movement_dict = movement.model_dump(by_alias=True)
    await stock_movements_collection.insert_one(movement_dict)
    
    # Update stock quantity
    if data.movement_type == "in":
        new_quantity = stock_item["quantity"] + data.quantity
    elif data.movement_type == "out":
        new_quantity = stock_item["quantity"] - data.quantity
    else:  # transfer
        new_quantity = stock_item["quantity"]
    
    await stock_collection.update_one(
        {"_id": data.stock_item_id},
        {"$set": {"quantity": new_quantity, "updated_at": datetime.utcnow()}}
    )
    
    return movement

@router.get("/movements", response_model=List[StockMovement])
async def get_stock_movements(
    request: Request,
    stock_item_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100
):
    """Get stock movement history"""
    await get_current_user(request)
    
    query = {}
    if stock_item_id:
        query["stock_item_id"] = stock_item_id
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await stock_movements_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for movement in movements:
        movement["id"] = movement.pop("_id")
    
    return movements
