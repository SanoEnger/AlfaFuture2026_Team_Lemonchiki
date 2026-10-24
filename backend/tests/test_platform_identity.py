from urllib.parse import parse_qs, urlparse
import uuid
import pytest
from sqlalchemy import select
from app.models import User, CreditProduct
from app.auth import hash_password
from app.api import identity


@pytest.fixture
def mailbox(monkeypatch):
    messages = []
    monkeypatch.setattr(identity, 'deliver', lambda to, subject, path: messages.append((to, path)))
    identity._buckets.clear()
    return messages


def csrf(client):
    return {'X-CSRF-Token': client.get('/api/v1/auth/csrf').json()['csrf_token']}


def command(client, path, body):
    return client.post('/api/v1' + path, headers=csrf(client), json=body)


def token(mailbox):
    return parse_qs(urlparse(mailbox[-1][1]).query)['token'][0]


def login(client, email, password='PlatformPass42'):
    reply = command(client, '/auth/login', {'email': email, 'password': password})
    assert reply.status_code == 200, reply.text
    return reply


def test_registration_cookie_company_and_credit_flow(env, mailbox, monkeypatch):
    client, factory = env
    monkeypatch.setenv('VERIFICATION_PROVIDER', 'records')
    email = 'owner@example.test'
    reply = command(client, '/auth/register', {'name': 'Предприниматель', 'email': email, 'password': 'PlatformPass42'})
    assert reply.status_code == 202
    assert 'token' not in reply.text
    assert command(client, '/auth/login', {'email': email, 'password': 'PlatformPass42'}).status_code == 403
    verification = token(mailbox)
    assert command(client, '/auth/verify-email', {'token': verification}).status_code == 200
    assert command(client, '/auth/verify-email', {'token': verification}).status_code == 422
    reply = login(client, email)
    assert 'HttpOnly' in reply.headers.get_list('set-cookie')[0]
    assert client.get('/api/v1/auth/me').json()['role'] == 'CLIENT'
    assert client.get('/api/v1/applications').json() == []
    assert client.post('/api/v1/organizations', json={}).status_code == 403
    company = {'legal_name': 'ООО Компания', 'inn': '7712345678', 'form': 'ООО', 'industry': 'TRADE', 'revenue': '2000000', 'expenses': '500000', 'debt_payment': '0', 'months_active': 48}
    reply = command(client, '/organizations', company)
    assert reply.status_code == 201, reply.text
    assert client.get('/api/v1/applications').json() == []
    assert command(client, '/organizations', company).status_code == 409
    product = client.get('/api/v1/catalog').json()[0]
    draft = command(client, '/applications', {'product_id': product['id'], 'amount': '400000', 'term_months': 12, 'purpose': product['purpose'], 'comment': 'Закупка оборудования'})
    assert draft.status_code == 201, draft.text
    data = draft.json()
    assert data['requested_terms']['comment'] == 'Закупка оборудования'
    app_id = data['id']
    assert command(client, f'/applications/{app_id}/submit', {}).json()['current_status'] == 'UNDER_REVIEW'
    assert client.get('/api/v1/admin/staff').status_code == 403
    with factory() as db:
        officer = User(username='officer', email='officer@example.test', role='BANK_OFFICER', display_name='Сотрудник', password_hash=hash_password('PlatformPass42'))
        db.add(officer)
        db.commit()
    command(client, '/auth/logout', {})
    login(client, 'officer@example.test')
    path = f'/bank/applications/{app_id}'
    bundle = client.get('/api/v1' + path).json()
    assert bundle['risk']['risk_level'] == 'HIGH'
    assert bundle['verifications'][1]['result']['credit_history'] == 'UNKNOWN'
    assert command(client, path + '/decision', {'type': 'REJECTED', 'reason': 'Не подтверждены сведения'}).status_code == 403
    version = bundle['application']['version']
    assert command(client, path + '/claim', {'expected_version': version}).status_code == 200
    assert command(client, path + '/claim', {'expected_version': version}).status_code == 409
    assert command(client, path + '/decision', {'type': 'OFFERED', 'reason': 'После рассмотрения', 'offered_amount': '350000', 'offered_term_months': 12, 'offered_annual_rate': '18', 'expected_version': version + 1}).status_code == 200
    command(client, '/auth/logout', {})
    login(client, email)
    assert command(client, f'/applications/{app_id}/accept?complete_demo=false', {}).json()['current_status'] == 'ACCEPTED'
    assert command(client, f'/applications/{app_id}/complete', {}).json()['current_status'] == 'COMPLETED'
    assert command(client, '/auth/logout', {}).status_code == 204
    assert client.get('/api/v1/auth/me').status_code == 401


def test_invitation_admin_permissions_and_revocation(env, mailbox):
    client, factory = env
    with factory() as db:
        db.add(User(username='admin', email='admin@example.test', role='BANK_ADMIN', password_hash=hash_password('PlatformPass42')))
        db.commit()
    login(client, 'admin@example.test')
    reply = command(client, '/admin/staff/invitations', {'email': 'staff@example.test'})
    assert reply.status_code == 201, reply.text
    invitation = token(mailbox)
    command(client, '/auth/logout', {})
    assert command(client, '/auth/invitations/accept', {'token': invitation, 'name': 'Сотрудник', 'password': 'PlatformPass42'}).status_code == 200
    assert command(client, '/auth/invitations/accept', {'token': invitation, 'name': 'Повтор', 'password': 'PlatformPass42'}).status_code == 422
    login(client, 'staff@example.test')
    assert client.get('/api/v1/admin/staff').status_code == 403
    staff_id = client.get('/api/v1/auth/me').json()['id']
    staff_cookie = client.cookies.get('finmarshrut_session')
    command(client, '/auth/logout', {})
    login(client, 'admin@example.test')
    assert command(client, f'/admin/staff/{staff_id}/suspend', {}).status_code == 200
    client.cookies.set('finmarshrut_session', staff_cookie)
    assert client.get('/api/v1/auth/me').status_code == 401


def test_password_reset_revokes_sessions_and_tokens(env, mailbox):
    client, factory = env
    with factory() as db:
        db.add(User(username='owner', email='owner@example.test', role='CLIENT', password_hash=hash_password('PlatformPass42')))
        db.commit()
    login(client, 'owner@example.test')
    assert command(client, '/auth/password/forgot', {'email': 'owner@example.test'}).status_code == 202
    reset = token(mailbox)
    assert command(client, '/auth/password/reset', {'token': reset, 'password': 'ChangedPassword42'}).status_code == 200
    assert client.get('/api/v1/auth/me').status_code == 401
    assert command(client, '/auth/password/reset', {'token': reset, 'password': 'AnotherPassword42'}).status_code == 422
    login(client, 'owner@example.test', 'ChangedPassword42')


def test_mail_failure_does_not_create_account(env, monkeypatch, mailbox):
    client, factory = env
    def unavailable(*args):
        from app.errors import ApiError
        raise ApiError('MAIL_UNAVAILABLE', 'Почта недоступна', 503)
    monkeypatch.setattr(identity, 'deliver', unavailable)
    assert command(client, '/auth/register', {'name': 'Имя', 'email': 'fail@example.test', 'password': 'PlatformPass42'}).status_code == 503
    with factory() as db:
        assert db.scalar(select(User).where(User.email == 'fail@example.test')) is None


@pytest.mark.parametrize('length, expected', [(9, 422), (10, 202), (24, 202), (25, 422)])
def test_registration_password_length(env, mailbox, length, expected):
    client, _ = env
    reply = command(client, '/auth/register', {'name': 'Имя', 'email': 'length@example.test', 'password': 'A1' + 'x' * (length - 2)})
    assert reply.status_code == expected, reply.text
    assert len(mailbox) == (1 if expected == 202 else 0)


def test_existing_long_password_can_login_and_be_changed(env, mailbox):
    client, factory = env
    previous = 'ExistingPassword42' + 'x' * 20
    with factory() as db:
        db.add(User(username='existing-long', email='long@example.test', role='CLIENT', password_hash=hash_password(previous)))
        db.commit()
    login(client, 'long@example.test', previous)
    reply = command(client, '/auth/password/change', {'current_password': previous, 'password': 'NewPassword42'})
    assert reply.status_code == 200, reply.text
    login(client, 'long@example.test', 'NewPassword42')
