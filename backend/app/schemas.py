from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class UpdateName(BaseModel):
    friendly_name: str


class PlaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    google_rating: Optional[float] = None
    has_order_ahead: bool = False
    category: Optional[str] = "dine_in"
    lat: Optional[float] = None
    lng: Optional[float] = None


class VoteCreate(BaseModel):
    lunch_place_id: int
    is_joining: bool = True
    note: Optional[str] = None


class HostCreate(BaseModel):
    selected_place_id: int


class PaymentCreate(BaseModel):
    payment_url: str


class PickupCreate(BaseModel):
    pickup_location: str
    pickup_time: str


class OrderCreate(BaseModel):
    item_description: str
    amount: Optional[float] = None


class RetroactiveCreate(BaseModel):
    date: date
    place_id: Optional[int] = None
    place_name: Optional[str] = None
    total_amount: float
    meal_type: str = "lunch"
    gratuity: Optional[float] = None
    attendee_count: Optional[int] = None
    pickup_location: Optional[str] = None
    pickup_time: Optional[str] = None


class SessionTotalBody(BaseModel):
    total_amount: float


class SessionPaymentBody(BaseModel):
    payment_url: str


class FarewellBody(BaseModel):
    farewell_payment_url: str


class PollOptionIn(BaseModel):
    date: date
    time_label: Optional[str] = None


class PollCreate(BaseModel):
    title: str
    poll_type: str = "dinner"
    description: Optional[str] = None
    options: List[PollOptionIn]


class PollResponseItem(BaseModel):
    option_id: int
    status: str


class PollRespondBody(BaseModel):
    responses: List[PollResponseItem]


class PollConfirmBody(BaseModel):
    option_id: int


class PollFarewellBody(BaseModel):
    farewell_payment_url: str
