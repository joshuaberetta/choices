from django.contrib import admin
from .models import Project, ChoiceList, Choice, ProjectShare, Collection, CollectionProject, CollectionShare


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'owner', 'is_public', 'created_at')
    search_fields = ('name', 'slug')
    list_filter = ('owner', 'is_public')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Project Info', {
            'fields': ('name', 'slug', 'description', 'owner', 'is_public', 'created_at', 'updated_at')
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


@admin.register(ProjectShare)
class ProjectShareAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'created_at')
    search_fields = ('project__name', 'user__username')
    list_filter = ('project',)
    readonly_fields = ('created_at',)


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'owner', 'is_public', 'created_at')
    search_fields = ('name', 'slug')
    list_filter = ('owner', 'is_public')
    readonly_fields = ('created_at', 'updated_at')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(CollectionProject)
class CollectionProjectAdmin(admin.ModelAdmin):
    list_display = ('collection', 'project', 'order')
    list_filter = ('collection',)
    ordering = ('collection', 'order')


@admin.register(CollectionShare)
class CollectionShareAdmin(admin.ModelAdmin):
    list_display = ('collection', 'user', 'created_at')
    search_fields = ('collection__name', 'user__username')
    list_filter = ('collection',)
    readonly_fields = ('created_at',)
