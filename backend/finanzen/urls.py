from django.urls import path
from rest_framework.routers import DefaultRouter

from finanzen.views import (
    AnalysenView,
    CategoryViewSet,
    OverviewView,
    RecurringDeductionViewSet,
    SetHouseholdBufferView,
    SetOwnIncomeView,
    TransactionViewSet,
)

router = DefaultRouter()
router.register('transaktionen', TransactionViewSet, basename='transaction')
router.register('kategorien', CategoryViewSet, basename='category')
router.register('abzuege', RecurringDeductionViewSet, basename='recurring-deduction')

urlpatterns = [
    path('uebersicht/', OverviewView.as_view(), name='finanzen-overview'),
    path('analysen/', AnalysenView.as_view(), name='finanzen-analysen'),
    path('analysen/einkommen/', SetOwnIncomeView.as_view(), name='finanzen-analysen-einkommen'),
    path('analysen/puffer/', SetHouseholdBufferView.as_view(), name='finanzen-analysen-puffer'),
    *router.urls,
]
