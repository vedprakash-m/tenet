# This helper classifies names only; it does not grant extraction permission.
def is_tar_name(name):
    return name.endswith((".tar", ".tar.gz"))
