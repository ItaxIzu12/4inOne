"""Test-Doppel des Personal AI Core (docs/AI_INTEGRATION.md § 9): ein echter kleiner HTTP-Server auf 127.0.0.1.

Für Tests (Unit, Integration, später Fullstack). Zeichnet jede Anfrage auf und antwortet je nach `mode`:
ok · refused · error · http_500 · http_401 · slow · invalid_json · huge · wrong_request_id · bad_envelope · bad_result.
`GET /v1/capabilities` liefert `offered` (Standard: alle im Code registrierten Fähigkeiten).
Nie im Betrieb verwenden.
"""

from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeAiCore:
    def __init__(self, mode: str = 'ok', result: dict | None = None, delay: float = 0.0,
                 offered: list[dict] | None = None, capabilities_status: int = 200) -> None:
        self.mode = mode
        # Antwort auf GET /v1/capabilities; None = alle im Code registrierten Fähigkeiten in ihrer Version
        self.offered = offered
        self.capabilities_status = capabilities_status
        self.result = result if result is not None else {}
        self.delay = delay
        self.requests: list[dict] = []
        self._server: ThreadingHTTPServer | None = None

    @property
    def url(self) -> str:
        host, port = self._server.server_address[:2]
        return f'http://{host}:{port}'

    def __enter__(self) -> 'FakeAiCore':
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # Testausgabe ruhig halten
                pass

            def _send(self, status: int, body: bytes) -> None:
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):  # noqa: N802
                fake.requests.append({'method': 'GET', 'path': self.path, 'headers': dict(self.headers)})
                if self.path == '/v1/capabilities':
                    from integrations.ai import capabilities

                    offered = fake.offered if fake.offered is not None else [
                        {'name': c.name, 'version': c.version} for c in capabilities.CAPABILITIES.values()
                    ]
                    return self._send(fake.capabilities_status, json.dumps({'capabilities': offered}).encode())
                self._send(200, b'{"status": "ok"}')

            def do_POST(self):  # noqa: N802
                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length) or b'{}')
                fake.requests.append({'method': 'POST', 'path': self.path, 'headers': dict(self.headers), 'body': data})
                if fake.delay or fake.mode == 'slow':
                    time.sleep(fake.delay or 2.0)
                mode = fake.mode
                if mode == 'http_500':
                    return self._send(500, b'{"status": "error"}')
                if mode == 'http_401':
                    return self._send(401, b'{}')
                if mode == 'invalid_json':
                    return self._send(200, b'not json')
                if mode == 'huge':
                    return self._send(200, b'{"x": "' + b'a' * 400_000 + b'"}')
                envelope = {
                    'schema_version': 1,
                    'request_id': data.get('request_id', ''),
                    'status': 'ok',
                    'result': fake.result,
                    'evidence': [{'field': 'category_id', 'source': 'Verwendungszweck', 'quote': 'REWE'}],
                    'confidence': {'category_id': 0.8},
                    'model': 'fake',
                    'duration_ms': 5,
                }
                if mode == 'refused':
                    envelope['status'] = 'refused'
                elif mode == 'error':
                    envelope.update(status='error', error={'code': 'model_down', 'message': 'kurz weg'})
                elif mode == 'wrong_request_id':
                    envelope['request_id'] = 'fremd'
                elif mode == 'bad_envelope':
                    envelope.pop('status')
                elif mode == 'bad_result':
                    envelope['result'] = {'unerwartet': True}
                self._send(200, json.dumps(envelope).encode())

        self._server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self._server.daemon_threads = True
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *exc) -> None:
        self._server.shutdown()
        self._server.server_close()
