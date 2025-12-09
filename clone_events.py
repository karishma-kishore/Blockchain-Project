import urllib.request
import urllib.parse
import re
import os
import json

# Configuration
INPUT_FILE = "copied_events.html"
OUTPUT_FILE = "events.html"
BASE_URL = "https://sundevilcentral.eoss.asu.edu"

# Create directories if they don't exist
DIRS = ["images", "css", "js", "fonts"]
for d in DIRS:
    if not os.path.exists(d):
        os.makedirs(d)

def download_asset(url, directory):
    try:
        if not url.startswith('http'):
            # Handle absolute paths like /images/...
            if url.startswith('/'):
                url = BASE_URL + url
            else:
                # Handle relative paths? Expecting potential issues here if base not handled
                url = BASE_URL + '/' + url
        
        filename = os.path.basename(urllib.parse.urlparse(url).path)
        # Remove query parameters from filename
        if '?' in filename:
            filename = filename.split('?')[0]
            
        filepath = os.path.join(directory, filename)
        
        if not os.path.exists(filepath):
            print(f"Downloading {url} to {filepath}...")
            # rudimentary header to avoid some 403s
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
        
        return f"{directory}/{filename}"
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return url

def process_content_for_assets(content):
    # This regex is a bit simplistic, might need refinement
    # Look for src="..." and href="..."
    
    def replace_link(match):
        prefix = match.group(1) # src=" or href="
        url = match.group(2)
        
        if 'sundevilcentral.eoss.asu.edu' in url or url.startswith('/'):
            # Determine type based on extension or context
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
            
            if ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico']:
                new_path = download_asset(url, 'images')
                return f'{prefix}"{new_path}"'
            elif ext == '.css':
                new_path = download_asset(url, 'css')
                return f'{prefix}"{new_path}"'
            elif ext == '.js':
                new_path = download_asset(url, 'js')
                return f'{prefix}"{new_path}"'
            # simplified font handling (fonts usually inside css, handled separately or manual fix?)
            # clone_home.py had issue with fonts in css. 
            
        return match.group(0)

    # Regex to capture src="URL" or href="URL"
    # Handling both ' and " quotes
    pattern = re.compile(r'(src=|href=)["\']([^"\']+)["\']', re.IGNORECASE)
    return pattern.sub(replace_link, content)

def main():
    print(f"Reading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Processing assets...")
    content = process_content_for_assets(content)

    # Manual fixes for navigation specific to this project
    # Link "Home" back to home.html
    content = content.replace('href="/web_app?id=24040"', 'href="home.html"')
    # Fix Logout to index.html ? (General cleanup)
    content = content.replace('href="/logout"', 'href="index.html"')
    
    # Remove Client Side Redirects if any (similar to home)
    # The previous target_home.html had window.location.href redirects.
    # copied_events.html might have: history.replaceState, etc.
    # Let's inspect the file content more closely or just blindly comment known patterns.
    # pattern: <script> ... window.location.href ... </script>
    
    # Just writing output for now
    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Done.")

if __name__ == "__main__":
    main()
