from .conftest import headers, new_app


def test_me_catalog_and_client_related_data(env):
    client, _ = env
    good, risky, bank = headers(client, 'good'), headers(client, 'risky'), headers(client, 'banker')
    me = client.get('/api/v1/auth/me', headers=good)
    assert me.status_code == 200
    assert me.json()['role'] == 'CLIENT'
    assert me.json()['onboarding_complete'] is True
    assert 'password_hash' not in me.text
    assert client.get('/api/v1/auth/me').status_code == 401
    assert client.get('/api/v1/catalog', headers=bank).status_code == 200
    assert client.get('/api/v1/products', headers=bank).status_code == 403
    aid = new_app(client, good)
    assert client.get(f'/api/v1/applications/{aid}/documents', headers=good).json() == []
    assert client.get(f'/api/v1/applications/{aid}/information-requests', headers=good).json() == []
    assert client.get(f'/api/v1/applications/{aid}/documents', headers=risky).status_code == 404
    assert client.get(f'/api/v1/applications/{aid}/information-requests', headers=risky).status_code == 404
    assert client.get(f'/api/v1/applications/{aid}/documents', headers=bank).status_code == 403


def test_client_download_is_scoped_to_owner_and_application(env):
    client, _ = env
    good, risky = headers(client, 'good'), headers(client, 'risky')
    aid = new_app(client, good)
    body = b'%PDF-1.4\n%%EOF'
    upload = client.post(f'/api/v1/applications/{aid}/documents', headers=good, files={'file': ('statement.pdf', body, 'application/pdf')})
    assert upload.status_code == 201
    did = upload.json()['id']
    path = f'/api/v1/applications/{aid}/documents/{did}/download'
    assert client.get(path, headers=good).content == body
    assert client.get(path, headers=risky).status_code == 404
    other = new_app(client, good)
    assert client.get(f'/api/v1/applications/{other}/documents/{did}/download', headers=good).status_code == 404


def test_company_edit_preserves_submitted_snapshot(env):
    client, _ = env
    good = headers(client, 'good')
    aid = new_app(client, good)
    client.post(f'/api/v1/applications/{aid}/submit', headers=good)
    original = client.get(f'/api/v1/applications/{aid}', headers=good).json()['company']
    response = client.patch('/api/v1/business/me', headers=good, json={'details': {'legal_name': 'Новое имя'}, 'financials': {'revenue': '9000000', 'expenses': '100', 'debt_payment': '0', 'months_active': 70}})
    assert response.status_code == 200, response.text
    assert client.get('/api/v1/business/me', headers=good).json()['revenue'] == '9000000.00'
    snapshot = client.get(f'/api/v1/applications/{aid}', headers=good).json()['company']
    assert snapshot['revenue'] == original['revenue']
    assert snapshot['legal_name'] == original['legal_name']


def test_explicit_completion_and_legacy_compatibility(env):
    client, _ = env
    good, bank = headers(client, 'good'), headers(client, 'banker')
    aid = new_app(client, good)
    client.post(f'/api/v1/applications/{aid}/submit', headers=good)
    assert client.post(f'/api/v1/applications/{aid}/complete', headers=good).status_code == 409
    offer = client.post(f'/api/v1/bank/applications/{aid}/decision', headers=bank, json={'type':'OFFERED','offered_amount':'350000','offered_term_months':12,'offered_annual_rate':'17.5','reason':'Условия'})
    assert offer.status_code == 200
    accept = client.post(f'/api/v1/applications/{aid}/accept?complete_demo=false', headers=good)
    assert accept.json()['current_status'] == 'ACCEPTED'
    assert client.post(f'/api/v1/applications/{aid}/accept', headers=good).status_code == 409
    assert client.post(f'/api/v1/applications/{aid}/complete', headers=good).json()['current_status'] == 'COMPLETED'
    assert client.post(f'/api/v1/applications/{aid}/complete', headers=good).status_code == 409
