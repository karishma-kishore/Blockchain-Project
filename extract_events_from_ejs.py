#!/usr/bin/env python3
"""
Extract event data from views/events.ejs and save to events.json
"""

import re
import json
import html
import os

ejs_path = '/Users/chiru/Desktop/Blockchain-Project/views/events.ejs'
json_path = '/Users/chiru/Desktop/Blockchain-Project/data/events.json'

# Create data directory if it doesn't exist
os.makedirs(os.path.dirname(json_path), exist_ok=True)

def clean_text(text):
    """Normalize whitespace in text"""
    if not text:
        return ""
    # Replace multiple whitespace with single space and strip
    return re.sub(r'\s+', ' ', text).strip()

with open(ejs_path, 'r', encoding='utf-8') as f:
    content = f.read()

events = []

# Find all event list items with actual event IDs (not templates)
# Pattern: <li class="list-group-item" id="event_XXXXXX">
event_pattern = r'<li class="list-group-item" id="event_(\d+)">(.*?)</li>\s*(?=<li class="|</ul>)'
event_matches = re.findall(event_pattern, content, re.DOTALL)

print(f"Found {len(event_matches)} events with IDs.")

for event_id, item in event_matches:
    event = {'id': int(event_id)}
    
    # Extract title from: <a href="..." aria-label="TITLE"...>TITLE</a>
    title_match = re.search(r'<h3 class="media-heading header-cg--h4">.*?<a[^>]*aria-label="([^"]+)"[^>]*>([^<]+)</a>', item, re.DOTALL)
    if title_match:
        event['title'] = clean_text(html.unescape(title_match.group(2)))
    else:
        # Fallback - get title from aria-label on listing-element
        aria_match = re.search(r'aria-label="([^,]+)', item)
        if aria_match:
            event['title'] = clean_text(html.unescape(aria_match.group(1)))
        else:
            event['title'] = "Unknown Event"
    
    # Extract image
    img_match = re.search(r'<img src="([^"]+)"[^>]*alt="Banner for', item)
    if img_match:
        event['image'] = clean_text(img_match.group(1))
    else:
        # Fallback to any img src
        img_match2 = re.search(r'<img[^>]*src="([^"]+)"', item)
        if img_match2:
            event['image'] = clean_text(img_match2.group(1))
        else:
            event['image'] = "images/listing-default.png"
    
    # Extract date/time from aria-label on listing-element div
    date_aria_match = re.search(r'aria-label="[^,]+,\s*([^"]+)"', item)
    if date_aria_match:
        event['date_display'] = clean_text(html.unescape(date_aria_match.group(1)))
    else:
        event['date_display'] = ""
    
    # Extract date from paragraph
    date_p_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">([^<]+)</p>', item, re.DOTALL)
    if date_p_match:
        event['date_line1'] = clean_text(html.unescape(date_p_match.group(1)))
    
    # Extract second date line if exists
    date_p2_match = re.search(r'aria-label="Event date".*?<p style="margin:0;">[^<]+</p>\s*<p style="margin:0;">([^<]+)</p>', item, re.DOTALL)
    if date_p2_match:
        event['date_line2'] = clean_text(html.unescape(date_p2_match.group(1)))
    
    # Extract timezone
    tz_match = re.search(r'</p>\s*(MST \(GMT[^)]+\))', item)
    if tz_match:
        event['timezone'] = clean_text(tz_match.group(1))
    else:
        event['timezone'] = "MST (GMT-7)"
    
    # Extract repeat info if exists
    repeat_match = re.search(r'<div>\(This Event will be Repeated ([^)]+)\)</div>', item)
    if repeat_match:
        event['repeat_info'] = clean_text(repeat_match.group(1))
    
    # Extract location
    loc_match = re.search(r'aria-label="Event location"[^>]*>.*?</div>\s*([^<]+)<p>', item, re.DOTALL)
    if loc_match:
        event['location'] = clean_text(html.unescape(loc_match.group(1)))
    else:
        event['location'] = ""
    
    # Extract attendee count
    attendee_match = re.search(r'class="grey-element mdi mdi-account[^>]*>[^<]*</span>\s*(\d+)\s*going', item)
    if attendee_match:
        event['attendees'] = int(attendee_match.group(1))
    else:
        event['attendees'] = 0
    
    # Extract tags
    tags = []
    tag_matches = re.findall(r'<span class="label label-default label-tag"[^>]*>(?:<span[^>]*>)?([^<]+)', item)
    for tag in tag_matches:
        tag_clean = clean_text(html.unescape(tag))
        if tag_clean:
            tags.append(tag_clean)
    event['tags'] = tags
    
    # Extract organizer/group name
    org_match = re.search(r'<p class="h6 grey-element">([^<]+)</p>', item)
    if org_match:
        event['organizer'] = clean_text(html.unescape(org_match.group(1)))
    else:
        event['organizer'] = ""
    
    # Check for badges (Live, FREE, etc.)
    event['badges'] = []
    if 'badge-danger' in item and '>Live<' in item:
        event['badges'].append('Live')
    if '>FREE<' in item or 'img-label">FREE<' in item:
        event['badges'].append('FREE')
    if 'badge-info' in item and '>Hybrid<' in item:
        event['badges'].append('Hybrid')
    
    # Extract description from aria-description
    desc_match = re.search(r'aria-description="Event link\. ([^"]+)"', item)
    if desc_match:
        event['aria_description'] = clean_text(html.unescape(desc_match.group(1)))
    
    events.append(event)

# Also extract day separators (Tomorrow, Today, etc.)
separator_pattern = r'<li class="list-group__separator">\s*<h2[^>]*>([^<]+)</h2>'
separators = re.findall(separator_pattern, content)
print(f"Found {len(separators)} day separators: {[clean_text(s) for s in separators]}")

# Save events to JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(events, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(events)} events to {json_path}")

# Print first few events for verification
if events:
    print("\nFirst 3 events:")
    for e in events[:3]:
        print(f"  - ID: {e['id']}, Title: {e['title'][:50]}...")

