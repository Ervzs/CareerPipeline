def test_swagger_ui_is_served(api_client):
    response = api_client.get("/api/docs/")
    assert response.status_code == 200


def test_schema_documents_the_core_endpoints(api_client):
    response = api_client.get("/api/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    for path in (
        "/api/auth/login/",
        "/api/auth/refresh/",
        "/api/stages/reorder/",
        "/api/applications/{id}/move/",
    ):
        assert path in paths
