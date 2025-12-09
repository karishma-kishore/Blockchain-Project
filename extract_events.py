
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
    event = {}
    event['id'] = i + 1
    
    # Title - Look for the header link
    # <h3 class="media-heading header-cg--h4"> <a ... >Title</a>
    title_match = re.search(r'<h3 class="media-heading header-cg--h4">.*?<a[^>]*>(.*?)</a>', item, re.DOTALL)
    if title_match:
        event['title'] = title_match.group(1).strip()
    else:
        event['title'] = "Unknown Event"

    # Image
    img_match = re.search(r'<img [^>]*src="([^"]*)"', item)
    if img_match:
        event['image'] = img_match.group(1)
    else:
        event['image'] = ""

    # Date
    # <div class="media-heading" ... aria-label="Event date"> ... <p style="margin:0;">Tue, Dec 9, 2025</p>
    # We look for aria-label="Event date" then the first <p> after it.
    date_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">(.*?)</p>', item, re.DOTALL)
    if date_match:
        event['date_display'] = date_match.group(1).strip()
        # Try to get time too? Next line usually has time.
        # <p style="margin:0;">6 PM – 8 PM</p>
        time_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">.*?</p>\s*<p style="margin:0;">(.*?)</p>', item, re.DOTALL)
        if time_match:
            event['date_display'] += " | " + time_match.group(1).strip()
    else:
        event['date_display'] = "Date TBD"

    # Location
    # aria-label="Event location" ... </div> Durham Hall room 209, ASU Tempe<p>
    loc_match = re.search(r'aria-label="Event location".*?</div>\s*(.*?)\s*<p>', item, re.DOTALL)
    if loc_match:
        event['location'] = loc_match.group(1).strip()
    else:
        event['location'] = "Location TBD"
    
    # Description (aria-description of the register button)
    desc_match = re.search(r'aria-description="(.*?)"', item)
    if desc_match:
         event['description_full'] = desc_match.group(1)
    else:
         event['description_full'] = ""

    # Clean fields
    if 'title' in event:
        event['title'] = event['title'].replace('\n', ' ').strip()
        event['title'] = re.sub(r'\s+', ' ', event['title'])
    
    if 'date_display' in event:
        event['date_display'] = event['date_display'].replace('\n', ' ').strip()
        event['date_display'] = re.sub(r'\s+', ' ', event['date_display'])

    if 'location' in event:
         event['location'] = event['location'].replace('\n', ' ').strip()
         event['location'] = re.sub(r'\s+', ' ', event['location'])
    
    if 'image' in event:
        event['image'] = event['image'].strip()

    # FILTERING LOGIC
    # 1. Title must be valid
    if not event['title'] or "Unknown Event" in event['title'] or "[eventName]" in event['title']:
        continue
    
    # 2. Must have image (skipping placeholders like [eventPicture] or empty or default)
    if not event['image'] or "[eventPicture]" in event['image'] or "listing-default.png" in event['image']:
        continue

    # 3. Must have description
    if not event['description_full'] or "[ariaEventDetailsWithLocation]" in event['description_full']:
        continue
    
    events.append(event)

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(events, f, indent=4)

print(f"Extracted {len(events)} valid events to events.json")
