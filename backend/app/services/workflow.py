"""Single transition authority: all status changes and event inserts stay in one transaction."""
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from ..errors import ApiError
from ..models import ApplicationEvent, LoanApplication
from ..schemas import Status

ALLOWED: dict[str, set[str]] = {
    Status.DRAFT: {Status.SUBMITTED},
    Status.SUBMITTED: {Status.VERIFYING},
    Status.VERIFYING: {Status.UNDER_REVIEW, Status.NEEDS_INFO},
    Status.NEEDS_INFO: {Status.SUBMITTED},
    Status.UNDER_REVIEW: {Status.NEEDS_INFO, Status.OFFERED, Status.REJECTED},
    Status.OFFERED: {Status.ACCEPTED, Status.DECLINED},
    Status.ACCEPTED: {Status.COMPLETED},
    Status.REJECTED: set(),
    Status.DECLINED: set(),
    Status.COMPLETED: set(),
}


def append_event(db: Session, app: LoanApplication, from_status: str | None, to_status: str, reason: str, actor_id: UUID | None):
    db.add(ApplicationEvent(application_id=app.id, from_status=from_status, to_status=to_status, actor_id=actor_id, reason=reason))


def transition(db: Session, app: LoanApplication, status: Status, *, actor_id: UUID | None = None, reason: str):
    current = app.status
    if status not in ALLOWED.get(current, set()):
        raise ApiError('INVALID_TRANSITION', f'Переход {current} → {status} недопустим', 409)
    app.status = status
    app.revision = (app.revision or 1) + 1
    app.updated_at = datetime.now(timezone.utc)
    append_event(db, app, current, status, reason, actor_id)


def next_action(status: str) -> str:
    return {
        'DRAFT': 'Заполните заявку и нажмите «Отправить»',
        'SUBMITTED': 'Ожидайте начала проверок',
        'VERIFYING': 'Ожидайте результатов автоматической проверки',
        'NEEDS_INFO': 'Предоставьте дополнительные сведения и отправьте повторно',
        'UNDER_REVIEW': 'Ожидайте решения сотрудника банка',
        'OFFERED': 'Примите или отклоните предложенные условия',
        'REJECTED': 'Банк отказал в выдаче кредита',
        'ACCEPTED': 'Завершите оформление заявки',
        'DECLINED': 'Вы отклонили предложение',
        'COMPLETED': 'Оформление завершено',
    }[status]
