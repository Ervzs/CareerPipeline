from django.http import JsonResponse


def health(request):
    """Liveness probe for the hosting platform. It must not touch the database, so that
    frequent checks don't keep a serverless database awake."""
    return JsonResponse({"status": "ok"})
