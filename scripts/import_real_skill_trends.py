import json
import urllib.parse
import urllib.request

API='http://localhost:8000'
EMAIL='demo@example.com'
PASSWORD='Demo@12345'
TAGS=['python','fastapi','reactjs','machine-learning','postgresql']

def post(url, payload, token=None):
    data=json.dumps(payload).encode(); req=urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'},method='POST')
    if token: req.add_header('Authorization',f'Bearer {token}')
    with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read())

def main():
    token=post(f'{API}/api/auth/login',{'email':EMAIL,'password':PASSWORD})['access_token']
    query=urllib.parse.quote(','.join(TAGS))
    req=urllib.request.Request(f'{API}/api/real-data/import?tags={query}',headers={'Authorization':f'Bearer {token}'},method='POST')
    with urllib.request.urlopen(req,timeout=60) as r: print(r.read().decode())

if __name__=='__main__': main()
