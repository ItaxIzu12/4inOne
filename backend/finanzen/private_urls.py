from django.urls import path
from rest_framework.routers import SimpleRouter
from .private_api import PrivateTransactionViewSet, PrivateCategoryViewSet, MonthlyBudgetViewSet, SavingsGoalViewSet, PrivateSummaryView, SetupCategoriesView
router = SimpleRouter()
router.register('transactions', PrivateTransactionViewSet, basename='private-transaction')
router.register('categories', PrivateCategoryViewSet, basename='private-category')
router.register('budgets', MonthlyBudgetViewSet, basename='private-budget')
router.register('goals', SavingsGoalViewSet, basename='savings-goal')
urlpatterns = [path('summary/',PrivateSummaryView.as_view()), path('categories/setup/',SetupCategoriesView.as_view()), *router.urls]
