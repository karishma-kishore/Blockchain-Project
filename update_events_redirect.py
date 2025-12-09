
import re

file_path = '/Users/chiru/Desktop/Blockchain-Project/events.html'
target_href = 'rsvp.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to find the href and replace it
# Looking for href="/rsvp_boot?id=..."
# We will match href=" followed by anything that looks like the old path until the closing quote
# But specifically targeting those rsvp_boot links
pattern = r'href="/rsvp_boot\?id=[0-9]+"'
replacement = f'href="{target_href}"'

new_content = re.sub(pattern, replacement, content)

# Check if changes were made
if content == new_content:
    print("No changes made. Pattern might not match.")
else:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated links in events.html")
