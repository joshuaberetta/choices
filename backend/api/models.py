from django.db import models
from django.contrib.auth.models import User
import shortuuid


class Project(models.Model):
    """Represents a KoboToolbox project"""
    slug = models.CharField(max_length=255, help_text="Project slug (e.g., aQQv2xc99EodN8pB8GZ6Jq)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    is_public = models.BooleanField(default=False)
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
        default='from_label',
        choices=NAME_GENERATION_CHOICES,
        help_text="How to auto-generate the choice name/value when adding a new choice",
    )
    name_max_length = models.PositiveIntegerField(
        default=0,
        help_text="Maximum length for label-derived names (0 = no limit)",
    )
    require_auth = models.BooleanField(
        default=True,
        help_text="If False, /add and /remove are openly writable without credentials",
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


class ProjectShare(models.Model):
    """Grants a user access to a project they don't own"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='shares')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_projects')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'user')

    def __str__(self):
        return f"{self.user.username} → {self.project}"


class Collection(models.Model):
    """A named grouping of Projects for easier discovery"""
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='collections')
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.slug})"


class CollectionProject(models.Model):
    """M2M join between Collection and Project with ordering; a project belongs to at most one collection"""
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='collection_projects')
    project = models.OneToOneField(Project, on_delete=models.PROTECT, related_name='collection_membership')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.collection} → {self.project}"


class UserChoiceListConfig(models.Model):
    """A user's 'follow' record for a public choice list, with optional column customisations."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followed_lists')
    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name='follower_configs')
    label_column_name = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Overrides the list's label_column_name in exports. Blank = inherit original.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'choice_list')

    def __str__(self):
        return f"{self.user.username} → {self.choice_list}"


class UserChoiceListColumn(models.Model):
    """An extra column the follower adds on top of the original list's columns."""
    config = models.ForeignKey(UserChoiceListConfig, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('config', 'name')
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.name} ({self.config})"


class UserChoiceExtraValue(models.Model):
    """Cell value for a user-added column on a specific choice."""
    config = models.ForeignKey(UserChoiceListConfig, on_delete=models.CASCADE, related_name='extra_values')
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, related_name='user_extra_values')
    column = models.ForeignKey(UserChoiceListColumn, on_delete=models.CASCADE, related_name='values')
    value = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('config', 'choice', 'column')

    def __str__(self):
        return f"{self.choice} – {self.column.name}: {self.value}"


class CollectionShare(models.Model):
    """Grants a user access to manage a collection they don't own"""
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='shares')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_collections')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('collection', 'user')

    def __str__(self):
        return f"{self.user.username} → {self.collection}"
