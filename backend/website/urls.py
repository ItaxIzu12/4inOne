from django.urls import path

from .views import PageViewView

urlpatterns = [
    path('pageview/', PageViewView.as_view(), name='website-pageview'),
]
