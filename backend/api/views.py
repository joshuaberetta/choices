import csv
import json
import logging
from io import StringIO

logger = logging.getLogger('api')
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import BasicAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.parsers import JSONParser, BaseParser
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
import shortuuid


class PlainTextJSONParser(BaseParser):
    """Parses text/plain bodies as JSON (for KoboToolbox compatibility)"""
    media_type = 'text/plain'

    def parse(self, stream, media_type=None, parser_context=None):
        return json.loads(stream.read().decode('utf-8'))

from django.db.models import Prefetch
from .models import Project, ChoiceList, Choice, ChoiceListColumn, ChoiceExtraValue
from .serializers import (
    ProjectSerializer,
    ChoiceListSerializer,
    ChoiceListDetailSerializer,
    ChoiceSerializer,
    ChoiceListColumnSerializer,
    ChoiceExtraValueSerializer,
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

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ('retrieve', 'export', 'import_csv'):
            qs = qs.prefetch_related(
                'columns',
                Prefetch('choices', queryset=Choice.objects.prefetch_related('extra_values')),
            )
        return qs

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

        value = shortuuid.ShortUUID().random(length=9)
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
        writer.writerow(['name', 'label'] + [col.name for col in extra_cols])
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
        if not id_col or 'label' not in sample:
            found = list(sample.keys())
            return Response(
                {'error': f'CSV must have a "name" (or "value") column and a "label" column. Found columns: {found}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Identify extra column names (anything beyond the standard set)
        RESERVED = {id_col, 'name', 'value', 'label', 'removed', 'protected', 'pin'}
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
        valid_rows = [row for row in rows if row.get(id_col) and row.get('label')]
        new_choices = [
            Choice(choice_list=choice_list, value=row[id_col], label=row['label'], order=i)
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
    queryset = Choice.objects.prefetch_related('extra_values').all()
    serializer_class = ChoiceSerializer

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


class KoboCSVExportView(APIView):
    """
    Export choices as CSV for KoboToolbox external choice list.
    Endpoint: GET /{project_id}/{choice_list_name}.csv
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    
    def get(self, request, project_id, choice_list_name):
        """
        Returns a CSV with name,label columns.
        Looks up project by slug and choice list by slug.
        """
        logger.info('CSV export | project=%s list=%s | ip=%s',
                    project_id, choice_list_name,
                    request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '-')))
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

            extra_cols = list(choice_list.columns.order_by('order', 'id'))
            writer.writerow(['name', 'label'] + [col.name for col in extra_cols])

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
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, PlainTextJSONParser]
    
    def post(self, request, project_id, choice_list_name):
        """
        Add a choice. Idempotent - returns success if already exists.
        Extracts first value from JSON body regardless of key.
        """
        logger.info('ADD request | project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    project_id, choice_list_name,
                    request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '-')),
                    request.META.get('CONTENT_TYPE', '-'),
                    request.body[:500])
        try:
            project = get_object_or_404(Project, slug=project_id)
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

            # Generate short ID (9 chars alphanumeric)
            value = shortuuid.ShortUUID().random(length=9)

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
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, PlainTextJSONParser]

    def post(self, request, project_id, choice_list_name):
        ip = request.META.get('REMOTE_ADDR', '-')
        logger.info('REMOVE (soft) request | project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    project_id, choice_list_name, ip, request.content_type, request.body)
        try:
            project = get_object_or_404(Project, slug=project_id)
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
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, PlainTextJSONParser]

    def post(self, request, project_id, choice_list_name):
        ip = request.META.get('REMOTE_ADDR', '-')
        logger.info('DELETE (hard) request | project=%s list=%s | ip=%s | content-type=%s | body=%r',
                    project_id, choice_list_name, ip, request.content_type, request.body)
        try:
            project = get_object_or_404(Project, slug=project_id)
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

