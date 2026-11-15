from django.urls import path

from . import views

urlpatterns = [
    path('admin/overview/', views.AdminOverviewView.as_view(), name='monitoring-admin-overview'),
    path('admin/events/', views.AdminEventsView.as_view(), name='monitoring-admin-events'),
    path('admin/errors/', views.AdminErrorsView.as_view(), name='monitoring-admin-errors'),
    path('monitoring/config/', views.MonitoringConfigView.as_view(), name='monitoring-config'),
    path('monitoring/tunnel/', views.tunnel, name='monitoring-tunnel'),
]
