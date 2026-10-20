from django.contrib import admin

from .models import ContactMessage, PageView


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'name', 'email', 'forwarded']
    search_fields = ['name', 'email', 'message']
    readonly_fields = ['name', 'email', 'message', 'created_at', 'forwarded']

    def has_add_permission(self, request):
        return False


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
