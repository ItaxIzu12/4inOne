from django.urls import path

from .views import ContactView, PageViewView

urlpatterns = [
    path('contact/', ContactView.as_view(), name='website-contact'),
    path('pageview/', PageViewView.as_view(), name='website-pageview'),
]
