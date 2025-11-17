from fastapi.testclient import TestClient
from server.app import app


def test_formats_expanded_endpoint():
    client = TestClient(app)
    r = client.get('/api/formats/expanded')
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Each item should be a dict with source and targets
    for item in data:
        assert 'source' in item
        assert 'targets' in item
        for t in item['targets']:
            assert 'ext' in t
            assert 'chain_len' in t
            assert t['chain_len'] >= 1
            assert 'direct' in t
            assert 'via_chain' in t
            assert isinstance(t.get('path'), list)
            assert t['path'][0] == item['source']
            assert t['path'][-1] == t['ext']
            if t['via_chain']:
                assert t['chain_len'] == len(t['path']) - 1