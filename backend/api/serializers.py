from rest_framework import serializers
from .models import Project, ChoiceList, Choice


class ChoiceSerializer(serializers.ModelSerializer):
    """Serializer for individual choice items"""
    
    class Meta:
        model = Choice
        fields = ['id', 'choice_list', 'value', 'label', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChoiceListDetailSerializer(serializers.ModelSerializer):
    """Serializer for choice list with nested choices"""
    choices = ChoiceSerializer(many=True, read_only=True)
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = ChoiceList
        fields = ['id', 'project', 'project_slug', 'project_name', 'slug', 'name', 'description', 'created_at', 'updated_at', 'choices']
        read_only_fields = ['id', 'project_slug', 'project_name', 'created_at', 'updated_at']


class ChoiceListSerializer(serializers.ModelSerializer):
    """Serializer for choice list (without nested choices)"""
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = ChoiceList
        fields = ['id', 'project', 'project_slug', 'project_name', 'slug', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'project_slug', 'project_name', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for project"""
    choice_lists = ChoiceListSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = ['id', 'slug', 'name', 'description', 'owner', 'created_at', 'updated_at', 'choice_lists']
        read_only_fields = ['id', 'created_at', 'updated_at']
