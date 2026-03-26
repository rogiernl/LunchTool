from .models import ActivityPollOption, ActivityPollResponse, LunchSession, PlaceLike, SessionOrder, SessionVote


def s_user(user):
    if not user:
        return None
    return {"id": user.id, "email": user.email, "friendly_name": user.friendly_name}


def s_place(place, db=None, user_id=None):
    if not place:
        return None

    result = {
        "id": place.id,
        "name": place.name,
        "description": place.description,
        "address": place.address,
        "google_rating": place.google_rating,
        "has_order_ahead": place.has_order_ahead,
        "category": place.category or "pick_up",
        "lat": place.lat,
        "lng": place.lng,
        "walking_minutes": place.walking_minutes,
        "added_by": s_user(place.added_by),
        "like_count": 0,
        "liked_by_me": False,
        "last_visit": None,
        "visit_count": 0,
    }
    if db is None:
        return result

    likes = db.query(PlaceLike).filter(PlaceLike.place_id == place.id).all()
    result["like_count"] = len(likes)
    result["liked_by_me"] = any(like.user_id == user_id for like in likes)
    visits = (
        db.query(LunchSession)
        .filter(
            LunchSession.selected_place_id == place.id,
            LunchSession.status.in_(["done", "pickup", "ordering", "settling"]),
        )
        .order_by(LunchSession.date.desc())
        .all()
    )
    result["last_visit"] = visits[0].date.isoformat() if visits else None
    result["visit_count"] = len(visits)
    return result


def s_vote(vote: SessionVote):
    return {
        "id": vote.id,
        "user": s_user(vote.user),
        "lunch_place": s_place(vote.lunch_place),
        "is_joining": vote.is_joining,
        "note": vote.note,
    }


def s_order(order: SessionOrder):
    return {
        "id": order.id,
        "user": s_user(order.user),
        "item_description": order.item_description,
        "amount": order.amount,
        "is_paid": order.is_paid,
    }


def s_session(session, db):
    votes = db.query(SessionVote).filter(SessionVote.session_id == session.id).all()
    orders = db.query(SessionOrder).filter(SessionOrder.session_id == session.id).all()
    selected_place = s_place(session.selected_place) if session.selected_place else None
    if not selected_place and session.place_name:
        selected_place = {"id": None, "name": session.place_name}
    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "status": session.status,
        "host": s_user(session.host),
        "selected_place": selected_place,
        "pickup_location": session.pickup_location,
        "pickup_time": session.pickup_time,
        "payment_url": session.payment_url,
        "total_amount": session.total_amount,
        "gratuity": session.gratuity,
        "attendee_count": session.attendee_count,
        "meal_type": session.meal_type or "lunch",
        "image_url": f"/api/images/{session.image_path}" if session.image_path else None,
        "farewell_payment_url": session.farewell_payment_url,
        "votes": [s_vote(vote) for vote in votes],
        "orders": [s_order(order) for order in orders],
    }


def s_poll_option(option: ActivityPollOption, responses: list[ActivityPollResponse]):
    option_responses = [response for response in responses if response.option_id == option.id]
    return {
        "id": option.id,
        "date": option.date.isoformat(),
        "time_label": option.time_label,
        "yes_count": sum(1 for response in option_responses if response.status == "yes"),
        "maybe_count": sum(1 for response in option_responses if response.status == "maybe"),
        "responses": [{"user": s_user(response.user), "status": response.status} for response in option_responses],
    }


def s_poll(poll, db, user_id=None):
    options = (
        db.query(ActivityPollOption)
        .filter(ActivityPollOption.poll_id == poll.id)
        .order_by(ActivityPollOption.date)
        .all()
    )
    responses = db.query(ActivityPollResponse).filter(ActivityPollResponse.poll_id == poll.id).all()
    my_responses = {response.option_id: response.status for response in responses if response.user_id == user_id} if user_id else {}
    confirmed_option = (
        db.query(ActivityPollOption).filter(ActivityPollOption.id == poll.confirmed_option_id).first()
        if poll.confirmed_option_id
        else None
    )
    return {
        "id": poll.id,
        "title": poll.title,
        "poll_type": poll.poll_type,
        "description": poll.description,
        "status": poll.status,
        "created_by": s_user(poll.created_by),
        "confirmed_option_id": poll.confirmed_option_id,
        "confirmed_option": {
            "id": confirmed_option.id,
            "date": confirmed_option.date.isoformat(),
            "time_label": confirmed_option.time_label,
        }
        if confirmed_option
        else None,
        "options": [s_poll_option(option, responses) for option in options],
        "my_responses": my_responses,
        "has_responded": bool(my_responses),
        "farewell_payment_url": poll.farewell_payment_url,
    }
