from django.db import models
from django.contrib.auth.models import User
import shortuuid


class Project(models.Model):
    """Represents a KoboToolbox project"""
    slug = models.CharField(max_length=255, unique=True, help_text="Project slug (e.g., aQQv2xc99EodN8pB8GZ6Jq)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.slug})"


class ChoiceList(models.Model):
    """Represents a list of choices for a project"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='choice_lists')
    slug = models.CharField(max_length=255, help_text="Choice list slug (e.g., fruits)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
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
