
import re
import json

file_path = '/Users/chiru/Desktop/Blockchain-Project/events.html'
json_path = '/Users/chiru/Desktop/Blockchain-Project/events.json'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

events = []
list_items = re.findall(r'<li class="list-group-item.*?</li>', content, re.DOTALL)

print(f"Found {len(list_items)} events.")

for i, item in enumerate(list_items):
    # Skip hidden template items
    if 'style="display: none;"' in item:
        continue

    event = {}
    event['id'] = i + 1 # Note: IDs might shift, but that's fine.
    
    # Title
    # <h3 class="media-heading header-cg--h4"> ... <a ... >Title</a>
    title_match = re.search(r'<h3 class="media-heading header-cg--h4">.*?<a[^>]*>(.*?)</a>', item, re.DOTALL)
    if title_match:
        event['title'] = title_match.group(1).strip()
    else:
        # Fallback regex for title
        event['title'] = "Unknown Event"

    # Image
    img_match = re.search(r'<img [^>]*src="([^"]*)"', item)
    if img_match:
        event['image'] = img_match.group(1)
    else:
        event['image'] = ""

    # Date
    date_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">(.*?)</p>', item, re.DOTALL)
    if date_match:
        event['date_display'] = date_match.group(1).strip()
        time_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">.*?</p>\s*<p style="margin:0;">(.*?)</p>', item, re.DOTALL)
        if time_match:
             event['date_display'] += " | " + time_match.group(1).strip()
    else:
        event['date_display'] = ""

    # Location
    loc_match = re.search(r'aria-label="Event location".*?</div>\s*(.*?)\s*<p>', item, re.DOTALL)
    if loc_match:
        event['location'] = loc_match.group(1).strip()
    else:
        event['location'] = ""
    
    # Description
    desc_match = re.search(r'aria-description="(.*?)"', item)
    if desc_match:
         event['description_full'] = desc_match.group(1)
    else:
         event['description_full'] = ""

    # Clean fields
    if 'title' in event:
        event['title'] = re.sub(r'\s+', ' ', event['title']).strip()
    if 'date_display' in event:
        event['date_display'] = re.sub(r'\s+', ' ', event['date_display']).strip()
    if 'location' in event:
         event['location'] = re.sub(r'\s+', ' ', event['location']).strip()
    
    # Filter only truly broken ones (template placeholders)
    if "[eventName]" in event['title']:
        continue
    
    events.append(event)

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(events, f, indent=4)

print(f"Extracted {len(events)} valid events to events.json")
