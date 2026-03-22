from django.contrib import admin
from .models import Project, ChoiceList, Choice


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_at')
    search_fields = ('name', 'slug')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Project Info', {
            'fields': ('name', 'slug', 'description', 'created_at', 'updated_at')
        }),
    )


@admin.register(ChoiceList)
class ChoiceListAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'project', 'created_at')
    search_fields = ('name', 'slug')
    list_filter = ('project',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Choice List Info', {
            'fields': ('project', 'name', 'slug', 'description', 'created_at', 'updated_at')
        }),
    )


@admin.register(Choice)
class ChoiceAdmin(admin.ModelAdmin):
    list_display = ('label', 'value', 'choice_list', 'order', 'created_at')
    search_fields = ('label', 'value')
    list_filter = ('choice_list',)
    ordering = ('choice_list', 'order', 'created_at')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Choice Info', {
            'fields': ('choice_list', 'label', 'value', 'order', 'created_at')
        }),
    )
