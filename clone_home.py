
import os
import re
import urllib.request
import urllib.parse
import json

# Configuration
BASE_URL = "https://sundevilcentral.eoss.asu.edu"
INPUT_FILE = "target_home.html" # Using the manually edited file
OUTPUT_FILE = "home.html"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Headers to mimic browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': BASE_URL + '/web_app',
    'Origin': BASE_URL
}

# Function to ensure directory exists
def ensure_dir(file_path):
    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)

# Function to download file
def download_file(url, local_path):
    if os.path.exists(local_path):
        # We might want to overwrite if we are unsure, but skipping speeds it up
        # print(f"Skipping (already exists): {local_path}")
        return True
    
    try:
        ensure_dir(local_path)
        print(f"Downloading: {url} -> {local_path}")
        
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
            out_file.write(response.read())
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

# Processor for asset links
def process_content_for_assets(content, current_base_url):
    processed_urls = set()

    def replace_link(match):
        attr = match.group(1) # href or src
        quote = match.group(2) # " or '
        url_val = match.group(3)
        
        if not url_val:
            return match.group(0)
            
        if url_val.startswith('data:') or url_val.startswith('#') or url_val.startswith('mailto:') or url_val.startswith('javascript:'):
            return match.group(0)
            
        # Resolve absolute URL
        full_url = urllib.parse.urljoin(current_base_url, url_val)
        
        # Determine local path
        parsed_url = urllib.parse.urlparse(full_url)
        path = parsed_url.path
        if path.startswith('/'):
            path = path[1:]
        
        # Ignore empty paths or root
        if not path or path == "/":
            return match.group(0)

        clean_path = urllib.parse.unquote(path)
        local_path = os.path.join(PROJECT_DIR, clean_path)
        
        # Extension check
        ext = os.path.splitext(clean_path)[1].lower()
        static_exts = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico']
        
        is_static = any(clean_path.endswith(x) for x in static_exts)
        
        # Special case: profiles often don't have extension but are images
        if 'image_upload' in clean_path or 'upload/' in clean_path:
             is_static = True

        if is_static:
            if full_url not in processed_urls:
                processed_urls.add(full_url)
                # print(f"Asset found: {full_url}")
                download_file(full_url, local_path)

            return f'{attr}={quote}{clean_path}{quote}'
        else:
            return match.group(0)

    # Regex for attributes
    pattern = re.compile(r'(href|src)=("|\')([^"\']+?)("|\')', re.IGNORECASE)
    return pattern.sub(replace_link, content)


def extract_session_info(content):
    # simple regex to find csrf_token and jwt in window.cg.session
    csrf_match = re.search(r'csrf_token:\s*"([^"]+)"', content)
    jwt_match = re.search(r'jwt:\s*"([^"]+)"', content)
    
    if csrf_match and jwt_match:
        return csrf_match.group(1), jwt_match.group(1)
    return None, None

def main():
    print(f"Reading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 1. Extract session tokens
    csrf_token, jwt_token = extract_session_info(html_content)
    if not jwt_token:
        print("Could not find JWT token in input file. Make sure window.cg.session is present.")
        return

    print("Found session tokens. Fetching dynamic content...")
    
    # 2. Fetch the dynamic content
    # URL found in target_home: /page?id=237&ax=1&app_id=24040
    # Full URL: https://sundevilcentral.eoss.asu.edu/page?id=237&ax=1&app_id=24040
    # Needs headers!
    
    # dynamic_url = "https://sundevilcentral.eoss.asu.edu/page?id=237&ax=1&app_id=24040"
    
    # We need to construct a robust request with cookie/auth
    # Usually JWT is sent in Authorization header OR cookie?
    # Based on standard practices or observed JS behavior? 
    # In many apps using 'cg.session', it might be sent in 'Authorization: Bearer <jwt>' or 'X-CSRF-Token'.
    
    req_headers = HEADERS.copy()
    req_headers['Authorization'] = f'Bearer {jwt_token}' # Try Bearer first
    req_headers['X-CSRF-Token'] = csrf_token
    # Also add it as a cookie just in case, though JWT is usually header.
    # The 'jwt' string in the file looks like a standard JWT.
    
    # try:
    #     req = urllib.request.Request(dynamic_url, headers=req_headers)
    #     with urllib.request.urlopen(req) as response:
    #         dynamic_content = response.read().decode('utf-8')
        
    #     print("Fetched dynamic content successfully.")
        
    #     # 3. Inject dynamic content into the shell
    #     # Look for <div id="web_app-wrapper">...</div>
    #     # Replace the inner HTML or the whole div
        
    #     # We want to replace the loader inside #web_app-wrapper
    #     # Regex to find <div id="web_app-wrapper">...</div>
    #     # It might be multiline.
        
    #     wrapper_start = html_content.find('id="web_app-wrapper"')
    #     if wrapper_start != -1:
    #          # Find the closing tag for this div. A bit risky with simple find, but let's try.
    #          # Actually, simpler: just find the string that is currently there.
    #          # <p class='loader' style="margin-top:300px;"> ... </p>
    #          # and replace it.
             
    #          # Let's find the closing > of the opening tag
    #          div_open_end = html_content.find('>', wrapper_start)
             
    #          # We assume the content ends before the script tag that calls getContent
    #          # <script type="text/javascript">getContent...
    #          script_start = html_content.find('getContent("web_app-wrapper"', div_open_end)
             
    #          # Locate where the div likely ends. 
    #          # Or we can just insert the content AFTER the opening tag? 
    #          # But we should remove the "Loading..." part.
             
    #          # Regex approach for the div content
    #          # <div id="web_app-wrapper"> ... </div>
    #          # Since we know the structure in the file seems to be:
    #          # <div id="web_app-wrapper">
    #          #    <p class='loader...
    #          #    ...
    #          #    </p>
    #          # </div>
             
    #          # Pattern: (<div id="web_app-wrapper">)([\s\S]*?)(</div>)
    #          # But identifying the matching </div> is hard with regex.
             
    #          # Alternative: Just replace the entire BODY with the dynamic content?
    #          # NO, the dynamic content is just the "page". The shell (header/sidebar) is in target_html2.
             
    #          # Let's just EMPTY the div and fill it.
    #          # A SAFE way: Replace the known loading content.
    #          loading_snippet_start = html_content.find('<p class=\'loader\'', div_open_end)
    #          loading_snippet_end = html_content.find('</div>', loading_snippet_start)
             
    #          if loading_snippet_start != -1 and loading_snippet_end != -1:
    #              # Construct new content
    #              new_html = html_content[:div_open_end+1] + "\n" + dynamic_content + "\n" + html_content[loading_snippet_end:]
    #          else:
    #              print("Warning: Could not find loading spinner to replace. Appending content instead.")
    #              new_html = html_content[:div_open_end+1] + dynamic_content + html_content[div_open_end+1:]
    #     else:
    #         print("Warning: Could not find web_app-wrapper. Saving as is.")
    #         new_html = html_content

    # except Exception as e:
    #     print(f"Failed to fetch dynamic content: {e}")
    #     # Only process assets on the original content if fetch fails
    new_html = html_content

    # 4. Process assets (download and rewrite links)
    # We do this on the FULL merged content now.
    final_html = process_content_for_assets(new_html, BASE_URL)
    
    # 5. Fix Navigation links (Home -> home.html, Logout -> index.html)
    # We can do this with regex or string replacement
    
    # Fix Logout
    final_html = final_html.replace('href="/logout"', 'href="index.html"')
    
    # Fix Home (sidebar and topbar)
    # They often look like href="/web_app?id=24040..."
    # We want them to go to "home.html"
    # And remove onclick="transitionAppNav..."
    
    # Regex to clean up Home links
    # Pattern: href="/web_app\?id=24040[^"]*"[^>]*onclick="[^"]*"
    # This is tricky because attributes order varies.
    
    # Simpler: Replace specific hrefs known to be Home.
    # From grep: href="/web_app?id=24040" and href="/web_app?id=24040&menu_id=56483&if=0&"
    
    final_html = final_html.replace('href="/web_app?id=24040"', 'href="home.html"')
    final_html = final_html.replace('href="/web_app?id=24040&menu_id=56483&if=0&"', 'href="home.html"')
    
    # Remove the onClick handlers for these?
    # We can just remove 'onClick="transitionAppNav..."' globally? 
    # Might break other things.
    # But for Home link specifically?
    # Let's simple-replace the string that was in the file:
    # onClick="transitionAppNav('/web_app?id=24040&menu_id=56483&if=0&', { appId: '24040' }); return false;"
    
    final_html = final_html.replace(
        "onClick=\"transitionAppNav('/web_app?id=24040&menu_id=56483&if=0&', { appId: '24040' }); return false;\"",
        ""
    )
    
    # Also for the other Home link if present
    
    
    # 6. Save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(final_html)
    print(f"Done. Saved detailed clone to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
