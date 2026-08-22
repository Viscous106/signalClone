"""The single WebSocket endpoint. Event contract: docs/ARCHITECTURE.md.

Sessions here are deliberately short-lived: one per operation, never one per
connection. A socket can stay open for hours, and holding a database session
(and therefore a pooled connection) for that long starves everything else.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import SESSION_COOKIE, decode_access_token
from app.db.models import ConversationMember, User
from app.services import conversations as conversation_service
from app.services import receipts as receipt_service

router = APIRouter()

POLICY_VIOLATION = 1008


def _peers(db: Session, user_id: int) -> set[int]:
    """Everyone who shares a conversation with me — my presence audience."""
    mine = db.query(ConversationMember.conversation_id).filter(
        ConversationMember.user_id == user_id
    )
    rows = (
        db.query(ConversationMember.user_id)
        .filter(ConversationMember.conversation_id.in_(mine), ConversationMember.user_id != user_id)
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def _touch_last_seen(db: Session, user_id: int) -> datetime:
    user = db.get(User, user_id)
    seen = datetime.now(timezone.utc)
    if user is not None:
        user.last_seen_at = seen
        db.commit()
    return seen


@router.websocket("/ws")
async def socket(websocket: WebSocket) -> None:
    session_factory = websocket.app.state.session_factory
    manager = websocket.app.state.ws_manager

    # Authenticate from the session cookie. Cookies are not port-specific, so
    # this works in dev across :3000 and :8000; a cross-domain deployment needs
    # the API on a sibling subdomain.
    token = websocket.cookies.get(SESSION_COOKIE)
    user_id = decode_access_token(token) if token else None

    if user_id is not None:
        with session_factory() as db:
            user_id = user_id if db.get(User, user_id) is not None else None

    if user_id is None:
        await websocket.close(code=POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)

    try:
        await websocket.send_json({"type": "ready", "payload": {"user_id": user_id}})

        with session_factory() as db:
            _touch_last_seen(db, user_id)
            # Anything that arrived while I was away is delivered now.
            backlog = [
                (m.id, m.conversation_id, m.sender_id)
                for m in receipt_service.deliver_backlog(db, user_id)
            ]
            audience = _peers(db, user_id)

        for message_id, conversation_id, sender_id in backlog:
            if sender_id is not None:
                await manager.send(
                    [sender_id],
                    {
                        "type": "message.status",
                        "payload": {
                            "message_id": message_id,
                            "conversation_id": conversation_id,
                            "status": receipt_service.DELIVERED,
                        },
                    },
                )

        await manager.send(
            audience, {"type": "presence", "payload": {"user_id": user_id, "online": True}}
        )

        while True:
            frame = await websocket.receive_json()
            await _handle(frame, websocket, manager, session_factory, user_id)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        if not manager.is_online(user_id):
            with session_factory() as db:
                seen = _touch_last_seen(db, user_id)
                audience = _peers(db, user_id)
            await manager.send(
                audience,
                {
                    "type": "presence",
                    "payload": {
                        "user_id": user_id,
                        "online": False,
                        "last_seen_at": seen.isoformat(),
                    },
                },
            )


async def _handle(frame: dict, websocket: WebSocket, manager, session_factory, user_id: int) -> None:
    kind = frame.get("type")
    payload = frame.get("payload") or {}

    if kind == "ping":
        await websocket.send_json({"type": "pong", "payload": {}})
        return

    if kind == "typing":
        conversation_id = payload.get("conversation_id")
        if conversation_id is None:
            return

        with session_factory() as db:
            # Membership is the authorisation here too: an outsider must not be
            # able to make typing dots appear in someone else's chat.
            if conversation_service.membership_or_none(db, conversation_id, user_id) is None:
                return
            audience = set(receipt_service.member_ids(db, conversation_id)) - {user_id}

        await manager.send(
            audience,
            {
                "type": "typing",
                "payload": {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "is_typing": bool(payload.get("is_typing")),
                },
            },
        )
