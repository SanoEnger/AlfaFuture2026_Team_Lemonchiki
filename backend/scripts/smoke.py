"""HTTP acceptance against the running demo. Creates synthetic applications only."""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class Demo:
    def __init__(self, base):
        self.base = base.rstrip('/') + '/api/v1'

    def call(self, method, path, token=None, body=None, *, expected=200, content_type=None):
        headers = {'Authorization': 'Bearer ' + token} if token else {}
        data = None
        if body is not None:
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            headers['Content-Type'] = content_type or 'application/json'
        request = Request(self.base + path, data=data, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            payload = response.read()
            if response.status != expected:
                raise AssertionError(f'{method} {path}: expected {expected}, got {response.status}: {payload.decode(errors="replace")}')
            return json.loads(payload) if 'application/json' in response.headers.get('Content-Type', '') else payload

    def login(self, username):
        return self.call('POST', '/auth/demo-login', body={
            'username': username, 'password': 'Demo2026!',
        })['access_token']

    def create(self, token):
        products = self.call('GET', '/products', token)
        product = next(p for p in products if p['code'] == 'WORKING_CAPITAL')
        result = self.call('POST', '/applications', token, {
            'product_id': product['id'], 'amount': '400000.00', 'term_months': 12,
            'purpose': product['purpose'],
        }, expected=201)
        assert self.call('GET', '/applications/' + result['id'], token)['status'] == 'DRAFT'
        return result['id']

    def offer(self, aid, bank):
        result = self.call('POST', f'/bank/applications/{aid}/decision', bank, {
            'type': 'OFFERED', 'offered_amount': '350000.00', 'offered_term_months': 12,
            'offered_annual_rate': '17.50', 'reason': 'Синтетическое встречное предложение',
        })
        assert result['current_status'] == 'OFFERED'

    def verify(self, state):
        owner, bank = self.login('client_good'), self.login('banker')
        for aid, status in state['applications'].items():
            detail = self.call('GET', f'/bank/applications/{aid}', bank)
            assert detail['application']['status'] == status
        document = self.call('GET', state['document_path'], bank)
        assert document == b'%PDF-1.4\nSynthetic demo balance\n%%EOF'
        history = self.call('GET', f'/applications/{state["success_id"]}/history', owner)
        assert history[-1]['to_status'] == 'COMPLETED'
        print('PASS: saved applications, history and PDF are available')

    def run(self):
        owner, risky, bank = self.login('client_good'), self.login('client_risky'), self.login('banker')
        news_good = self.call('GET', '/news', owner)
        news_bad = self.call('GET', '/news', risky)
        assert {n['id'] for n in news_good} != {n['id'] for n in news_bad}
        assert all(n['body'] for n in news_good + news_bad)
        self.call('GET', '/bank/applications', owner, expected=403)

        success = self.create(owner)
        self.call('GET', f'/applications/{success}', risky, expected=404)
        self.call('PATCH', f'/applications/{success}', owner, {'amount': '-1'}, expected=422)
        assert self.call('POST', f'/applications/{success}/submit', owner)['current_status'] == 'UNDER_REVIEW'
        self.call('POST', f'/applications/{success}/submit', owner, expected=409)
        detail = self.call('GET', f'/bank/applications/{success}', bank)
        assert detail['risk']['risk_level'] == 'LOW'
        assert detail['risk']['rules_version'] == 'volosnikov-rules-v1'
        self.offer(success, bank)
        detail = self.call('GET', f'/applications/{success}', owner)
        assert detail['requested_terms']['amount'] == '400000.00'
        assert detail['latest_offer']['amount'] == '350000.00'
        assert self.call('POST', f'/applications/{success}/accept', owner)['current_status'] == 'COMPLETED'
        history = self.call('GET', f'/applications/{success}/history', owner)
        assert [e['to_status'] for e in history] == [
            'DRAFT', 'SUBMITTED', 'VERIFYING', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'COMPLETED']

        clarification = self.create(owner)
        self.call('POST', f'/applications/{clarification}/submit', owner)
        self.call('POST', f'/bank/applications/{clarification}/request-info', bank,
                  {'message': 'Приложите синтетический баланс'})
        boundary = 'alfa-smoke-boundary'
        pdf = b'%PDF-1.4\nSynthetic demo balance\n%%EOF'
        multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="balance.pdf"\r\n'
                     'Content-Type: application/pdf\r\n\r\n').encode() + pdf + f'\r\n--{boundary}--\r\n'.encode()
        document = self.call('POST', f'/applications/{clarification}/documents', owner, multipart,
                             expected=201, content_type='multipart/form-data; boundary=' + boundary)
        document_path = f'/bank/applications/{clarification}/documents/{document["id"]}'
        assert self.call('GET', document_path, bank) == pdf
        self.call('POST', f'/applications/{clarification}/resubmit', owner, {'response_message': 'Баланс приложен'})
        detail = self.call('GET', f'/bank/applications/{clarification}', bank)
        assert detail['risk']['attempt_no'] == 2
        assert len(detail['verifications']) == 4
        assert all(r['status'] == 'RESOLVED' for r in detail['information_requests'])
        self.offer(clarification, bank)
        assert self.call('POST', f'/applications/{clarification}/accept', owner)['current_status'] == 'COMPLETED'

        rejected = self.create(risky)
        self.call('POST', f'/applications/{rejected}/submit', risky)
        assert self.call('GET', f'/bank/applications/{rejected}', bank)['risk']['risk_level'] == 'HIGH'
        self.call('POST', f'/bank/applications/{rejected}/decision', bank,
                  {'type': 'REJECTED', 'reason': 'Синтетический отказ: высокая долговая нагрузка'})
        assert self.call('GET', f'/applications/{rejected}', risky)['status'] == 'REJECTED'
        assert 'высокая долговая нагрузка' in self.call('GET', f'/applications/{rejected}/history', risky)[-1]['reason']

        declined = self.create(owner)
        self.call('POST', f'/applications/{declined}/submit', owner)
        self.offer(declined, bank)
        assert self.call('POST', f'/applications/{declined}/decline', owner)['current_status'] == 'DECLINED'
        self.call('POST', f'/applications/{declined}/decline', owner, expected=409)
        state = {'applications': {success: 'COMPLETED', clarification: 'COMPLETED', rejected: 'REJECTED', declined: 'DECLINED'},
                 'document_path': document_path, 'success_id': success}
        self.verify(state)
        print('PASS: approval, PDF clarification/counteroffer, rejection, decline, access, validation and news')
        return state


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    parser.add_argument('--state', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    demo = Demo(args.base_url)
    if args.verify_only:
        if args.state is None:
            parser.error('--verify-only requires --state')
        demo.verify(json.loads(args.state.read_text(encoding='utf-8')))
    else:
        state = demo.run()
        if args.state:
            args.state.parent.mkdir(parents=True, exist_ok=True)
            args.state.write_text(json.dumps(state, indent=2), encoding='utf-8')
