from rest_framework.permissions import BasePermission


class IsProjectWriteAuthorized(BasePermission):
    """
    Grants access to Kobo write endpoints (/add, /remove, /delete) based on the
    choice list's require_auth setting:
    - require_auth=False: allow anyone (no credentials needed)
    - require_auth=True:  allow only the project owner or a ProjectShare member
    """

    def has_permission(self, request, view):
        choice_list = view.get_choice_list()
        if not choice_list.require_auth:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        project = choice_list.project
        return (
            project.owner == request.user
            or project.shares.filter(user=request.user).exists()
        )
