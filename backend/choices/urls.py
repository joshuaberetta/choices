"""
URL configuration for choices project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from api.views import KoboCSVExportView, KoboAddChoiceView, KoboRemoveChoiceView, KoboDeleteChoiceView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # Management API (DRF ViewSets)

    # KoboToolbox integration endpoints at root level (no /api/ prefix)
    path('<str:username>/<str:project_id>/<str:choice_list_name>.csv', KoboCSVExportView.as_view(), name='kobo-csv-export'),
    path('<str:username>/<str:project_id>/<str:choice_list_name>/add', KoboAddChoiceView.as_view(), name='kobo-add-choice'),
    path('<str:username>/<str:project_id>/<str:choice_list_name>/remove', KoboRemoveChoiceView.as_view(), name='kobo-remove-choice'),
    path('<str:username>/<str:project_id>/<str:choice_list_name>/delete', KoboDeleteChoiceView.as_view(), name='kobo-delete-choice'),
]
