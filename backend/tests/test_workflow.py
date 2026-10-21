from uuid import UUID
from sqlalchemy import select
from app.models import ApplicationEvent, CreditDecision, LoanApplication, RiskAssessment, VerificationResult
from .conftest import headers, new_app


def test_full_approval_and_history(env):
    client, Factory = env
    person, bank = headers(client, 'good'), headers(client, 'banker')
    app_id = new_app(client, person)
    send = client.post(f'/api/v1/applications/{app_id}/submit', headers=person)
    assert send.status_code == 200, send.text
    assert send.json()['current_status'] == 'UNDER_REVIEW'
    assert send.json()['checks_status'] == 'COMPLETED'
    details = client.get(f'/api/v1/bank/applications/{app_id}', headers=bank)
    assert details.status_code == 200
    assert details.json()['risk']['risk_level'] == 'LOW'
    assert len(details.json()['risk']['factors']) >= 3
    assert len(details.json()['verifications']) == 2
    decision = client.post(f'/api/v1/bank/applications/{app_id}/decision', headers=bank, json={'type': 'OFFERED', 'offered_amount': '350000.00', 'offered_term_months': 12, 'offered_annual_rate': '17.50', 'reason': 'Индивидуальное предложение'})
    assert decision.status_code == 200, decision.text
    assert decision.json()['current_status'] == 'OFFERED'
    offered = client.get(f'/api/v1/applications/{app_id}', headers=person).json()
    assert offered['requested_terms']['amount'] == '400000.00'
    assert offered['latest_offer']['amount'] == '350000.00'
    accept = client.post(f'/api/v1/applications/{app_id}/accept', headers=person)
    assert accept.status_code == 200
    assert accept.json()['current_status'] == 'COMPLETED'
    history = client.get(f'/api/v1/applications/{app_id}/history', headers=person).json()
    assert [e['to_status'] for e in history] == ['DRAFT', 'SUBMITTED', 'VERIFYING', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'COMPLETED']
    assert history[-1]['actor_id'] is None
    with Factory() as db:
        application = db.get(LoanApplication, UUID(app_id))
        assert application.financial_snapshot['application_version'] == 1
        assert db.scalar(select(CreditDecision).where(CreditDecision.application_id == application.id)) is not None


def test_need_info_and_resubmit_new_risk_version(env):
    client, Factory = env
    good, bank = headers(client, 'good'), headers(client, 'banker')
    aid = new_app(client, good)
    assert client.post(f'/api/v1/applications/{aid}/submit', headers=good).status_code == 200
    assert client.post(f'/api/v1/bank/applications/{aid}/request-info', headers=bank, json={'message': 'Приложите баланс'}).json()['current_status'] == 'NEEDS_INFO'
    document = client.post(f'/api/v1/applications/{aid}/documents', headers=good, files={'file': ('balance.pdf', b'%PDF-1.4\n%%EOF', 'application/pdf')})
    assert document.status_code == 201, document.text
    resubmit = client.post(f'/api/v1/applications/{aid}/resubmit', headers=good, json={'response_message': 'Баланс приложен', 'company_financials': {'revenue': '2300000.00', 'expenses': '700000.00', 'debt_payment': '10000.00', 'months_active': 61}})
    assert resubmit.status_code == 200, resubmit.text
    assert resubmit.json()['current_status'] == 'UNDER_REVIEW'
    detail = client.get(f'/api/v1/bank/applications/{aid}', headers=bank).json()
    assert [x['attempt_no'] for x in detail['verifications']] == [1, 1, 2, 2]
    assert detail['risk']['attempt_no'] == 2
    assert detail['information_requests'][0]['status'] == 'RESOLVED'
    assert [h['to_status'] for h in detail['events']][-4:] == ['NEEDS_INFO', 'SUBMITTED', 'VERIFYING', 'UNDER_REVIEW']
    with Factory() as db:
        app = db.get(LoanApplication, UUID(aid))
        assert app.version == 2
        assert app.financial_snapshot['revenue'] == '2300000.00'
        risks = db.scalars(select(RiskAssessment).where(RiskAssessment.application_id == app.id)).all()
        assert len(risks) == 2
        assert risks[0].input_snapshot['revenue'] != risks[1].input_snapshot['revenue']


def test_rejection_and_decline_terminal(env):
    client, _ = env
    person, banker = headers(client, 'risky'), headers(client, 'banker')
    aid = new_app(client, person)
    client.post(f'/api/v1/applications/{aid}/submit', headers=person)
    risk = client.get(f'/api/v1/bank/applications/{aid}', headers=banker).json()['risk']
    assert risk['risk_level'] == 'HIGH'
    rejected = client.post(f'/api/v1/bank/applications/{aid}/decision', headers=banker, json={'type': 'REJECTED', 'reason': 'Высокая долговая нагрузка'})
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()['current_status'] == 'REJECTED'
    assert client.post(f'/api/v1/applications/{aid}/accept', headers=person).status_code == 409

    good = headers(client, 'good')
    aid2 = new_app(client, good)
    client.post(f'/api/v1/applications/{aid2}/submit', headers=good)
    decision = client.post(f'/api/v1/bank/applications/{aid2}/decision', headers=banker, json={'type':'OFFERED', 'offered_amount':'390000', 'offered_term_months':12, 'offered_annual_rate':'18', 'reason':'Условия'})
    assert decision.status_code == 200
    assert client.post(f'/api/v1/applications/{aid2}/decline', headers=good).json()['current_status'] == 'DECLINED'
    assert client.post(f'/api/v1/applications/{aid2}/decline', headers=good).status_code == 409


def test_access_role_ownership_and_auth(env):
    client, _ = env
    good, risky, banker = headers(client, 'good'), headers(client, 'risky'), headers(client, 'banker')
    aid = new_app(client, good)
    assert client.get('/api/v1/products', headers=banker).status_code == 403
    assert client.get('/api/v1/bank/applications', headers=good).status_code == 403
    assert client.get(f'/api/v1/applications/{aid}', headers=risky).status_code == 404
    assert client.post(f'/api/v1/applications/{aid}/submit', headers=risky).status_code == 404
    assert client.get(f'/api/v1/applications/{aid}/history', headers=risky).status_code == 404
    assert client.get('/api/v1/applications', headers={'Authorization': 'Bearer broken'}).status_code == 401
    assert client.get('/api/v1/applications').status_code == 401
    assert client.post('/api/v1/auth/demo-login', json={'username':'banker', 'password':'wrong'}).status_code == 401


def test_validation_duplicate_operations_and_snapshot(env):
    client, Factory = env
    good, bank = headers(client, 'good'), headers(client, 'banker')
    aid = new_app(client, good)
    assert client.patch(f'/api/v1/applications/{aid}', headers=good, json={'amount': '-1'}).status_code == 422
    assert client.patch(f'/api/v1/applications/{aid}', headers=good, json={'amount': '100000000000'}).status_code == 422
    assert client.post(f'/api/v1/applications/{aid}/submit', headers=good).status_code == 200
    assert client.post(f'/api/v1/applications/{aid}/submit', headers=good).status_code == 409
    assert client.patch(f'/api/v1/applications/{aid}', headers=good, json={'amount': '100000'}).status_code == 409
    assert client.post(f'/api/v1/applications/{aid}/documents', headers=good, files={'file': ('file.pdf', b'%PDF-1.4\n%%EOF')}).status_code == 409
    assert client.post(f'/api/v1/applications/{aid}/resubmit', headers=good, json={}).status_code == 409
    invalid = client.post(f'/api/v1/bank/applications/{aid}/decision', headers=bank, json={'type':'OFFERED','offered_amount':'999999999','offered_term_months':12,'offered_annual_rate':'12','reason':'wrong'})
    assert invalid.status_code == 422
    with Factory() as db:
        a = db.get(LoanApplication, UUID(aid))
        assert db.scalar(select(CreditDecision).where(CreditDecision.application_id == a.id)) is None
        assert len(db.scalars(select(VerificationResult).where(VerificationResult.application_id == a.id)).all()) == 2


def test_personalized_news(env):
    client, _ = env
    good, risky = headers(client, 'good'), headers(client, 'risky')
    a = {n['title'] for n in client.get('/api/v1/news', headers=good).json()}
    b = {n['title'] for n in client.get('/api/v1/news', headers=risky).json()}
    assert 'Food news' in a and 'Food news' not in b
    assert 'Services news' in b and 'Services news' not in a


def test_document_format_and_size(env):
    client, _ = env
    good = headers(client, 'good')
    aid = new_app(client, good)
    url = f'/api/v1/applications/{aid}/documents'
    assert client.post(url, headers=good, files={'file': ('bad.pdf', b'not pdf')}).status_code == 422
    assert client.post(url, headers=good, files={'file': ('notpdf.txt', b'%PDF-1.4')}).status_code == 422
    assert client.post(url, headers=good, files={'file': ('large.pdf', b'%PDF-' + b'0'*(5*1024*1024))}).status_code == 422


def test_automated_needs_info_registry_correction_and_documents(env):
    client, Factory = env
    good, bank = headers(client, 'good'), headers(client, 'banker')
    with Factory() as db:
        from app.models import Company
        company = db.scalar(select(Company).where(Company.inn == '7701234567'))
        company.inn = '0000000000'
        db.commit()
    aid = new_app(client, good)
    r = client.post(f'/api/v1/applications/{aid}/submit', headers=good)
    assert r.status_code == 200
    assert r.json()['current_status'] == 'NEEDS_INFO'
    detail = client.get(f'/api/v1/bank/applications/{aid}', headers=bank).json()
    assert detail['risk'] is None
    assert len(detail['information_requests']) == 1
    res = client.post(f'/api/v1/applications/{aid}/resubmit', headers=good, json={'company_details': {'inn': '7701234567'}, 'response_message': 'Исправил реквизиты'})
    assert res.status_code == 200, res.text
    assert res.json()['current_status'] == 'UNDER_REVIEW'
    bank_detail = client.get(f'/api/v1/bank/applications/{aid}', headers=bank).json()
    assert bank_detail['risk']['attempt_no'] == 2
    assert len(bank_detail['verifications']) == 4


def test_resubmit_requires_evidence_and_bank_download_pdf(env):
    client, _ = env
    person, bank = headers(client, 'good'), headers(client, 'banker')
    aid = new_app(client, person)
    client.post(f'/api/v1/applications/{aid}/submit', headers=person)
    client.post(f'/api/v1/bank/applications/{aid}/request-info', headers=bank, json={'message': 'Загрузите баланс'})
    assert client.post(f'/api/v1/applications/{aid}/resubmit', headers=person, json={}).status_code == 422
    posted = client.post(f'/api/v1/applications/{aid}/documents', headers=person, files={'file': ('balance.pdf', b'%PDF-1.7\nrealistic demo', 'application/pdf')})
    assert posted.status_code == 201, posted.text
    doc_id = posted.json()['id']
    assert posted.json()['created_at'].endswith(('Z', '+00:00'))
    bank_card = client.get(f'/api/v1/bank/applications/{aid}', headers=bank).json()
    assert any(d['id'] == doc_id for d in bank_card['documents'])
    assert client.get(f'/api/v1/bank/applications/{aid}/documents/{doc_id}', headers=person).status_code == 403
    downloaded = client.get(f'/api/v1/bank/applications/{aid}/documents/{doc_id}', headers=bank)
    assert downloaded.status_code == 200
    assert downloaded.content.startswith(b'%PDF-1.7')
    # Empty resubmit is valid now because a PDF was attached after the bank asked.
    assert client.post(f'/api/v1/applications/{aid}/resubmit', headers=person, json={}).json()['current_status'] == 'UNDER_REVIEW'


def test_frontend_cors_preflight(env):
    client, _ = env
    response = client.options('/api/v1/applications', headers={
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
    })
    assert response.status_code == 200, response.text
    assert response.headers.get('access-control-allow-origin') == 'http://localhost:5173'
    forbidden = client.options('/api/v1/applications', headers={
        'Origin': 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
    })
    assert 'access-control-allow-origin' not in forbidden.headers
