import os

def extract_member(archive, member, destination):
    target = os.path.abspath(os.path.join(destination, member.name))
    root = os.path.abspath(destination)
    if not target.startswith(root):
        raise ValueError("outside destination")
    archive.extract(member, destination)
