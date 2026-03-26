from rest_framework import serializers
from django.db.models import Count
from .models import Project, ChoiceList, Choice, ChoiceListColumn, ChoiceExtraValue, ProjectShare, Collection, CollectionProject


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
    collection_memberships = serializers.SerializerMethodField()

    def get_role(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.owner:
            return 'owner'
        return 'shared'

    def get_collection_memberships(self, obj):
        try:
            cp = obj.collection_membership
            return [{'id': cp.collection.id, 'name': cp.collection.name, 'slug': cp.collection.slug}]
        except Exception:
            return []

    class Meta:
        model = Project
        fields = ['id', 'slug', 'name', 'description', 'owner', 'owner_username', 'is_public', 'role', 'created_at', 'updated_at', 'choice_lists', 'collection_memberships']
        read_only_fields = ['id', 'owner', 'owner_username', 'role', 'created_at', 'updated_at', 'collection_memberships']


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


class PublicProjectListSerializer(serializers.ModelSerializer):
    """Lightweight project summary for public discovery list (no choices)"""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    list_count = serializers.SerializerMethodField()

    def get_list_count(self, obj):
        if hasattr(obj, 'list_count_annotation'):
            return obj.list_count_annotation
        return obj.choice_lists.count()

    class Meta:
        model = Project
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'list_count', 'updated_at']


class PublicProjectSerializer(serializers.ModelSerializer):
    """Read-only serializer for public project detail (includes choice lists with choices)"""
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


# ---------------------------------------------------------------------------
# Collection serializers
# ---------------------------------------------------------------------------

class CollectionProjectSummarySerializer(serializers.ModelSerializer):
    """Minimal project info shown inside a collection"""
    id = serializers.IntegerField(source='project.id', read_only=True)
    slug = serializers.CharField(source='project.slug', read_only=True)
    name = serializers.CharField(source='project.name', read_only=True)
    description = serializers.CharField(source='project.description', read_only=True)
    owner_username = serializers.CharField(source='project.owner.username', read_only=True)
    updated_at = serializers.DateTimeField(source='project.updated_at', read_only=True)
    list_count = serializers.SerializerMethodField()
    order = serializers.IntegerField(read_only=True)

    def get_list_count(self, obj):
        return obj.project.choice_lists.count()

    class Meta:
        model = CollectionProject
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'updated_at', 'list_count', 'order']


class CollectionSerializer(serializers.ModelSerializer):
    """Collection with member project list"""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    role = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()
    projects = CollectionProjectSummarySerializer(source='collection_projects', many=True, read_only=True)

    def get_role(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.owner:
            return 'owner'
        return 'shared'

    def get_project_count(self, obj):
        if hasattr(obj, 'project_count_annotation'):
            return obj.project_count_annotation
        return obj.collection_projects.count()

    class Meta:
        model = Collection
        fields = ['id', 'slug', 'name', 'description', 'owner', 'owner_username', 'is_public', 'role', 'project_count', 'created_at', 'updated_at', 'projects']
        read_only_fields = ['id', 'owner', 'owner_username', 'role', 'project_count', 'created_at', 'updated_at']


class PublicCollectionProjectSerializer(serializers.ModelSerializer):
    """Project entry shown in a public collection — lists included"""
    id = serializers.IntegerField(source='project.id', read_only=True)
    slug = serializers.CharField(source='project.slug', read_only=True)
    name = serializers.CharField(source='project.name', read_only=True)
    description = serializers.CharField(source='project.description', read_only=True)
    owner_username = serializers.CharField(source='project.owner.username', read_only=True)
    updated_at = serializers.DateTimeField(source='project.updated_at', read_only=True)
    list_count = serializers.SerializerMethodField()
    choice_lists = serializers.SerializerMethodField()

    def get_list_count(self, obj):
        return obj.project.choice_lists.count()

    def get_choice_lists(self, obj):
        return PublicChoiceListSerializer(
            obj.project.choice_lists.all(), many=True
        ).data

    class Meta:
        model = CollectionProject
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'updated_at', 'list_count', 'choice_lists']


class PublicCollectionListSerializer(serializers.ModelSerializer):
    """Lightweight collection summary for the public discovery list (no choices)"""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    project_count = serializers.SerializerMethodField()

    def get_project_count(self, obj):
        if hasattr(obj, 'project_count_annotation'):
            return obj.project_count_annotation
        return obj.collection_projects.count()

    class Meta:
        model = Collection
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'is_public', 'project_count', 'updated_at']


class PublicCollectionSerializer(serializers.ModelSerializer):
    """Read-only collection metadata for the public detail view (projects loaded separately)"""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    project_count = serializers.SerializerMethodField()

    def get_project_count(self, obj):
        if hasattr(obj, 'project_count_annotation'):
            return obj.project_count_annotation
        return obj.collection_projects.count()

    class Meta:
        model = Collection
        fields = ['id', 'slug', 'name', 'description', 'owner_username', 'is_public', 'project_count', 'updated_at']
