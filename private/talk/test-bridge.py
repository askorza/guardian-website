#!/usr/bin/env python3
"""Loopback-only Guardian -> OpenAI-compatible test gateway bridge.

Run locally on your own computer. Never deploy to Cloudflare or a public server.
No ChatGPT session cookies or external API keys are sent to the Guardian website.
This adapter is for testing software you have separately configured and are
responsible for using in accordance with its providers' terms.
"""
import hmac
import json
import os
import secrets
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = '127.0.0.1'
PORT = 8787
ORIGIN = 'https://guardian-private-vault.skorzaartur.workers.dev'
UPSTREAM = 'http://127.0.0.1:8000/v1/chat/completions'
HEALTH = 'http://127.0.0.1:8000/healthz'
PAIRING_CODE = secrets.token_urlsafe(24)
UPSTREAM_TOKEN = os.environ.get('OMNIGPT_TOKEN', 'dummy123')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Deliberately avoid logging prompts, IPs, or request paths.
        return

    def _origin_allowed(self):
        return self.headers.get('Origin', '') == ORIGIN

    def _base_headers(self, status=200, content_type='application/json; charset=utf-8'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def _reply(self, status, data):
        encoded = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(encoded)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Access-Control-Allow-Origin',ORIGIN)
        self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Private-Network','true')
        self.end_headers()
        self.wfile.write(encoded)

    def _authorized(self):
        token = self.headers.get('Authorization', '')
        return self._origin_allowed() and hmac.compare_digest(token, f'Bearer {PAIRING_CODE}')

    def do_OPTIONS(self):
        if not self._origin_allowed():
            self.send_error(403)
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age','600')
        self.send_header('Vary','Origin')
        self.end_headers()

    def do_GET(self):
        if not self._authorized():
            return self._reply(403, {'error':'Not paired with Guardian'})
        if self.path != '/status':
            return self._reply(404, {'error':'Not found'})
        try:
            with urllib.request.urlopen(HEALTH, timeout=3) as response:
                if response.status != 200:
                    raise RuntimeError('Gateway unavailable')
            return self._reply(200, {'bridge':'ready', 'gateway':'reachable', 'model':'omnigpt-browser'})
        except Exception:
            return self._reply(503, {'error':'Local test gateway is not running on port 8000'})

    def do_POST(self):
        if self.path != '/chat':
            return self._reply(404, {'error':'Not found'})
        if not self._authorized():
            return self._reply(403, {'error':'Not paired with Guardian'})
        if not self.headers.get('Content-Type','').lower().startswith('application/json'):
            return self._reply(415, {'error':'JSON required'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length < 1 or length > 22_000:
                return self._reply(413, {'error':'Request exceeds test limit'})
            body=json.loads(self.rfile.read(length))
            messages=body.get('messages')
            if not isinstance(messages,list) or not 1 <= len(messages) <= 10:
                raise ValueError('Invalid message array')
            filtered=[]
            for m in messages:
                if not isinstance(m,dict) or m.get('role') not in ('system','user','assistant') or not isinstance(m.get('content'),str) or len(m['content']) > 2800:
                    raise ValueError('Invalid message')
                filtered.append({'role':m['role'], 'content':m['content']})
            payload=json.dumps({'model':'omnigpt-browser','messages':filtered,'stream':False}).encode('utf-8')
        except (ValueError,TypeError,UnicodeError,json.JSONDecodeError):
            return self._reply(400,{'error':'Malformed test request'})
        request=urllib.request.Request(UPSTREAM,method='POST',data=payload,
             headers={'Content-Type':'application/json','Authorization':'Bearer '+UPSTREAM_TOKEN})
        try:
            with urllib.request.urlopen(request,timeout=110) as res:
                if res.status != 200:
                    raise RuntimeError('Gateway refused request')
                data=json.loads(res.read(200_000))
            answer=data.get('choices',[{}])[0].get('message',{}).get('content')
            if not isinstance(answer,str) or not answer.strip():
                return self._reply(502,{'error':'Gateway gave no text answer'})
            return self._reply(200,{'answer':answer.strip()[:9000],'source':'omnigpt-local-test'})
        except urllib.error.HTTPError as e:
            return self._reply(502,{'error':f'Local gateway error HTTP {e.code}'})
        except Exception:
            return self._reply(502,{'error':'Local gateway is unavailable or timed out'})

if __name__ == '__main__':
    print('\nGuardian local test bridge (loopback only)')
    print('Public Cloudflare app: '+ORIGIN+'/talk/')
    print('Requires separately running OmniGPT Gateway at 127.0.0.1:8000')
    print('ONE-TIME PAIRING CODE (paste into Guardian Talk, NOT into GitHub):')
    print(PAIRING_CODE)
    print('Listening on http://127.0.0.1:8787; stop with Ctrl+C.')
    ThreadingHTTPServer((HOST,PORT), Handler).serve_forever()