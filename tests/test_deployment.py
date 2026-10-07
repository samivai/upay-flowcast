from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend import core, main


def test_configured_database_parent_is_created(tmp_path):
    path = tmp_path / 'persistent' / 'flowcast.sqlite3'
    with core.connect(path) as db:
        core.setup(db)
    assert path.is_file()


def test_frontend_fallback_keeps_api_errors(monkeypatch, tmp_path):
    monkeypatch.setattr(main, 'DIST_DIR', tmp_path)
    (tmp_path / 'index.html').write_text('<title>UPAY FLOWCAST</title>')
    response = main.frontend('agent')
    assert isinstance(response, FileResponse)
    assert Path(response.path) == tmp_path / 'index.html'
    with pytest.raises(HTTPException) as error:
        main.frontend('api/not-a-route')
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        main.frontend('missing.js')
    assert error.value.status_code == 404
