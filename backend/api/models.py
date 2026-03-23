from django.db import models
from django.contrib.auth.models import User
import shortuuid


class Project(models.Model):
    """Represents a KoboToolbox project"""
    slug = models.CharField(max_length=255, help_text="Project slug (e.g., aQQv2xc99EodN8pB8GZ6Jq)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('owner', 'slug')

    def __str__(self):
        return f"{self.name} ({self.slug})"


class ChoiceList(models.Model):
    """Represents a list of choices for a project"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='choice_lists')
    slug = models.CharField(max_length=255, help_text="Choice list slug (e.g., fruits)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    label_column_name = models.CharField(
        max_length=255,
        default='label',
        help_text="Column header used for the label in CSV export (e.g. 'label::English (en)')",
    )
    NAME_GENERATION_CHOICES = [
        ('uuid', 'Random UUID'),
        ('from_label', 'Derived from label'),
    ]
    name_generation = models.CharField(
        max_length=20,
        default='uuid',
        choices=NAME_GENERATION_CHOICES,
        help_text="How to auto-generate the choice name/value when adding a new choice",
    )
    name_max_length = models.PositiveIntegerField(
        default=0,
        help_text="Maximum length for label-derived names (0 = no limit)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('project', 'slug')

    def __str__(self):
        return f"{self.name} ({self.project.slug})"


class Choice(models.Model):
    """Represents a single choice in a choice list"""
    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name='choices')
    value = models.CharField(max_length=255, help_text="Short UUID (e.g., sgdgbs324)")
    label = models.CharField(max_length=255, help_text="Human-readable label")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ('choice_list', 'label')

    def __str__(self):
        return f"{self.label} ({self.value})"


class ChoiceListColumn(models.Model):
    """An extra configurable column attached to a ChoiceList"""
    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('choice_list', 'name')

    def __str__(self):
        return f"{self.name} ({self.choice_list})"


class ChoiceExtraValue(models.Model):
    """Value for a custom column on a specific choice"""
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, related_name='extra_values')
    column = models.ForeignKey(ChoiceListColumn, on_delete=models.CASCADE, related_name='values')
    value = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('choice', 'column')

    def __str__(self):
        return f"{self.choice} – {self.column.name}: {self.value}"
