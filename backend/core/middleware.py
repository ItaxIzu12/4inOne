"""API-Antworten mit persönlichen Daten nie zwischenspeichern (Browser, Back/Forward-Cache, geteilte Proxys).

Bisher setzten das nur Reisen und Organisation selbst; Finanzen, Haushalt, Startseite, Kontakte und Einladungen
nicht. Ein Endpunkt, der bewusst cachebar sein soll, setzt seinen eigenen Cache-Control-Header — der bleibt stehen.
"""


class ApiNoStoreMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/') and not response.has_header('Cache-Control'):
            response['Cache-Control'] = 'no-store'
        return response
