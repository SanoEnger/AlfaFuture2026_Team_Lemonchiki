"""Generate a minimal importable Postman v2.1 collection for API integration."""
import json
from pathlib import Path

base = '{{baseUrl}}/api/v1'

def item(name, method, path, *, role=None, body=None, form=False, tests=None):
    req = {'method': method, 'header': [], 'url': base + path}
    if role:
        req['auth'] = {'type': 'bearer', 'bearer': [{'key': 'token', 'value': '{{%sToken}}' % role, 'type': 'string'}]}
    if body is not None:
        req['header'].append({'key': 'Content-Type', 'value': 'application/json'})
        req['body'] = {'mode': 'raw', 'raw': json.dumps(body, ensure_ascii=False)}
    if form:
        req['body'] = {'mode': 'formdata', 'formdata': [{'key': 'file', 'type': 'file', 'src': ''}]}
    result = {'name': name, 'request': req}
    if tests:
        result['event'] = [{'listen': 'test', 'script': {'type': 'text/javascript', 'exec': tests.splitlines()}}]
    return result

# After import run both login requests first, then update productId from GET /products and applicationId from Create draft.
collection = {
    'info': {'name': 'Alfa Hack 2026 / Smart Credit Backend', '_postman_id': 'f1a2b3c4-1111-4444-8888-123456789abc', 'schema': 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', 'description': 'Synthetic demo. Set productId to a UUID from products. Upload PDF file manually.'},
    'auth': {'type': 'noauth'},
    'variable': [
        {'key': 'baseUrl', 'value': 'http://127.0.0.1:8000'},
        {'key': 'clientToken', 'value': ''}, {'key': 'bankToken', 'value': ''},
        {'key': 'applicationId', 'value': ''}, {'key': 'productId', 'value': ''},
        {'key': 'documentId', 'value': ''},
    ],
    'item': [
        {'name': 'Auth', 'item': [
            item('Login Client', 'POST', '/auth/demo-login', body={'username': 'client_good', 'password': 'Demo2026!'}, tests="pm.collectionVariables.set('clientToken', pm.response.json().access_token);"),
            item('Login Bank', 'POST', '/auth/demo-login', body={'username': 'banker', 'password': 'Demo2026!'}, tests="pm.collectionVariables.set('bankToken', pm.response.json().access_token);"),
        ]},
        {'name': 'Client', 'item': [
            item('Products', 'GET', '/products', role='client', tests="pm.collectionVariables.set('productId', pm.response.json()[0].id);"),
            item('My Company', 'GET', '/business/me', role='client'),
            item('News', 'GET', '/news', role='client'),
            item('List My Applications', 'GET', '/applications', role='client'),
            item('Create Draft', 'POST', '/applications', role='client', body={'product_id': '{{productId}}', 'amount': '400000.00', 'term_months': 12, 'purpose': 'WORKING_CAPITAL'}, tests="pm.collectionVariables.set('applicationId', pm.response.json().id);"),
            item('Patch Draft', 'PATCH', '/applications/{{applicationId}}', role='client', body={'amount': '420000.00'}),
            item('Get Application', 'GET', '/applications/{{applicationId}}', role='client'),
            item('Submit', 'POST', '/applications/{{applicationId}}/submit', role='client'),
            item('Upload PDF', 'POST', '/applications/{{applicationId}}/documents', role='client', form=True, tests="pm.collectionVariables.set('documentId', pm.response.json().id);"),
            item('Resubmit', 'POST', '/applications/{{applicationId}}/resubmit', role='client', body={'response_message': 'Документы и уточнения приложены'}),
            item('History', 'GET', '/applications/{{applicationId}}/history', role='client'),
            item('Accept Offer', 'POST', '/applications/{{applicationId}}/accept', role='client'),
            item('Decline Offer', 'POST', '/applications/{{applicationId}}/decline', role='client'),
        ]},
        {'name': 'Bank', 'item': [
            item('Queue', 'GET', '/bank/applications?status=UNDER_REVIEW', role='bank'),
            item('Application Detail', 'GET', '/bank/applications/{{applicationId}}', role='bank'),
            item('Request Info', 'POST', '/bank/applications/{{applicationId}}/request-info', role='bank', body={'message': 'Приложите финансовую отчётность'}),
            item('Offer', 'POST', '/bank/applications/{{applicationId}}/decision', role='bank', body={'type': 'OFFERED', 'offered_amount': '350000.00', 'offered_term_months': 12, 'offered_annual_rate': '17.50', 'reason': 'Демо-предложение банка'}),
            item('Reject', 'POST', '/bank/applications/{{applicationId}}/decision', role='bank', body={'type': 'REJECTED', 'reason': 'Высокая долговая нагрузка'}),
            item('Download PDF', 'GET', '/bank/applications/{{applicationId}}/documents/{{documentId}}', role='bank'),
        ]},
    ],
}

path = Path(__file__).resolve().parent.parent / 'smart_credit.postman_collection.json'
path.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding='utf-8')
print('Exported', path)
