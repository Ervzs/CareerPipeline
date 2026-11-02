from django.contrib import admin

from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["company", "job_title", "status", "user", "created_at"]
    list_filter = ["status"]
    search_fields = ["company", "job_title"]
