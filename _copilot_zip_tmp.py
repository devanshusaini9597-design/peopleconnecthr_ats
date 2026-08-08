import os
import zipfile

root = os.getcwd()
zip_path = os.path.join(root, 'ats-master-no-node-modules.zip')
exclude_dirs = {'.git', 'node_modules', 'frontend/node_modules', 'backend/node_modules', 'temp_project', 'uploads'}
exclude_files = {'ats-master-no-node-modules.zip'}

if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        rel_base = os.path.relpath(base, root)
        if rel_base == '.':
            rel_base = ''
        for fname in files:
            if fname in exclude_files:
                continue
            if fname.endswith('.zip'):
                continue
            filepath = os.path.join(base, fname)
            arcname = os.path.join(rel_base, fname) if rel_base else fname
            zf.write(filepath, arcname)

print('ZIP_CREATED', zip_path)
