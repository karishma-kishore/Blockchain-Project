#!/usr/bin/env python3
"""
Modify events.ejs to use EJS templating for dynamic event rendering
This script replaces the hardcoded event list with an EJS loop
"""

import re

ejs_path = '/Users/chiru/Desktop/Blockchain-Project/views/events.ejs'
output_path = '/Users/chiru/Desktop/Blockchain-Project/views/events.ejs'

with open(ejs_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of the event list (after <ul id="divAllItems">)
# The events start after line 16470 approximately
start_marker = '<ul id="divAllItems" class="list-group">'
end_marker_pattern = r'</ul>\s*</cg-listing>'

# Find start position
start_pos = content.find(start_marker)
if start_pos == -1:
    print("Could not find start marker")
    exit(1)

# Find the position right after the start marker
start_content_pos = start_pos + len(start_marker)

# Find end position - the </ul> closing tag for divAllItems
# Looking for the pattern </ul> followed by </cg-listing>
end_match = re.search(end_marker_pattern, content[start_content_pos:])
if not end_match:
    print("Could not find end marker")
    exit(1)

end_content_pos = start_content_pos + end_match.start()

# Extract what we're replacing
old_content = content[start_content_pos:end_content_pos]
print(f"Found event list section: {len(old_content)} characters")
print(f"First 200 chars: {old_content[:200]}...")
print(f"Last 200 chars: ...{old_content[-200:]}")

# Create the new EJS template content
new_content = '''

                                <%# Dynamic event list rendered from JSON data %>
                                <% if (events && events.length > 0) { %>
                                    <% let currentDate = ''; %>
                                    <% events.forEach(function(event, index) { %>
                                        <%# Date separator - group events by day %>
                                        <% 
                                            const eventDate = event.date_line1 ? event.date_line1.split(' ').slice(0, 3).join(' ') : '';
                                            if (eventDate !== currentDate) { 
                                                currentDate = eventDate;
                                        %>
                                        <li class="list-group__separator">
                                            <h2 class="header-cg--h4" role="region" aria-label="Events on <%= currentDate %>"><%= currentDate || 'Upcoming' %></h2>
                                        </li>
                                        <% } %>
                                        
                                        <%- include('partials/event-item', { event: event }) %>
                                    <% }); %>
                                <% } else { %>
                                    <li style="display: block;">
                                        <div id="no_result_img" style="height: 80px;width: 80px;margin: 0px auto;margin-top:30px;margin-bottom:25px; background:url(/images/listing-noresult.png) no-repeat;"></div>
                                        <div id="no_result_txt" style="text-align:center;line-height:0px;margin-bottom:40px;font-size:16px;color:#4c728d;">No events found</div>
                                    </li>
                                <% } %>

                            '''

# Replace the old content with the new content
new_file_content = content[:start_content_pos] + new_content + content[end_content_pos:]

# Write the modified file
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(new_file_content)

print(f"Successfully modified {output_path}")
print(f"Original file size: {len(content)} bytes")
print(f"New file size: {len(new_file_content)} bytes")
print(f"Reduced by: {len(content) - len(new_file_content)} bytes")
