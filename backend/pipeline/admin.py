from django.contrib import admin

from .models import ApplicationActivity, Company, JobApplication, PipelineStage


@admin.register(PipelineStage)
class PipelineStageAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "order")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "website")


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("job_title", "company", "stage", "position", "user", "date_applied")
    list_select_related = ("company", "stage", "user")


@admin.register(ApplicationActivity)
class ApplicationActivityAdmin(admin.ModelAdmin):
    list_display = ("application", "kind", "occurred_at", "user")
    list_select_related = ("application", "user")
