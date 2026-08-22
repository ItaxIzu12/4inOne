from rest_framework.routers import DefaultRouter

from finanzen.views import TransactionViewSet

router = DefaultRouter()
router.register('transaktionen', TransactionViewSet, basename='transaction')

urlpatterns = router.urls
