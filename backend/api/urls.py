from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ChoiceListViewSet, ChoiceViewSet

# DRF Router for ViewSets
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'choice-lists', ChoiceListViewSet, basename='choice-list')
router.register(r'choices', ChoiceViewSet, basename='choice')

urlpatterns = [
    path('', include(router.urls)),
]
