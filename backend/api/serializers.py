from rest_framework import serializers
from django.db.models import Count
from .models import Project, ChoiceList, Choice, ChoiceListColumn, ChoiceExtraValue, ProjectShare


class ChoiceListColumnSerializer(serializers.ModelSerializer):
    """Serializer for a configurable extra column on a choice list"""

    class Meta:
        model = ChoiceListColumn
        fields = ['id', 'name', 'order']
        read_only_fields = ['id']


class ChoiceExtraValueSerializer(serializers.ModelSerializer):
    """Serializer for an extra column value on a choice"""
    column_name = serializers.CharField(source='column.name', read_only=True)

    class Meta:
        model = ChoiceExtraValue
        fields = ['id', 'column', 'column_name', 'value']
        read_only_fields = ['id', 'column_name']


class ChoiceSerializer(serializers.ModelSerializer):
    """Serializer for individual choice items"""
    extra_values = ChoiceExtraValueSerializer(many=True, read_only=True)

    class Meta:
        model = Choice
        fields = ['id', 'choice_list', 'value', 'label', 'order', 'created_at', 'extra_values']
        read_only_fields = ['id', 'created_at']


class ChoiceListDetailSerializer(serializers.ModelSerializer):
    """Serializer for choice list with nested choices and columns"""
    choices = ChoiceSerializer(many=True, read_only=True)
    columns = ChoiceListColumnSerializer(many=True, read_only=True)
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = ChoiceList
        fields = ['id', 'project', 'project_slug', 'project_name', 'slug', 'name', 'description', 'label_column_name', 'name_generation', 'name_max_length', 'require_auth', 'created_at', 'updated_at', 'columns', 'choices']
        read_only_fields = ['id', 'project_slug', 'project_name', 'created_at', 'updated_at']


class ChoiceListSerializer(serializers.ModelSerializer):
    """Serializer for choice list (without nested choices)"""
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    choices_count = serializers.SerializerMethodField()

    def get_choices_count(self, obj):
        if hasattr(obj, 'choices_count_annotation'):
            return obj.choices_count_annotation
        return obj.choices.count()

    class Meta:
        model = ChoiceList
        fields = ['id', 'project', 'project_slug', 'project_name', 'slug', 'name', 'description', 'label_column_name', 'name_generation', 'name_max_length', 'require_auth', 'created_at', 'updated_at', 'choices_count']
        read_only_fields = ['id', 'project_slug', 'project_name', 'created_at', 'updated_at', 'choices_count']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for project"""
    choice_lists = ChoiceListSerializer(many=True, read_only=True)
    role = serializers.SerializerMethodField()
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    def get_role(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.owner:
            return 'owner'
        return 'shared'

    class Meta:
        model = Project
        fields = ['id', 'slug', 'name', 'description', 'owner', 'owner_username', 'is_public', 'role', 'created_at', 'updated_at', 'choice_lists']
        read_only_fields = ['id', 'owner', 'owner_username', 'role', 'created_at', 'updated_at']


class PublicChoiceSerializer(serializers.ModelSerializer):
    """Minimal choice data for public views (non-removed choices only)"""
    class Meta:
        model = Choice
        fields = ['value', 'label', 'order']


class PublicChoiceListSerializer(serializers.ModelSerializer):
    """Choice list info with choices for public project views"""
    choices = serializers.SerializerMethodField()

    def get_choices(self, obj):
        removed_col = obj.columns.filter(name='removed').first()
        qs = obj.choices.all()
        if removed_col:
            excluded_ids = obj.choices.filter(
                extra_values__column=removed_col, extra_values__value='true'
            ).values_list('id', flat=True)
            qs = qs.exclude(id__in=excluded_ids)
        return PublicChoiceSerializer(qs.order_by('order'), many=True).data

    class Meta:
        model = ChoiceList
        fields = ['id', 'slug', 'name', 'description', 'updated_at', 'choices']


class PublicProjectSerializer(serializers.ModelSerializer):
    """Read-only serializer for public project discovery"""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    list_count = serializers.SerializerMethodField()
    choice_lists = PublicChoiceListSerializer(many=True, read_only=True)

    def get_list_count(self, obj):
        if hasattr(obj, 'list_count_annotation'):
            return obj.list_count_annotation
        return obj.choice_lists.count()

    class Meta:
        model = Project
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'list_count', 'updated_at', 'choice_lists']
