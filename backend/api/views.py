import csv
import json
from io import StringIO
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
import shortuuid

from .models import Project, ChoiceList, Choice
from .serializers import (
    ProjectSerializer,
    ChoiceListSerializer,
    ChoiceListDetailSerializer,
    ChoiceSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for Project CRUD operations"""
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    lookup_field = 'slug'


class ChoiceListViewSet(viewsets.ModelViewSet):
    """ViewSet for ChoiceList CRUD operations"""
    queryset = ChoiceList.objects.all()
    serializer_class = ChoiceListSerializer
    
    def get_serializer_class(self):
        """Use detailed serializer for retrieve action"""
        if self.action == 'retrieve':
            return ChoiceListDetailSerializer
        return ChoiceListSerializer
    
    @action(detail=True, methods=['get', 'post'])
    def choices(self, request, pk=None):
        choice_list = self.get_object()

        if request.method == 'GET':
            serializer = ChoiceSerializer(choice_list.choices.all(), many=True)
            return Response(serializer.data)

        # POST: create a new choice
        label = request.data.get('label') or request.data.get('name')
        if not label:
            return Response({'error': 'label is required'}, status=status.HTTP_400_BAD_REQUEST)

        if choice_list.choices.filter(label=label).exists():
            return Response({'error': 'A choice with this label already exists'}, status=status.HTTP_400_BAD_REQUEST)

        value = shortuuid.ShortUUID().random(length=9)
        choice = Choice.objects.create(choice_list=choice_list, label=label, value=value)
        return Response(ChoiceSerializer(choice).data, status=status.HTTP_201_CREATED)


class ChoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for Choice CRUD operations"""
    queryset = Choice.objects.all()
    serializer_class = ChoiceSerializer


class KoboCSVExportView(APIView):
    """
    Export choices as CSV for KoboToolbox external choice list.
    Endpoint: GET /{project_id}/{choice_list_name}.csv
    """
    
    def get(self, request, project_id, choice_list_name):
        """
        Returns a CSV with name,label columns.
        Looks up project by slug and choice list by slug.
        """
        try:
            project = get_object_or_404(Project, slug=project_id)
            choice_list = get_object_or_404(
                ChoiceList,
                project=project,
                slug=choice_list_name
            )
            
            # Create CSV in memory
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header row
            writer.writerow(['name', 'label'])
            
            # Write choice rows
            for choice in choice_list.choices.all():
                writer.writerow([choice.value, choice.label])
            
            # Return CSV response
            response = HttpResponse(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{choice_list_name}.csv"'
            return response
        
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class KoboAddChoiceView(APIView):
    """
    Add a choice to a choice list via KoboToolbox API.
    Endpoint: POST /{project_id}/{choice_list_name}/add
    
    Request format: {"name": "Joshua Beretta"} (key can be any name)
    Response format: {"success": true, "choice_id": "sgdgbs324", ...}
    """
    
    def post(self, request, project_id, choice_list_name):
        """
        Add a choice. Idempotent - returns success if already exists.
        Extracts first value from JSON body regardless of key.
        """
        try:
            project = get_object_or_404(Project, slug=project_id)
            choice_list = get_object_or_404(
                ChoiceList,
                project=project,
                slug=choice_list_name
            )
            
            # Extract first value from JSON body
            data = request.data
            label = next(iter(data.values())) if data else None
            
            if not label:
                return Response(
                    {
                        'success': False,
                        'message': 'No value provided in request body'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if choice already exists (idempotent)
            existing = choice_list.choices.filter(label=label).first()
            if existing:
                return Response({
                    'success': True,
                    'message': 'Choice already exists',
                    'choice_id': existing.value,
                    'value': label
                })
            
            # Generate short ID (9 chars alphanumeric)
            value = shortuuid.ShortUUID().random(length=9)

            # Create new choice
            choice = Choice.objects.create(
                choice_list=choice_list,
                label=label,
                value=value
            )

            return Response({
                'success': True,
                'message': 'Choice added successfully',
                'choice_id': choice.value,
                'value': label
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {
                    'success': False,
                    'message': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )


class KoboRemoveChoiceView(APIView):
    """
    Remove a choice from a choice list via KoboToolbox API.
    Endpoint: POST /{project_id}/{choice_list_name}/remove
    
    Request format: {"name": "Joshua Beretta"} (key can be any name)
    Response format: {"success": true, ...}
    """
    
    def post(self, request, project_id, choice_list_name):
        """
        Remove a choice. Idempotent - returns success if not found.
        Extracts first value from JSON body regardless of key.
        """
        try:
            project = get_object_or_404(Project, slug=project_id)
            choice_list = get_object_or_404(
                ChoiceList,
                project=project,
                slug=choice_list_name
            )
            
            # Extract first value from JSON body
            data = request.data
            label = next(iter(data.values())) if data else None
            
            if not label:
                return Response(
                    {
                        'success': False,
                        'message': 'No value provided in request body'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Find and delete choice
            choice = choice_list.choices.filter(label=label).first()
            if choice:
                choice_id = choice.value
                choice.delete()
                return Response({
                    'success': True,
                    'message': 'Choice removed successfully',
                    'choice_id': choice_id,
                    'value': label
                })
            else:
                # Idempotent - return success even if not found
                return Response({
                    'success': True,
                    'message': 'Choice not found (already removed)',
                    'value': label
                })
        
        except Exception as e:
            return Response(
                {
                    'success': False,
                    'message': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

