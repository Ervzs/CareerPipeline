from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("stages", views.PipelineStageViewSet, basename="stage")
router.register("companies", views.CompanyViewSet, basename="company")
router.register("applications", views.JobApplicationViewSet, basename="application")
router.register("activities", views.ApplicationActivityViewSet, basename="activity")

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
