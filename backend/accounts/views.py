from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .cookies import clear_refresh_cookie, get_refresh_cookie, set_refresh_cookie
from .serializers import (
    AccessTokenSerializer,
    ExtensionLoginSerializer,
    ExtensionTokenSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class LoginView(TokenObtainPairView):
    """Returns the access token in the body and sets the refresh token as an httpOnly cookie."""

    @extend_schema(responses=AccessTokenSerializer)
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class RefreshView(APIView):
    """Reads the refresh cookie, rotates it, and returns a fresh access token."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticate_header(self, request):
        # With no authenticator classes DRF would downgrade 401 to 403; advertise Bearer
        # so failures are reported as 401 (the frontend treats 401 as "log in again").
        return "Bearer"

    @extend_schema(request=None, responses=AccessTokenSerializer)
    def post(self, request):
        token = get_refresh_cookie(request)
        if not token:
            raise AuthenticationFailed("No refresh token cookie.", code="no_refresh_cookie")
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise AuthenticationFailed(str(exc), code="token_not_valid") from exc
        data = dict(serializer.validated_data)
        response = Response({"access": data["access"]})
        if "refresh" in data:  # rotation is enabled: replace the cookie
            set_refresh_cookie(response, data["refresh"])
        return response


class LogoutView(APIView):
    """Blacklists the refresh token (if any) and clears the cookie. Always succeeds."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        token = get_refresh_cookie(request)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # already expired or blacklisted: nothing left to revoke
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ExtensionTokenView(APIView):
    """POST: email + password -> the user's browser-extension key. DELETE: revoke it."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "POST" else [IsAuthenticated()]

    @extend_schema(request=ExtensionLoginSerializer, responses=ExtensionTokenSerializer)
    def post(self, request):
        serializer = ExtensionLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            raise AuthenticationFailed(
                "No account found with this email and password.", code="invalid_credentials"
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})

    @extend_schema(request=None, responses={204: None})
    def delete(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
