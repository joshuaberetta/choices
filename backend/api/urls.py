from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ChoiceListViewSet, ChoiceViewSet,
    PublicProjectViewSet,
    CSRFView, LoginView, LogoutView, MeView, ChangePasswordView,
)

# DRF Router for ViewSets
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'choice-lists', ChoiceListViewSet, basename='choice-list')
router.register(r'choices', ChoiceViewSet, basename='choice')

urlpatterns = [
    # Public project endpoints — must appear BEFORE router.urls so that
    # /api/projects/public/ takes precedence over the slug pattern.
    path('projects/public/', PublicProjectViewSet.as_view({'get': 'list'}), name='public-projects-list'),
    path('projects/public/<int:pk>/', PublicProjectViewSet.as_view({'get': 'retrieve'}), name='public-projects-detail'),
    path('', include(router.urls)),
    path('auth/csrf/', CSRFView.as_view(), name='auth-csrf'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
]
