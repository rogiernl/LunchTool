from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    friendly_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LunchPlace(Base):
    __tablename__ = "lunch_places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    address = Column(String, nullable=True)
    google_rating = Column(Float, nullable=True)
    has_order_ahead = Column(Boolean, default=False)
    category = Column(String, nullable=True, default="dine_in")
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    walking_minutes = Column(Integer, nullable=True)
    added_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    added_by = relationship("User")


class LunchSession(Base):
    __tablename__ = "lunch_sessions"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    status = Column(String, default="voting")
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    selected_place_id = Column(Integer, ForeignKey("lunch_places.id"), nullable=True)
    vote_deadline = Column(DateTime, nullable=True)
    total_amount = Column(Float, nullable=True)
    gratuity = Column(Float, nullable=True)
    attendee_count = Column(Integer, nullable=True)
    payment_url = Column(String, nullable=True)
    pickup_location = Column(String, nullable=True)
    pickup_time = Column(String, nullable=True)
    meal_type = Column(String, default="lunch")
    image_path = Column(String, nullable=True)
    place_name = Column(String, nullable=True)
    farewell_payment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    host = relationship("User", foreign_keys=[host_id])
    selected_place = relationship("LunchPlace", foreign_keys=[selected_place_id])


class SessionVote(Base):
    __tablename__ = "session_votes"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("lunch_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    lunch_place_id = Column(Integer, ForeignKey("lunch_places.id"))
    is_joining = Column(Boolean, default=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    lunch_place = relationship("LunchPlace")


class SessionOrder(Base):
    __tablename__ = "session_orders"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("lunch_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    item_description = Column(String, nullable=False)
    amount = Column(Float, nullable=True)
    is_paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class PlaceLike(Base):
    __tablename__ = "place_likes"

    id = Column(Integer, primary_key=True)
    place_id = Column(Integer, ForeignKey("lunch_places.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    place = relationship("LunchPlace")
    user = relationship("User")


class ActivityPoll(Base):
    __tablename__ = "activity_polls"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    poll_type = Column(String, default="dinner")
    description = Column(String, nullable=True)
    status = Column(String, default="open")
    created_by_id = Column(Integer, ForeignKey("users.id"))
    confirmed_option_id = Column(Integer, nullable=True)
    farewell_payment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = relationship("User", foreign_keys=[created_by_id])


class ActivityPollOption(Base):
    __tablename__ = "activity_poll_options"

    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("activity_polls.id"))
    date = Column(Date, nullable=False)
    time_label = Column(String, nullable=True)


class ActivityPollResponse(Base):
    __tablename__ = "activity_poll_responses"

    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("activity_polls.id"))
    option_id = Column(Integer, ForeignKey("activity_poll_options.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
