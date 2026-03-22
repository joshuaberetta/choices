from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet,
    ChoiceListViewSet,
    ChoiceViewSet,
    KoboCSVExportView,
    KoboAddChoiceView,
    KoboRemoveChoiceView,
)

# DRF Router for ViewSets
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'choice-lists', ChoiceListViewSet, basename='choice-list')
router.register(r'choices', ChoiceViewSet, basename='choice')

urlpatterns = [
    # DRF ViewSet routes
    path('', include(router.urls)),
    
    # KoboToolbox integration endpoints
    # CSV export: GET /{project_id}/{choice_list_name}.csv
    path('<str:project_id>/<str:choice_list_name>.csv', KoboCSVExportView.as_view(), name='kobo-csv-export'),
    
    # Add choice: POST /{project_id}/{choice_list_name}/add
    path('<str:project_id>/<str:choice_list_name>/add', KoboAddChoiceView.as_view(), name='kobo-add-choice'),
    
    # Remove choice: POST /{project_id}/{choice_list_name}/remove
    path('<str:project_id>/<str:choice_list_name>/remove', KoboRemoveChoiceView.as_view(), name='kobo-remove-choice'),
]
