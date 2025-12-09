
import re

file_path = '/Users/chiru/Desktop/Blockchain-Project/rsvp.html'
base_url = 'https://sundevilcentral.eoss.asu.edu'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern: src="/..." or href="/..." where the character after the slash is NOT another slash
# We want to match group 1 (src/href), group 2 (the path)
pattern = r'(src|href)="/([^/][^"]*)"'

def replacer(match):
    attr = match.group(1)
    path = match.group(2)
    # Check if it is a special case we want to ignore?
    # e.g. if path is just empty src="/" -> src=".../"
    return f'{attr}="{base_url}/{path}"'

new_content = re.sub(pattern, replacer, content)

# Special case for src="/" or href="/" (root)
new_content = new_content.replace('src="/"', f'src="{base_url}/"')
new_content = new_content.replace('href="/"', f'href="{base_url}/"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed relative paths in rsvp.html")
