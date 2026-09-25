from django.urls import path
from rest_framework.routers import DefaultRouter

from haushalt.views import FolderEntryViewSet, HaushaltOverviewView, ShoppingItemViewSet, ShoppingOverviewView, TaskLoadView, TaskViewSet

router = DefaultRouter()
router.register('einkauf/eintraege', ShoppingItemViewSet, basename='shopping-item')
router.register('aufgaben', TaskViewSet, basename='task')
router.register('ordner', FolderEntryViewSet, basename='folder-entry')

urlpatterns = [
    path('uebersicht/', HaushaltOverviewView.as_view(), name='haushalt-uebersicht'),
    path('einkauf/', ShoppingOverviewView.as_view(), name='haushalt-einkauf'),
    # Vor den Router-URLs, sonst hält der Router "verteilung" für eine ID.
    path('aufgaben/verteilung/', TaskLoadView.as_view(), name='haushalt-aufgaben-verteilung'),
    *router.urls,
]
