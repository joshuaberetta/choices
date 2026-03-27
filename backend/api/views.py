import csv
import json
import logging
import re
from io import StringIO

logger = logging.getLogger('api')
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import BasicAuthentication, SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from .permissions import IsProjectWriteAuthorized
from rest_framework.parsers import JSONParser, BaseParser
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
import shortuuid


class PlainTextJSONParser(BaseParser):
    """Parses text/plain bodies as JSON (for KoboToolbox compatibility)"""
    media_type = 'text/plain'

    def parse(self, stream, media_type=None, parser_context=None):
        return json.loads(stream.read().decode('utf-8'))

from django.db.models import Prefetch, Q
from .models import Project, ChoiceList, Choice, ChoiceListColumn, ChoiceExtraValue, ProjectShare, UserChoiceListConfig, UserChoiceListColumn, UserChoiceExtraValue
from .serializers import (
    ProjectSerializer,
    PublicProjectSerializer,
    ChoiceListSerializer,
    ChoiceListDetailSerializer,
    ChoiceSerializer,
    ChoiceListColumnSerializer,
    ChoiceExtraValueSerializer,
    UserChoiceListConfigSerializer,
    UserChoiceListColumnSerializer,
    UserChoiceExtraValueSerializer,
)


class CSRFView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request._request)
        return Response({'detail': 'CSRF cookie set'})


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        if not username or not password:
            return Response({'error': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
        user = authenticate(request._request, username=username, password=password)
        if user is None:
            return Response({'error': 'Invalid username or password'}, status=status.HTTP_400_BAD_REQUEST)
        login(request._request, user)
        return Response({'id': user.id, 'username': user.username})


class LogoutView(APIView):
    def post(self, request):
        logout(request._request)
        return Response({'detail': 'Logged out'})


class MeView(APIView):
    def get(self, request):
        return Response({'id': request.user.id, 'username': request.user.username})


class ChangePasswordView(APIView):
    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        if not old_password or not new_password:
            return Response({'error': 'old_password and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save()
        updated_user = authenticate(request._request, username=request.user.username, password=new_password)
        if updated_user:
            login(request._request, updated_user)
        return Response({'detail': 'Password changed successfully'})


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for Project CRUD operations"""
    serializer_class = ProjectSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        user = self.request.user
        return Project.objects.filter(
            Q(owner=user) | Q(shares__user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Only owners may change is_public
        if 'is_public' in request.data and instance.owner != request.user:
            raise PermissionDenied("Only the project owner can change is_public.")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.owner != request.user:
            raise PermissionDenied("Only the project owner can delete this project.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='shares')
    def shares(self, request, slug=None):
        project = self.get_object()
        if project.owner != request.user:
            raise PermissionDenied("Only the project owner can view shares.")
        share_list = project.shares.select_related('user').order_by('created_at')
        data = [{'username': s.user.username, 'created_at': s.created_at} for s in share_list]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='share')
    def share(self, request, slug=None):
        project = self.get_object()
        if project.owner != request.user:
            raise PermissionDenied("Only the project owner can share this project.")
        username = (request.data.get('username') or '').strip()
        if not username:
            return Response({'error': 'username is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': f'User "{username}" not found'}, status=status.HTTP_400_BAD_REQUEST)
        if user == project.owner:
            return Response({'error': 'Cannot share a project with its own owner'}, status=status.HTTP_400_BAD_REQUEST)
        _, created = ProjectShare.objects.get_or_create(project=project, user=user)
        if not created:
            return Response({'error': f'Project is already shared with "{username}"'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'username': username}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='share/(?P<username>[^/.]+)')
    def unshare(self, request, slug=None, username=None):
        project = self.get_object()
        if project.owner != request.user:
            raise PermissionDenied("Only the project owner can remove shares.")
        deleted, _ = ProjectShare.objects.filter(project=project, user__username=username).delete()
        if not deleted:
            return Response({'error': f'No share found for "{username}"'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChoiceListViewSet(viewsets.ModelViewSet):
    """ViewSet for ChoiceList CRUD operations"""
    queryset = ChoiceList.objects.all()
    serializer_class = ChoiceListSerializer

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action"""
        if self.action == 'retrieve':
            return ChoiceListDetailSerializer
        return ChoiceListSerializer

    def get_queryset(self):
        from django.db.models import Count
        user = self.request.user
        qs = ChoiceList.objects.filter(
            Q(project__owner=user) | Q(project__shares__user=user)
        ).distinct()
        # Optional slug-based filtering for list lookups
        project_slug = self.request.query_params.get('project_slug')
        slug = self.request.query_params.get('slug')
        if project_slug:
            qs = qs.filter(project__slug=project_slug)
        if slug:
            qs = qs.filter(slug=slug)
        if self.action == 'list':
            qs = qs.annotate(choices_count_annotation=Count('choices'))
        elif self.action in ('retrieve', 'export', 'import_csv'):
            qs = qs.prefetch_related(
                'columns',
                Prefetch('choices', queryset=Choice.objects.prefetch_related('extra_values')),
            )
        return qs

    def retrieve(self, request, *args, **kwargs):
        """Ensure system columns exist before returning the detail view."""
        instance = self.get_object()
        _bootstrap_system_columns(instance)
        # Re-fetch with fresh prefetch after potential column/value creation
        instance = ChoiceList.objects.prefetch_related(
            'columns',
            Prefetch('choices', queryset=Choice.objects.prefetch_related('extra_values')),
        ).get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def choices(self, request, pk=None):
        choice_list = self.get_object()

        if request.method == 'GET':
            qs = choice_list.choices.prefetch_related('extra_values').all()
            serializer = ChoiceSerializer(qs, many=True)
            return Response(serializer.data)

        # POST: create a new choice
        label = request.data.get('label') or request.data.get('name')
        if not label:
            return Response({'error': 'label is required'}, status=status.HTTP_400_BAD_REQUEST)

        if choice_list.choices.filter(label=label).exists():
            return Response({'error': 'A choice with this label already exists'}, status=status.HTTP_400_BAD_REQUEST)

        value = _generate_choice_name(choice_list, label)
        choice = Choice.objects.create(choice_list=choice_list, label=label, value=value)
        _stamp_removed_false(choice, _ensure_removed_column(choice_list))
        _stamp_protected_false(choice, _ensure_protected_column(choice_list))
        _stamp_pin_empty(choice, _ensure_pin_column(choice_list))
        return Response(ChoiceSerializer(choice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export(self, request, pk=None):
        """Export choices as CSV including any extra columns."""
        choice_list = self.get_object()
        extra_cols = list(choice_list.columns.order_by('order', 'id'))
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['name', choice_list.label_column_name] + [col.name for col in extra_cols])
        for choice in choice_list.choices.prefetch_related('extra_values').order_by('order'):
            ev_map = {ev.column_id: ev.value for ev in choice.extra_values.all()}
            writer.writerow([choice.value, choice.label] + [ev_map.get(col.id, '') for col in extra_cols])
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{choice_list.slug}.csv"'
        return response

    @action(detail=True, methods=['post'], url_path='import')
    def import_csv(self, request, pk=None):
        """Replace all choices from an uploaded CSV.

        Required columns: name (or value), label.
        Any additional columns are treated as extra columns and created/updated on the choice list.
        """
        choice_list = self.get_object()
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            text = uploaded.read().decode('utf-8-sig')
            dialect = csv.Sniffer().sniff(text[:2048], delimiters=',;\t|')
            reader = csv.DictReader(StringIO(text), dialect=dialect)
            raw_rows = list(reader)
            rows = [
                {k.strip().lower(): (v.strip() if v else '') for k, v in row.items()}
                for row in raw_rows
            ]
        except Exception as e:
            return Response({'error': f'Could not parse CSV: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({'error': 'CSV file is empty'}, status=status.HTTP_400_BAD_REQUEST)

        sample = rows[0]
        id_col = 'name' if 'name' in sample else ('value' if 'value' in sample else None)
        # Accept exact 'label' or any XLSForm-style translation column (e.g. 'label::english (en)')
        label_col = 'label' if 'label' in sample else next(
            (k for k in sample if k.startswith('label')), None
        )
        if not id_col or not label_col:
            found = list(sample.keys())
            return Response(
                {'error': f'CSV must have a "name" (or "value") column and a "label" column. Found columns: {found}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Identify extra column names (anything beyond the standard set)
        RESERVED = {id_col, 'name', 'value', label_col, 'label', 'removed', 'protected', 'pin'}
        extra_col_names = [k for k in sample.keys() if k not in RESERVED]

        # Get or create ChoiceListColumn objects for each extra column
        col_map = {}  # normalised name -> ChoiceListColumn
        for col_name in extra_col_names:
            col, _ = ChoiceListColumn.objects.get_or_create(
                choice_list=choice_list,
                name=col_name,
                defaults={'order': choice_list.columns.count()},
            )
            col_map[col_name] = col

        # Replace all choices
        choice_list.choices.all().delete()
        valid_rows = [row for row in rows if row.get(id_col) and row.get(label_col)]
        new_choices = [
            Choice(choice_list=choice_list, value=row[id_col], label=row[label_col], order=i)
            for i, row in enumerate(valid_rows)
        ]
        created = Choice.objects.bulk_create(new_choices)

        # Ensure the 'removed' column exists and stamp all new choices as removed=false
        removed_col = _ensure_removed_column(choice_list)
        # If 'removed' was also in the CSV, col_map already has it; otherwise add it
        col_map.setdefault('removed', removed_col)

        # Ensure the 'protected' column exists and stamp all new choices as protected=false
        protected_col = _ensure_protected_column(choice_list)
        col_map.setdefault('protected', protected_col)

        # Ensure the 'pin' column exists and stamp all new choices as pin=false
        pin_col = _ensure_pin_column(choice_list)
        col_map.setdefault('pin', pin_col)

        # Create extra values for each new choice
        extra_values = []
        for choice, row in zip(created, valid_rows):
            for col_name, col in col_map.items():
                if col_name in ('removed', 'protected', 'pin'):
                    v = row.get(col_name, 'false') or 'false'
                else:
                    v = row.get(col_name, '')
                # Always write the value (blank becomes empty string; system cols default to 'false')
                if col_name in ('removed', 'protected', 'pin') or v:
                    extra_values.append(ChoiceExtraValue(choice=choice, column=col, value=v))
        if extra_values:
            ChoiceExtraValue.objects.bulk_create(extra_values)

        # Re-fetch with prefetch to return accurate serialized data
        choice_list.refresh_from_db()
        choice_list_fresh = ChoiceList.objects.prefetch_related(
            'columns',
            Prefetch('choices', queryset=Choice.objects.prefetch_related('extra_values')),
        ).get(pk=choice_list.pk)
        serializer = ChoiceListDetailSerializer(choice_list_fresh)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------ columns

    @action(detail=True, methods=['post'], url_path='add_column')
    def add_column(self, request, pk=None):
        """Add a named extra column to this choice list."""
        choice_list = self.get_object()
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        if name.lower() in ('name', 'value', 'label', 'removed', 'protected', 'pin'):
            return Response({'error': f'"{name}" is a reserved column name'}, status=status.HTTP_400_BAD_REQUEST)
        if choice_list.columns.filter(name=name).exists():
            return Response({'error': 'A column with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        order = choice_list.columns.count()
        column = ChoiceListColumn.objects.create(choice_list=choice_list, name=name, order=order)
        return Response(ChoiceListColumnSerializer(column).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update_column')
    def update_column(self, request, pk=None):
        """Rename an extra column."""
        choice_list = self.get_object()
        column_id = request.data.get('column_id')
        new_name = (request.data.get('name') or '').strip()
        if not column_id or not new_name:
            return Response({'error': 'column_id and name are required'}, status=status.HTTP_400_BAD_REQUEST)
        if new_name.lower() in ('name', 'value', 'label', 'removed', 'protected', 'pin'):
            return Response({'error': f'"{new_name}" is a reserved column name'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(ChoiceListColumn, id=column_id, choice_list=choice_list)
        if column.name.lower() in ('removed', 'protected', 'pin'):
            return Response({'error': f'"{column.name}" is a system column and cannot be renamed'}, status=status.HTTP_400_BAD_REQUEST)
        if choice_list.columns.filter(name=new_name).exclude(pk=column.pk).exists():
            return Response({'error': 'A column with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        column.name = new_name
        column.save()
        return Response(ChoiceListColumnSerializer(column).data)

    @action(detail=True, methods=['delete'], url_path='remove_column')
    def remove_column(self, request, pk=None):
        """Delete an extra column (and all its values)."""
        choice_list = self.get_object()
        column_id = request.data.get('column_id')
        if not column_id:
            return Response({'error': 'column_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(ChoiceListColumn, id=column_id, choice_list=choice_list)
        if column.name.lower() in ('removed', 'protected', 'pin'):
            return Response({'error': f'"{column.name}" is a system column and cannot be deleted'}, status=status.HTTP_400_BAD_REQUEST)
        column.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        """Bulk-update order for choices in a list. Expects [{id, order}, ...]."""
        choice_list = self.get_object()
        items = request.data
        if not isinstance(items, list):
            return Response({'error': 'expected a list'}, status=status.HTTP_400_BAD_REQUEST)
        ids = [item.get('id') for item in items if isinstance(item, dict) and 'id' in item]
        choices_qs = Choice.objects.filter(id__in=ids, choice_list=choice_list)
        choices_map = {c.id: c for c in choices_qs}
        if len(choices_map) != len(ids):
            return Response({'error': 'invalid choice ids'}, status=status.HTTP_400_BAD_REQUEST)
        for item in items:
            choices_map[item['id']].order = item['order']
        Choice.objects.bulk_update(list(choices_map.values()), ['order'])
        return Response({'status': 'ok'})


class ChoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for Choice CRUD operations"""
    serializer_class = ChoiceSerializer

    def get_queryset(self):
        return Choice.objects.filter(
            Q(choice_list__project__owner=self.request.user) |
            Q(choice_list__project__shares__user=self.request.user)
        ).distinct().prefetch_related('extra_values')

    @action(detail=True, methods=['patch'], url_path='set_extra_value')
    def set_extra_value(self, request, pk=None):
        """Create or update an extra column value for this choice."""
        choice = self.get_object()
        column_id = request.data.get('column_id')
        value = request.data.get('value', '')
        if column_id is None:
            return Response({'error': 'column_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(ChoiceListColumn, id=column_id, choice_list=choice.choice_list)
        ev, _ = ChoiceExtraValue.objects.update_or_create(
            choice=choice, column=column,
            defaults={'value': value},
        )
        return Response(ChoiceExtraValueSerializer(ev).data)

    @action(detail=True, methods=['patch'], url_path='set_user_extra_value')
    def set_user_extra_value(self, request, pk=None):
        """Create or update a user-extra column value for this choice (follower only)."""
        choice = self.get_object()
        config_id = request.data.get('config_id')
        column_id = request.data.get('column_id')
        value = request.data.get('value', '')
        if config_id is None or column_id is None:
            return Response({'error': 'config_id and column_id are required'}, status=status.HTTP_400_BAD_REQUEST)
        config = get_object_or_404(UserChoiceListConfig, id=config_id, user=request.user)
        if config.choice_list != choice.choice_list:
            return Response({'error': 'config does not match this choice\'s list'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(UserChoiceListColumn, id=column_id, config=config)
        uev, _ = UserChoiceExtraValue.objects.update_or_create(
            config=config, choice=choice, column=column,
            defaults={'value': value},
        )
        return Response(UserChoiceExtraValueSerializer(uev).data)



class KoboCSVExportView(APIView):
    """
    Export choices as CSV for KoboToolbox external choice list.
    Endpoint: GET /{project_id}/{choice_list_name}.csv
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    
    def get(self, request, username, project_id, choice_list_name, filename=None):
        """
        Returns a CSV with name,label columns.
        Looks up project by slug and choice list by slug.
        """
        logger.info('CSV export | user=%s project=%s list=%s | ip=%s',
                    username, project_id, choice_list_name,
                    request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '-')))
        try:
            project = get_object_or_404(Project, slug=project_id, owner__username=username)
            choice_list = get_object_or_404(
                ChoiceList,
                project=project,
                slug=choice_list_name
            )
            
            # Create CSV in memory
            output = StringIO()
            writer = csv.writer(output)

            extra_cols = list(choice_list.columns.order_by('order', 'id'))
            writer.writerow(['name', choice_list.label_column_name] + [col.name for col in extra_cols])

            for choice in choice_list.choices.prefetch_related('extra_values').all():
                ev_map = {ev.column_id: ev.value for ev in choice.extra_values.all()}
                writer.writerow([choice.value, choice.label] + [ev_map.get(col.id, '') for col in extra_cols])
            
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
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsProjectWriteAuthorized]
    parser_classes = [JSONParser, PlainTextJSONParser]

    def get_choice_list(self):
        """Used by IsProjectWriteAuthorized to resolve the choice list from URL kwargs."""
        project = get_object_or_404(
            Project,
            slug=self.kwargs['project_id'],
            owner__username=self.kwargs['username'],
        )
        return get_object_or_404(ChoiceList, project=project, slug=self.kwargs['choice_list_name'])
    
    def post(self, request, username, project_id, choice_list_name):
        """
        Add a choice. Idempotent - returns success if already exists.
        Extracts first value from JSON body regardless of key.
        """
        logger.info('ADD request | user=%s project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    username, project_id, choice_list_name,
                    request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '-')),
                    request.META.get('CONTENT_TYPE', '-'),
                    request.body[:500])
        try:
            project = get_object_or_404(Project, slug=project_id, owner__username=username)
            choice_list = get_object_or_404(
                ChoiceList,
                project=project,
                slug=choice_list_name
            )
            
            # Extract first value from JSON body
            # KoboToolbox may send content-type: text/plain, so fall back to
            # parsing raw body if DRF didn't parse it
            data = request.data
            if not data:
                try:
                    data = json.loads(request.body)
                except (json.JSONDecodeError, Exception):
                    data = {}
            label = next(iter(data.values())) if data else None
            
            if not label:
                logger.warning('ADD failed - no label | project=%s list=%s | parsed_data=%r',
                               project_id, choice_list_name, data)
                return Response(
                    {
                        'success': False,
                        'message': 'No value provided in request body'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if choice already exists (handles both normal and soft-deleted)
            existing = choice_list.choices.filter(label=label).first()
            if existing:
                # Check whether it has been soft-deleted
                removed_col = choice_list.columns.filter(name='removed').first()
                is_removed = (
                    removed_col is not None and
                    existing.extra_values.filter(column=removed_col, value='true').exists()
                )
                if is_removed:
                    # Un-soft-delete: restore removed=false
                    existing.extra_values.filter(column=removed_col).update(value='false')
                    logger.info('ADD unremoved soft-deleted choice | label=%r value=%s | project=%s list=%s',
                                label, existing.value, project_id, choice_list_name)
                    return Response({
                        'success': True,
                        'message': 'Choice re-activated',
                        'choice_id': existing.value,
                        'value': label
                    })
                logger.info('ADD idempotent - already exists | label=%r | project=%s list=%s', label, project_id, choice_list_name)
                return Response({
                    'success': True,
                    'message': 'Choice already exists',
                    'choice_id': existing.value,
                    'value': label
                })

            # Generate name/value according to the list's name_generation setting
            value = _generate_choice_name(choice_list, label)

            # Create new choice (order assigned below)
            choice = Choice.objects.create(
                choice_list=choice_list,
                label=label,
                value=value,
            )

            # Re-sort all choices in the list alphabetically; pin=true choices go to the end
            all_choices = list(
                Choice.objects.filter(choice_list=choice_list).prefetch_related('extra_values')
            )
            pin_col = choice_list.columns.filter(name='pin').first()
            def _is_pinned(c):
                if pin_col is None:
                    return False
                return any(
                    ev.column_id == pin_col.id and ev.value == 'true'
                    for ev in c.extra_values.all()
                )
            unpinned = sorted([c for c in all_choices if not _is_pinned(c)], key=lambda c: c.label.lower())
            pinned = sorted([c for c in all_choices if _is_pinned(c)], key=lambda c: c.order)
            for i, c in enumerate(unpinned + pinned):
                c.order = i
            Choice.objects.bulk_update(all_choices, ['order'])
            choice.refresh_from_db()
            _stamp_removed_false(choice, _ensure_removed_column(choice_list))
            _stamp_protected_false(choice, _ensure_protected_column(choice_list))
            _stamp_pin_empty(choice, _ensure_pin_column(choice_list))

            logger.info('ADD success | label=%r value=%s order=%d | project=%s list=%s', label, value, choice.order, project_id, choice_list_name)
            return Response({
                'success': True,
                'message': 'Choice added successfully',
                'choice_id': choice.value,
                'value': label
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            logger.exception('ADD error | project=%s list=%s | error=%s', project_id, choice_list_name, e)
            return Response(
                {
                    'success': False,
                    'message': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )


def _generate_choice_name(choice_list, label):
    """Generate a choice value/name according to the choice list's name_generation setting."""
    if choice_list.name_generation == 'from_label':
        # Lowercase, replace spaces with underscores, strip non-latin/digit/underscore
        base = label.lower()
        base = base.replace(' ', '_')
        base = re.sub(r'[^a-z0-9_]', '', base)
        # Truncate to max length (if set)
        if choice_list.name_max_length and len(base) > choice_list.name_max_length:
            base = base[:choice_list.name_max_length].rstrip('_')
        # Fall back to uuid if nothing usable remains
        if not base:
            return shortuuid.ShortUUID().random(length=9)
        # Ensure uniqueness within this choice list
        existing = set(choice_list.choices.values_list('value', flat=True))
        if base not in existing:
            return base
        counter = 2
        while True:
            candidate = f'{base}_{counter}'
            if candidate not in existing:
                return candidate
            counter += 1
    return shortuuid.ShortUUID().random(length=9)


def _bootstrap_system_columns(choice_list):
    """Ensure removed, protected, and pin columns exist for a choice list and
    stamp any choices that are missing values for them."""
    removed_col = _ensure_removed_column(choice_list)
    protected_col = _ensure_protected_column(choice_list)
    pin_col = _ensure_pin_column(choice_list)
    for choice in choice_list.choices.prefetch_related('extra_values').all():
        _stamp_removed_false(choice, removed_col)
        _stamp_protected_false(choice, protected_col)
        _stamp_pin_empty(choice, pin_col)


def _ensure_removed_column(choice_list):
    """Get or create the 'removed' column for a choice list."""
    col, _ = ChoiceListColumn.objects.get_or_create(
        choice_list=choice_list,
        name='removed',
        defaults={'order': choice_list.columns.count()},
    )
    return col


def _stamp_removed_false(choice, removed_col):
    """Ensure this choice has removed=false (creates the row if missing)."""
    ChoiceExtraValue.objects.get_or_create(
        choice=choice,
        column=removed_col,
        defaults={'value': 'false'},
    )


def _ensure_protected_column(choice_list):
    """Get or create the 'protected' column for a choice list."""
    col, _ = ChoiceListColumn.objects.get_or_create(
        choice_list=choice_list,
        name='protected',
        defaults={'order': choice_list.columns.count()},
    )
    return col


def _stamp_protected_false(choice, protected_col):
    """Ensure this choice has protected=false (creates the row if missing)."""
    ChoiceExtraValue.objects.get_or_create(
        choice=choice,
        column=protected_col,
        defaults={'value': 'false'},
    )


def _ensure_pin_column(choice_list):
    """Get or create the 'pin' column for a choice list."""
    col, _ = ChoiceListColumn.objects.get_or_create(
        choice_list=choice_list,
        name='pin',
        defaults={'order': choice_list.columns.count()},
    )
    return col


def _stamp_pin_empty(choice, pin_col):
    """Ensure this choice has pin=false (creates the row if missing)."""
    ChoiceExtraValue.objects.get_or_create(
        choice=choice,
        column=pin_col,
        defaults={'value': 'false'},
    )


def _is_protected(choice, choice_list):
    """Return True if this choice has protected=true."""
    protected_col = choice_list.columns.filter(name='protected').first()
    if protected_col is None:
        return False
    return choice.extra_values.filter(column=protected_col, value='true').exists()


def _extract_kobo_value(request):
    """Extract the first value from a KoboToolbox request body (key-agnostic)."""
    data = request.data
    if not data:
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, Exception):
            data = {}
    return next(iter(data.values())) if data else None


class KoboRemoveChoiceView(APIView):
    """
    Soft-remove a choice via KoboToolbox API.
    Endpoint: POST /{project_id}/{choice_list_name}/remove

    Creates (or reuses) a "removed" extra column on the choice list and sets
    its value to "true" for the matched choice. Idempotent.

    Request format: {"name": "<choice value/id>"} (key can be any name)
    Response format: {"success": true, ...}
    """
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsProjectWriteAuthorized]
    parser_classes = [JSONParser, PlainTextJSONParser]

    def get_choice_list(self):
        """Used by IsProjectWriteAuthorized to resolve the choice list from URL kwargs."""
        project = get_object_or_404(
            Project,
            slug=self.kwargs['project_id'],
            owner__username=self.kwargs['username'],
        )
        return get_object_or_404(ChoiceList, project=project, slug=self.kwargs['choice_list_name'])

    def post(self, request, username, project_id, choice_list_name):
        ip = request.META.get('REMOTE_ADDR', '-')
        logger.info('REMOVE (soft) request | user=%s project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    username, project_id, choice_list_name, ip, request.content_type, request.body)
        try:
            project = get_object_or_404(Project, slug=project_id, owner__username=username)
            choice_list = get_object_or_404(ChoiceList, project=project, slug=choice_list_name)

            value = _extract_kobo_value(request)
            if not value:
                logger.warning('REMOVE (soft) failed - no value | project=%s list=%s', project_id, choice_list_name)
                return Response({'success': False, 'message': 'No value provided in request body'},
                                status=status.HTTP_400_BAD_REQUEST)

            choice = choice_list.choices.filter(value=value).first()
            if not choice:
                logger.info('REMOVE (soft) idempotent - not found | value=%r | project=%s list=%s',
                            value, project_id, choice_list_name)
                return Response({'success': True, 'message': 'Choice not found (already removed)', 'value': value})

            # Block soft-deletion of protected choices
            choice_with_evs = choice_list.choices.prefetch_related('extra_values').get(pk=choice.pk)
            if _is_protected(choice_with_evs, choice_list):
                logger.warning('REMOVE (soft) blocked - protected | value=%r label=%r | project=%s list=%s',
                               value, choice.label, project_id, choice_list_name)
                return Response({'success': False, 'message': 'Choice is protected and cannot be soft-deleted'},
                                status=status.HTTP_403_FORBIDDEN)

            removed_col = _ensure_removed_column(choice_list)
            ChoiceExtraValue.objects.update_or_create(
                choice=choice,
                column=removed_col,
                defaults={'value': 'true'},
            )
            logger.info('REMOVE (soft) success | value=%r label=%r | project=%s list=%s',
                        value, choice.label, project_id, choice_list_name)
            return Response({'success': True, 'message': 'Choice marked as removed', 'value': value})

        except Exception as e:
            logger.exception('REMOVE (soft) error | project=%s list=%s | error=%s', project_id, choice_list_name, e)
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class KoboDeleteChoiceView(APIView):
    """
    Hard-delete a choice via KoboToolbox API.
    Endpoint: POST /{project_id}/{choice_list_name}/delete

    Permanently deletes the choice row. Idempotent.

    Request format: {"name": "<choice value/id>"} (key can be any name)
    Response format: {"success": true, ...}
    """
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsProjectWriteAuthorized]
    parser_classes = [JSONParser, PlainTextJSONParser]

    def get_choice_list(self):
        """Used by IsProjectWriteAuthorized to resolve the choice list from URL kwargs."""
        project = get_object_or_404(
            Project,
            slug=self.kwargs['project_id'],
            owner__username=self.kwargs['username'],
        )
        return get_object_or_404(ChoiceList, project=project, slug=self.kwargs['choice_list_name'])

    def post(self, request, username, project_id, choice_list_name):
        ip = request.META.get('REMOTE_ADDR', '-')
        logger.info('DELETE (hard) request | user=%s project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    username, project_id, choice_list_name, ip, request.content_type, request.body)
        try:
            project = get_object_or_404(Project, slug=project_id, owner__username=username)
            choice_list = get_object_or_404(ChoiceList, project=project, slug=choice_list_name)

            value = _extract_kobo_value(request)
            if not value:
                logger.warning('DELETE (hard) failed - no value | project=%s list=%s', project_id, choice_list_name)
                return Response({'success': False, 'message': 'No value provided in request body'},
                                status=status.HTTP_400_BAD_REQUEST)

            choice = choice_list.choices.filter(value=value).first()
            if choice:
                label = choice.label
                choice.delete()
                logger.info('DELETE (hard) success | value=%r label=%r | project=%s list=%s',
                            value, label, project_id, choice_list_name)
                return Response({'success': True, 'message': 'Choice deleted', 'value': value})
            else:
                logger.info('DELETE (hard) idempotent - not found | value=%r | project=%s list=%s',
                            value, project_id, choice_list_name)
                return Response({'success': True, 'message': 'Choice not found (already deleted)', 'value': value})

        except Exception as e:
            logger.exception('DELETE (hard) error | project=%s list=%s | error=%s', project_id, choice_list_name, e)
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublicProjectViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for publicly discoverable projects. No authentication required."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_serializer_class(self):
        from .serializers import PublicProjectSerializer, PublicProjectListSerializer
        if self.action == 'retrieve':
            return PublicProjectSerializer
        return PublicProjectListSerializer

    def get_queryset(self):
        from django.db.models import Count
        from django.db.models import Prefetch as DjPrefetch
        qs = Project.objects.filter(is_public=True).annotate(
            list_count_annotation=Count('choice_lists')
        )
        # On the list view, hide projects that belong to a collection — find them there instead
        if self.action == 'list':
            qs = qs.filter(collection_membership__isnull=True)
        if self.action == 'retrieve':
            qs = qs.prefetch_related(
                DjPrefetch('choice_lists'),
                DjPrefetch('choice_lists__columns'),
                DjPrefetch('choice_lists__choices'),
                DjPrefetch('choice_lists__choices__extra_values'),
            )
        else:
            qs = qs.select_related('owner')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(owner__username__icontains=search)
            )
        return qs.order_by('-updated_at')


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

from .models import Collection, CollectionProject, CollectionShare
from .serializers import CollectionSerializer, PublicCollectionSerializer, PublicCollectionProjectSerializer


class CollectionViewSet(viewsets.ModelViewSet):
    """ViewSet for Collection CRUD and management actions."""
    serializer_class = CollectionSerializer
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Count
        return Collection.objects.filter(
            Q(owner=user) | Q(shares__user=user)
        ).distinct().annotate(
            project_count_annotation=Count('collection_projects')
        ).prefetch_related(
            'collection_projects__project__owner',
            'collection_projects__project__choice_lists',
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _require_owner(self, collection):
        if collection.owner != self.request.user:
            raise PermissionDenied("Only the collection owner can perform this action.")

    def _require_member(self, collection):
        """Allow owner or share member. Raises PermissionDenied otherwise."""
        if collection.owner == self.request.user:
            return
        if not collection.shares.filter(user=self.request.user).exists():
            raise PermissionDenied("You do not have access to this collection.")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # is_public, name, description, slug — owner only
        owner_only_fields = {'is_public', 'name', 'description', 'slug'}
        if owner_only_fields & set(request.data.keys()):
            self._require_owner(instance)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._require_owner(instance)
        # Delete all projects (and their choice lists) that belong to this collection
        Project.objects.filter(collection_membership__collection=instance).delete()
        return super().destroy(request, *args, **kwargs)

    # ------------------------------------------------------------------ projects

    @action(detail=True, methods=['post'], url_path='add_project')
    def add_project(self, request, id=None):
        collection = self.get_object()
        self._require_member(collection)
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({'error': 'project_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        # Requester must own or have access to the project
        project = get_object_or_404(
            Project,
            Q(owner=request.user) | Q(shares__user=request.user),
            id=project_id,
        )
        # A project may only belong to one collection
        if CollectionProject.objects.filter(project=project).exclude(collection=collection).exists():
            return Response({'error': 'This project is already in another collection'}, status=status.HTTP_400_BAD_REQUEST)
        order = collection.collection_projects.count()
        _, created = CollectionProject.objects.get_or_create(
            collection=collection, project=project,
            defaults={'order': order},
        )
        if not created:
            return Response({'error': 'Project is already in this collection'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CollectionSerializer(collection, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='remove_project/(?P<project_id>[0-9]+)')
    def remove_project(self, request, id=None, project_id=None):
        collection = self.get_object()
        self._require_member(collection)
        deleted, _ = CollectionProject.objects.filter(collection=collection, project_id=project_id).delete()
        if not deleted:
            return Response({'error': 'Project not found in this collection'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------ shares

    @action(detail=True, methods=['get'], url_path='shares')
    def shares(self, request, id=None):
        collection = self.get_object()
        self._require_owner(collection)
        share_list = collection.shares.select_related('user').order_by('created_at')
        data = [{'username': s.user.username, 'created_at': s.created_at} for s in share_list]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='share')
    def share(self, request, id=None):
        collection = self.get_object()
        self._require_owner(collection)
        username = (request.data.get('username') or '').strip()
        if not username:
            return Response({'error': 'username is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': f'User "{username}" not found'}, status=status.HTTP_400_BAD_REQUEST)
        if user == collection.owner:
            return Response({'error': 'Cannot share a collection with its own owner'}, status=status.HTTP_400_BAD_REQUEST)
        _, created = CollectionShare.objects.get_or_create(collection=collection, user=user)
        if not created:
            return Response({'error': f'Collection is already shared with "{username}"'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'username': username}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='share/(?P<username>[^/.]+)')
    def unshare(self, request, id=None, username=None):
        collection = self.get_object()
        self._require_owner(collection)
        deleted, _ = CollectionShare.objects.filter(collection=collection, user__username=username).delete()
        if not deleted:
            return Response({'error': f'No share found for "{username}"'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicCollectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for publicly discoverable collections. No authentication required."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_serializer_class(self):
        return PublicCollectionSerializer

    def get_queryset(self):
        from django.db.models import Count
        qs = Collection.objects.filter(is_public=True).annotate(
            project_count_annotation=Count('collection_projects')
        ).select_related('owner')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(owner__username__icontains=search)
            )
        return qs.order_by('-updated_at')

    def projects(self, request, pk=None):
        """Paginated list of projects in this public collection, with their choice lists and choices."""
        collection = self.get_object()
        from django.core.paginator import Paginator, InvalidPage
        page_size = min(max(int(request.query_params.get('page_size', 10)), 1), 50)
        page_num = max(int(request.query_params.get('page', 1)), 1)
        search = request.query_params.get('search', '').strip()
        qs = collection.collection_projects.select_related(
            'project__owner',
        ).prefetch_related(
            'project__choice_lists',
            'project__choice_lists__columns',
            'project__choice_lists__choices',
            'project__choice_lists__choices__extra_values',
        ).order_by('order')
        if search:
            qs = qs.filter(
                Q(project__name__icontains=search) | Q(project__description__icontains=search)
            )
        paginator = Paginator(qs, page_size)
        try:
            page = paginator.page(page_num)
        except InvalidPage:
            page = paginator.page(1)
        serializer = PublicCollectionProjectSerializer(page.object_list, many=True)
        return Response({
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'page': page.number,
            'page_size': page_size,
            'results': serializer.data,
        })


# ---------------------------------------------------------------------------
# Phase 9: User follow / customise ViewSet
# ---------------------------------------------------------------------------

class UserChoiceListConfigViewSet(viewsets.ModelViewSet):
    """CRUD for a user's followed list configs. Scoped to the requesting user."""
    serializer_class = UserChoiceListConfigSerializer

    def get_queryset(self):
        return UserChoiceListConfig.objects.filter(
            user=self.request.user
        ).select_related(
            'choice_list__project__owner',
        ).prefetch_related('columns')

    def perform_create(self, serializer):
        choice_list_id = self.request.data.get('choice_list')
        if not choice_list_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'choice_list': 'This field is required.'})
        # The target list must be on a public project or a project the user can read.
        cl = get_object_or_404(ChoiceList, id=choice_list_id)
        user = self.request.user
        can_read = (
            cl.project.is_public
            or cl.project.owner == user
            or cl.project.shares.filter(user=user).exists()
        )
        if not can_read:
            raise PermissionDenied("You do not have permission to follow this list.")
        serializer.save(user=user, choice_list=cl)

    # ------------------------------------------------------------------ choices

    @action(detail=True, methods=['get'], url_path='choices')
    def choices(self, request, pk=None):
        """Return the choice list's choices augmented with user extra values for this config."""
        config = self.get_object()
        cl = config.choice_list
        result = []
        for choice in cl.choices.prefetch_related('extra_values', 'user_extra_values').order_by('order'):
            ev_list = [
                {'id': ev.id, 'column': ev.column_id, 'value': ev.value}
                for ev in choice.extra_values.all()
            ]
            uev_list = [
                {'id': uev.id, 'column': uev.column_id, 'value': uev.value}
                for uev in choice.user_extra_values.filter(config=config)
            ]
            result.append({
                'id': choice.id,
                'value': choice.value,
                'label': choice.label,
                'order': choice.order,
                'extra_values': ev_list,
                'user_extra_values': uev_list,
            })
        return Response(result)

    # ------------------------------------------------------------------ columns

    @action(detail=True, methods=['post'], url_path='add_column')
    def add_column(self, request, pk=None):
        config = self.get_object()
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        if config.columns.filter(name=name).exists():
            return Response({'error': 'A column with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        order = config.columns.count()
        column = UserChoiceListColumn.objects.create(config=config, name=name, order=order)
        return Response(UserChoiceListColumnSerializer(column).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update_column')
    def update_column(self, request, pk=None):
        config = self.get_object()
        column_id = request.data.get('column_id')
        new_name = (request.data.get('name') or '').strip()
        if not column_id or not new_name:
            return Response({'error': 'column_id and name are required'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(UserChoiceListColumn, id=column_id, config=config)
        if config.columns.filter(name=new_name).exclude(pk=column.pk).exists():
            return Response({'error': 'A column with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
        column.name = new_name
        column.save()
        return Response(UserChoiceListColumnSerializer(column).data)

    @action(detail=True, methods=['delete'], url_path='remove_column')
    def remove_column(self, request, pk=None):
        config = self.get_object()
        column_id = request.data.get('column_id')
        if not column_id:
            return Response({'error': 'column_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        column = get_object_or_404(UserChoiceListColumn, id=column_id, config=config)
        column.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------ import

    @action(detail=True, methods=['post'], url_path='import')
    def import_csv(self, request, pk=None):
        """Bulk-upsert user extra column values from a CSV.

        The CSV must have a 'name' (or 'value') column to match choices.
        Remaining columns are treated as user extra column names to upsert.
        Rows with no matching choice are skipped (reported in response).
        """
        config = self.get_object()
        cl = config.choice_list
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            text = uploaded.read().decode('utf-8-sig')
            dialect = csv.Sniffer().sniff(text[:2048], delimiters=',;\t|')
            reader = csv.DictReader(StringIO(text), dialect=dialect)
            raw_rows = list(reader)
            rows = [
                {k.strip().lower(): (v.strip() if v else '') for k, v in row.items()}
                for row in raw_rows
            ]
        except Exception as e:
            return Response({'error': f'Could not parse CSV: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({'error': 'CSV file is empty'}, status=status.HTTP_400_BAD_REQUEST)

        sample = rows[0]
        id_col = 'name' if 'name' in sample else ('value' if 'value' in sample else None)
        if not id_col:
            return Response(
                {'error': 'CSV must have a "name" (or "value") column to match choices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        SKIP = {id_col, 'name', 'value', 'label'}
        extra_col_names = [k for k in sample.keys() if k not in SKIP]
        if not extra_col_names:
            return Response({'error': 'No extra columns found in CSV beyond name/value/label.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create UserChoiceListColumn rows
        col_map = {}
        for col_name in extra_col_names:
            col, _ = UserChoiceListColumn.objects.get_or_create(
                config=config,
                name=col_name,
                defaults={'order': config.columns.count()},
            )
            col_map[col_name] = col

        # Build choice lookup by value field
        choice_lookup = {c.value: c for c in cl.choices.all()}

        matched = 0
        skipped = 0
        uev_to_upsert = []
        for row in rows:
            choice_value = row.get(id_col, '').strip()
            choice = choice_lookup.get(choice_value)
            if choice is None:
                skipped += 1
                continue
            matched += 1
            for col_name, col in col_map.items():
                uev_to_upsert.append((choice, col, row.get(col_name, '')))

        # Bulk upsert — update_or_create in a loop (acceptable for typical import sizes)
        for choice, col, value in uev_to_upsert:
            UserChoiceExtraValue.objects.update_or_create(
                config=config, choice=choice, column=col,
                defaults={'value': value},
            )

        # Return refreshed config
        config.refresh_from_db()
        serializer = UserChoiceListConfigSerializer(config)
        return Response({
            'matched': matched,
            'skipped': skipped,
            'config': serializer.data,
        })


# ---------------------------------------------------------------------------
# Phase 9: Public custom CSV export view
# ---------------------------------------------------------------------------

class UserCustomCSVExportView(APIView):
    """
    Public CSV export for a follower's customised view of a choice list.
    URL: /{follower_username}/{project_slug}/custom/{list_slug}.csv
    No authentication required — the URL is publicly accessible.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, follower_username, project_slug, list_slug):
        config = get_object_or_404(
            UserChoiceListConfig,
            user__username=follower_username,
            choice_list__project__slug=project_slug,
            choice_list__slug=list_slug,
        )
        cl = config.choice_list
        name_col = 'name'
        label_col = config.label_column_name or cl.label_column_name or 'label'
        orig_cols = list(cl.columns.order_by('order', 'id'))
        user_cols = list(config.columns.order_by('order', 'id'))

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [name_col, label_col]
            + [c.name for c in orig_cols]
            + [c.name for c in user_cols]
        )

        for choice in cl.choices.prefetch_related('extra_values', 'user_extra_values').all():
            ev_map = {ev.column_id: ev.value for ev in choice.extra_values.all()}
            uev_map = {
                uev.column_id: uev.value
                for uev in choice.user_extra_values.filter(config=config)
            }
            writer.writerow(
                [choice.value, choice.label]
                + [ev_map.get(col.id, '') for col in orig_cols]
                + [uev_map.get(col.id, '') for col in user_cols]
            )

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{list_slug}.csv"'
        return response

