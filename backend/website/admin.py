from django.contrib import admin

from .models import PageView


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ['day', 'path', 'device', 'count']
    list_filter = ['path', 'device', 'day']
    date_hierarchy = 'day'
    readonly_fields = ['day', 'path', 'device', 'count']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
