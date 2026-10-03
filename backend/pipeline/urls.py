from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("stages", views.PipelineStageViewSet, basename="stage")
router.register("companies", views.CompanyViewSet, basename="company")
router.register("applications", views.JobApplicationViewSet, basename="application")

urlpatterns = router.urls
