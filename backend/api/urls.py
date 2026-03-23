from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ChoiceListViewSet, ChoiceViewSet,
    CSRFView, LoginView, LogoutView, MeView, ChangePasswordView,
)

# DRF Router for ViewSets
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'choice-lists', ChoiceListViewSet, basename='choice-list')
router.register(r'choices', ChoiceViewSet, basename='choice')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/csrf/', CSRFView.as_view(), name='auth-csrf'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
]
