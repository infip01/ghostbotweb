from flask import Flask, render_template, request, send_file, jsonify, Response, url_for
import requests
import json
import random
import io
import threading
import time
import os
import uuid
from requests.exceptions import HTTPError, ConnectionError, RequestException
from queue import Queue, Empty
import secrets
from functools import wraps
# Try to import Telegram bot functionality, make it optional for deployment
try:
    from telegram_bot import initialize_telegram_bot, send_generated_images
    TELEGRAM_BOT_AVAILABLE = True
except ImportError:
    print("Warning: telegram_bot module not found. Telegram functionality will be disabled.")
    TELEGRAM_BOT_AVAILABLE = False
    
    # Create dummy functions to prevent errors
    def initialize_telegram_bot(token, group_id):
        print("Telegram bot disabled - module not available")
        return None
    
    def send_generated_images(image_urls, prompt, model_name, seeds_used=None):
        print("Telegram bot disabled - would have sent images")
        pass

app = Flask(__name__)

# --- Telegram Bot Configuration ---
TELEGRAM_BOT_TOKEN = "8075529195:AAEIsCBp74oJG2ooIrx8k4B0NHGHqI4tggs"
TELEGRAM_GROUP_ID = "-1002502277172"

# Initialize Telegram bot
telegram_bot = initialize_telegram_bot(TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID)

# --- System-wide Concurrency and Cooldown ---
task_queue = Queue()
processing_semaphore = threading.Semaphore(5)
cooldown_lock = threading.Lock()
cooldown_until = 0

# --- IP-Based Rate Limiting ---
RATE_LIMIT = 3
RATE_LIMIT_WINDOW = 60
ip_requests = {}
ip_rate_limit_lock = threading.Lock()

# --- IP Reputation Caching ---
IP_REPUTATION_CACHE = {}
IP_REPUTATION_CACHE_TTL = 3600  # Cache results for 1 hour
ip_reputation_lock = threading.Lock()

# --- Manual IP Blocking ---
BLOCKED_IPS_FILE = 'blocked_ips.txt'
blocked_ips = set()

def load_blocked_ips():
    """Loads blocked IPs from the file into a set."""
    global blocked_ips
    if not os.path.exists(BLOCKED_IPS_FILE):
        blocked_ips = set()
        return
    with open(BLOCKED_IPS_FILE, 'r') as f:
        blocked_ips = set(line.strip() for line in f)

def save_blocked_ip(ip):
    """Saves a new IP to the blocked list."""
    with open(BLOCKED_IPS_FILE, 'a') as f:
        f.write(ip + '\n')
    blocked_ips.add(ip)

def unblock_ip(ip):
    """Removes an IP from the blocked list."""
    global blocked_ips
    load_blocked_ips() # Ensure we have the latest list
    if ip in blocked_ips:
        blocked_ips.remove(ip)
        with open(BLOCKED_IPS_FILE, 'w') as f:
            for blocked_ip in blocked_ips:
                f.write(blocked_ip + '\n')
        return True
    return False


# --- Authentication for Block Page ---
def check_auth(username, password):
    """This function is called to check if a username / password combination is valid."""
    return username == 'Infip' and password == '1217'

def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
    'Could not verify your access level for that URL.\n'
    'You have to login with proper credentials', 401,
    {'WWW-Authenticate': 'Basic realm="Login Required"'})

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated


# --- IP Reputation Checking and Blocking (CORRECTED) ---
def check_ip_reputation(ip):
    """
    Checks an IP against ipquery.io using a cache.
    Returns a dictionary {'blocked': Bool, 'reason': String}.
    """
    with ip_reputation_lock:
        if ip in IP_REPUTATION_CACHE:
            entry = IP_REPUTATION_CACHE[ip]
            if time.time() - entry['timestamp'] < IP_REPUTATION_CACHE_TTL:
                print(f"IP Reputation Cache HIT for {ip}.")
                return entry

    print(f"IP Reputation Cache MISS for {ip}. Querying ipquery.io...")
    # Correct, key-less API endpoint format
    api_url = f"https://api.ipquery.io/{ip}?format=json"

    try:
        response = requests.get(api_url, timeout=5)
        response.raise_for_status()
        data = response.json()

        # The risk flags are nested in a "risk" object
        risk_data = data.get("risk", {})
        block_reasons = []
        if risk_data.get("is_vpn"):
            block_reasons.append("VPN")
        if risk_data.get("is_tor"):
            block_reasons.append("Tor")
        if risk_data.get("is_proxy"):
            block_reasons.append("Proxy")
        if risk_data.get("is_datacenter"):
            block_reasons.append("Datacenter")

        result = {
            'blocked': len(block_reasons) > 0,
            'reason': ", ".join(block_reasons), # Will be empty if no reasons
            'timestamp': time.time()
        }

    except RequestException as e:
        print(f"Error calling ipquery.io: {e}. Allowing request by default (fail-open).")
        result = {'blocked': False, 'reason': '', 'timestamp': time.time()}

    with ip_reputation_lock:
        IP_REPUTATION_CACHE[ip] = result

    return result

@app.before_request
def block_undesirable_ips():
    """This function runs before every request to check the user's IP reputation."""
    # Allow access to static files and the block/unblock pages themselves without checks
    if request.endpoint in ['static', 'block_ip', 'unblock_ip_route']:
        return

    ip = request.headers.get('CF-Connecting-IP', request.remote_addr)

    # Check against manually blocked IPs first
    if ip in blocked_ips:
        print(f"Blocking manually blocked IP: {ip}")
        return render_template('access_denied.html', reason="Spamming Or Botting Or Automating With Same Prompt"), 403

    # Skip checks for local development to avoid blocking yourself
    if ip == '127.0.0.1':
        return

    reputation = check_ip_reputation(ip)

    if reputation['blocked']:
        reason_text = f"Use of an anonymizing service ({reputation['reason']}) is not permitted."
        print(f"Blocking request from IP {ip}. Reason: {reason_text}")
        return render_template('access_denied.html', reason=reason_text), 403


# --- All other functions remain the same ---

def handle_api_error(e):
    """Handles specific API errors like 429 and extracts meaningful error messages."""
    global cooldown_until
    
    # Try to extract error message from API response
    error_message = None
    if hasattr(e, 'response') and e.response is not None:
        try:
            error_data = e.response.json()
            # Try to extract error message from different possible structures
            if 'error' in error_data:
                if isinstance(error_data['error'], dict) and 'message' in error_data['error']:
                    error_message = error_data['error']['message']
                elif isinstance(error_data['error'], str):
                    error_message = error_data['error']
            elif 'message' in error_data:
                error_message = error_data['message']
        except (ValueError, KeyError):
            # If JSON parsing fails or expected keys are missing, use default handling
            pass
    
    if isinstance(e, HTTPError) and e.response.status_code == 429:
        print("Error 429: Too Many Requests. Initiating 5-minute cooldown.")
        with cooldown_lock:
            cooldown_until = time.time() + 300
        return {'success': False, 'error': 'Rate limit hit. Cooling down for 5 minutes.'}
    elif isinstance(e, HTTPError) and error_message:
        print(f"API Error {e.response.status_code}: {error_message}")
        return {'success': False, 'error': error_message}
    elif isinstance(e, ConnectionError):
        print(f"Connection Error: {e}")
        return {'success': False, 'error': 'Could not connect to the image generation API.'}
    else:
        print(f"An unexpected error occurred: {e}")
        if error_message:
            return {'success': False, 'error': error_message}
        else:
            return {'success': False, 'error': 'An unexpected error occurred during the API call.'}

def generate_uncen_image(task_data):
    """Dedicated function to process requests for the 'uncen' model."""
    print(f"Processing 'uncen' request. Prompt: {task_data.get('prompt', '')[:30]}...")

    api_url = "https://api.infip.pro/gen"
    headers = {'accept': 'application/json', 'Content-Type': 'application/json'}

    payload = {
        "prompt": task_data.get('prompt'),
        "num_images": 1,
        "seed": 0, # Always use random seed
        "aspect_ratio": task_data.get('aspect_ratio', 'IMAGE_ASPECT_RATIO_SQUARE'),
        "models": "uncen"
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        image_urls = result.get('images', [])
        seeds_used = [result.get('seed')] * len(image_urls)
        return {'image_urls': image_urls, 'seeds_used': seeds_used, 'success': len(image_urls) > 0}
    except (HTTPError, ConnectionError, Exception) as e:
        return handle_api_error(e)

def generate_kontext_images(task_data):
    """Processes requests for Kontext models."""
    model = task_data.get('model')
    num_images = task_data.get('num_images', 4)
    aspect_ratio = task_data.get('aspect_ratio', 'IMAGE_ASPECT_RATIO_SQUARE')
    
    # Flux 1.1 Pro and Flux Pro only support 1 image
    if model in ['flux-1-1-pro', 'flux-pro']:
        num_images = 1
    
    print(f"Processing '{model}' request for {num_images} images. Prompt: {task_data.get('prompt', '')[:30]}...")
    
    # Map frontend model names to API model names
    model_mapping = {
        'kontext-max': 'black-forest-labs/FLUX.1-kontext-max',
        'kontext-pro': 'black-forest-labs/FLUX.1-kontext-pro',
        'flux-1-1-pro': 'black-forest-labs/FLUX.1.1-pro',
        'flux-dev': 'black-forest-labs/FLUX.1-dev',
        'flux-pro': 'black-forest-labs/FLUX.1-pro',
        'flux-schnell': 'black-forest-labs/FLUX.1-schnell'
    }
    
    api_model = model_mapping.get(model, model)
    
    api_url = "https://api.together.xyz/v1/images/generations"
    headers = {
        'Authorization': 'Bearer 56c8eeff9971269d7a7e625ff88e8a83a34a556003a5c87c289ebe9a3d8a3d2c',
        'Content-Type': 'application/json'
    }
    
    # Base payload
    payload = {
        "model": api_model,
        "prompt": task_data.get('prompt'),
        "n": num_images
    }
    
    # Add dimensions for models that require them (not Kontext models)
    if model not in ['kontext-max', 'kontext-pro']:
        payload.update({
            "width": 1024,
            "height": 1024
        })
    
    # Add steps for certain models
    if model in ['flux-dev', 'flux-schnell']:
        payload["steps"] = 4 if model == 'flux-schnell' else 28
    
    # Add image_url parameter if provided
    if task_data.get('image_url'):
        image_url = task_data.get('image_url')
        print(f"Processing image URL: {image_url}")
        
        # All uploaded images are now hosted on Snapzion CDN, so treat as external URLs
        print(f"Using image URL: {image_url}")
        payload["image_url"] = image_url
    
    try:
        print(f"Sending request to Together API with payload keys: {list(payload.keys())}")
        response = requests.post(api_url, headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"API Error Response: {response.status_code}")
            print(f"Response text: {response.text}")
        
        response.raise_for_status()
        result = response.json()
        
        # Extract image URLs from the response
        image_urls = []
        if result.get('data'):
            for item in result['data']:
                if item.get('url'):
                    image_urls.append(item['url'])
        
        # Generate dummy seeds for consistency with existing code
        seeds_used = [random.randint(1000000, 9999999) for _ in image_urls]
        
        return {'image_urls': image_urls, 'seeds_used': seeds_used, 'success': len(image_urls) > 0}
    except (HTTPError, ConnectionError, Exception) as e:
        print(f"Exception in API call: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Error response content: {e.response.text}")
        return handle_api_error(e)

def generate_standard_images(task_data):
    """Processes requests for standard models like 'img3', 'img4', and 'gpt-image-1'."""
    model = task_data.get('model', 'img3')
    num_images = task_data.get('num_images', 4)

    print(f"Processing '{model}' request for {num_images} images. Prompt: {task_data.get('prompt', '')[:30]}...")

    images_per_call = num_images

    image_urls, seeds_used = [], []
    api_url = "https://api.infip.pro/gen"
    headers = {'accept': 'application/json', 'Content-Type': 'application/json'}

    payload = {
        "prompt": task_data.get('prompt'),
        "num_images": images_per_call,
        "seed": 0, # Always use random seed
        "aspect_ratio": task_data.get('aspect_ratio', 'IMAGE_ASPECT_RATIO_SQUARE'),
        "models": model
    }
    try:
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()

        if result.get('images'):
            current_images = result.get('images')
            image_urls.extend(current_images)
            if result.get('seed'):
                seeds_used.extend([result.get('seed')] * len(current_images))
    except (HTTPError, ConnectionError, Exception) as e:
        error_result = handle_api_error(e)
        final_result = {'image_urls': image_urls, 'seeds_used': seeds_used, 'success': len(image_urls) > 0}
        final_result['error'] = error_result.get('error')
        return final_result

    return {'image_urls': image_urls, 'seeds_used': seeds_used, 'success': len(image_urls) > 0}

def worker():
    """The worker thread function. Routes tasks to the correct processor."""
    while True:
        task_data, result_queue = task_queue.get()
        print(f"Worker picked up task. Waiting for a free slot... Queue size: {task_queue.qsize()}")

        with processing_semaphore:
            print(f"Slot acquired. Processing prompt: {task_data.get('prompt', '')[:30]}...")

            with cooldown_lock:
                wait_time = cooldown_until - time.time()
            if wait_time > 0:
                print(f"Worker is observing 429 cooldown. Waiting for {int(wait_time)} seconds.")
                time.sleep(wait_time)

            try:
                model = task_data.get('model')
                if model == 'uncen':
                    result = generate_uncen_image(task_data)
                elif model in ['kontext-max', 'kontext-pro', 'flux-1-1-pro', 'flux-dev', 'flux-pro', 'flux-schnell']:
                    result = generate_kontext_images(task_data)
                else:
                    result = generate_standard_images(task_data)
                result_queue.put(result)
            except Exception as e:
                print(f"Critical error in worker thread: {e}")
                result_queue.put({'success': False, 'error': 'A critical error occurred in the worker.'})

        task_queue.task_done()
        print("Worker finished task and freed a slot.")

for i in range(5):
    threading.Thread(target=worker, daemon=True).start()

@app.route('/api/generate', methods=['POST'])
def api_generate():
    """API endpoint with multi-layered security checks before queueing a task."""
    ip = request.headers.get('CF-Connecting-IP', request.remote_addr)
    data = request.get_json()

    time_elapsed = data.get('time_elapsed', 0)
    if time_elapsed < 2:
        print(f"Bot detected for IP {ip} (submission time: {time_elapsed}s). Request rejected.")
        return jsonify({'success': False, 'error': 'Request rejected as potential automation.'}), 400

    with ip_rate_limit_lock:
        current_time = time.time()
        stale_ips = [ip for ip, data in ip_requests.items() if current_time - data['start_time'] > RATE_LIMIT_WINDOW]
        for ip_addr in stale_ips:
            del ip_requests[ip_addr]

        if ip not in ip_requests:
            ip_requests[ip] = {'count': 1, 'start_time': current_time}
        else:
            if ip_requests[ip]['count'] >= RATE_LIMIT:
                print(f"Rate limit exceeded for IP: {ip}")
                return jsonify({'success': False, 'error': 'Rate limit exceeded. Please try again in a minute.'}), 429
            else:
                ip_requests[ip]['count'] += 1

    try:
        if not data.get('prompt', '').strip():
            return jsonify({'success': False, 'error': 'Prompt is required'}), 400

        result_queue = Queue()
        worker_data = {
            'prompt': data.get('prompt'),
            'num_images': data.get('num_images'),
            'aspect_ratio': data.get('aspect_ratio'),
            'model': data.get('model'),
            'image_url': data.get('image_url')
        }
        task_queue.put((worker_data, result_queue))
        print(f"Request from IP {ip} for prompt '{data.get('prompt', '')[:30]}...' added to queue. Queue size: {task_queue.qsize()}")

        result = result_queue.get(timeout=600)
        
        # Send images to Telegram if generation was successful
        if result.get('success') and result.get('image_urls'):
            try:
                model_name = worker_data.get('model', 'unknown')
                prompt = worker_data.get('prompt', '')
                seeds_used = result.get('seeds_used', [])
                
                # Send to Telegram group
                send_generated_images(
                    image_urls=result['image_urls'],
                    prompt=prompt,
                    model_name=model_name,
                    seeds_used=seeds_used
                )
                print(f"Images queued for Telegram delivery. Model: {model_name}, Images: {len(result['image_urls'])}")
            except Exception as e:
                print(f"Error queueing images for Telegram: {e}")
                # Don't fail the API response if Telegram sending fails
        
        return jsonify(result)

    except Empty:
        print("Request timed out waiting for a response from the worker.")
        return jsonify({'success': False, 'error': 'Your request timed out in the queue. The server is busy.'}), 504
    except Exception as e:
        print(f"Error in /api/generate route: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/models')
def models():
    """Renders the models page."""
    return render_template('models.html')

@app.route('/api')
def api():
    """Renders the API documentation page."""
    return render_template('api.html')

@app.route('/block', methods=['GET', 'POST'])
@requires_auth
def block_ip():
    """Provides a page to manually block an IP address."""
    message = ''
    if request.method == 'POST':
        ip_to_block = request.form.get('ip')
        if ip_to_block:
            save_blocked_ip(ip_to_block)
            message = f"Successfully blocked IP: {ip_to_block}"
            print(f"ADMIN ACTION: Manually blocked IP {ip_to_block}")
    return render_template('block.html', message=message)

@app.route('/unblock', methods=['POST'])
@requires_auth
def unblock_ip_route():
    """Handles unblocking an IP address."""
    message = ''
    ip_to_unblock = request.form.get('ip')
    if ip_to_unblock:
        if unblock_ip(ip_to_unblock):
            message = f"Successfully unblocked IP: {ip_to_unblock}"
            print(f"ADMIN ACTION: Manually unblocked IP {ip_to_unblock}")
        else:
            message = f"IP {ip_to_unblock} was not found in the block list."
    return render_template('block.html', message=message)


@app.route('/api/generate-key', methods=['GET'])
def generate_api_key():
    """
    Fetches a new API key from the internal API service.
    """
    internal_api_url = "http://localhost:1217/generate-api-key"
    try:
        user_ip = request.headers.get('CF-Connecting-IP', request.remote_addr)
        headers = {'CF-Connecting-IP': user_ip}
        
        response = requests.get(internal_api_url, headers=headers, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())

    except RequestException as e:
        print(f"Error calling internal API service: {e}")
        return jsonify({'error': 'The API key service is currently unavailable. Please try again later.'}), 503

@app.route('/api/telegram-status')
def telegram_status():
    """Get Telegram bot status and queue information."""
    if not TELEGRAM_BOT_AVAILABLE:
        return jsonify({
            'bot_initialized': False,
            'error': 'Telegram bot module not available',
            'send_queue_size': 0,
            'retry_queue_size': 0
        })
    
    try:
        from telegram_bot import get_telegram_bot
        bot = get_telegram_bot()
        
        if not bot:
            return jsonify({'error': 'Telegram bot not initialized'}), 500
        
        status = bot.get_queue_status()
        return jsonify({
            'bot_initialized': True,
            'send_queue_size': status['send_queue_size'],
            'retry_queue_size': status['retry_queue_size']
        })
    except Exception as e:
        return jsonify({'error': f'Error getting Telegram status: {str(e)}'}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload for image generation."""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    # Check file extension
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
    file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    
    if file_extension not in allowed_extensions:
        return jsonify({'success': False, 'error': 'Invalid file format. Please upload PNG, JPG, JPEG, GIF, BMP, or WebP files.'}), 400
    
    try:
        # Upload to Snapzion service
        snapzion_url = "https://upload.snapzion.com/api/public-upload"
        headers = {
            "Authorization": "Bearer NAI-PQUXIcD24u7afjAyYRKmeJMqSWnH1u0F6PEfmQaWiCKsUrvpG2KsQFzqmgKV"
        }
        
        # Read the file content
        file.seek(0)  # Reset file pointer to beginning
        file_content = file.read()
        
        # Prepare the file for upload (matching the curl format exactly)
        files = {
            'file': (file.filename, file_content, f'image/{file_extension}')
        }
        
        print(f"Uploading file {file.filename} to Snapzion...")
        print(f"File size: {len(file_content)} bytes")
        print(f"Content type: image/{file_extension}")
        
        # Upload to Snapzion
        response = requests.post(snapzion_url, headers=headers, files=files, timeout=30)
        
        print(f"Snapzion response status: {response.status_code}")
        print(f"Snapzion response headers: {dict(response.headers)}")
        print(f"Snapzion response: {response.text}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                if 'url' in result:
                    file_url = result['url']
                    print(f"Successfully uploaded to Snapzion: {file_url}")
                    
                    return jsonify({
                        'success': True,
                        'file_url': file_url,
                        'filename': file.filename
                    })
                else:
                    print(f"No 'url' field in Snapzion response: {result}")
                    return jsonify({'success': False, 'error': 'Invalid response from upload service'}), 500
            except ValueError as e:
                print(f"Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text}")
                return jsonify({'success': False, 'error': 'Invalid JSON response from upload service'}), 500
        else:
            print(f"Snapzion upload failed with status {response.status_code}")
            print(f"Error response: {response.text}")
            return jsonify({'success': False, 'error': f'Upload service returned status {response.status_code}'}), 500
        
    except requests.exceptions.Timeout:
        print("Snapzion upload timed out")
        return jsonify({'success': False, 'error': 'Upload service timed out'}), 500
    except requests.exceptions.RequestException as e:
        print(f"Network error uploading to Snapzion: {e}")
        return jsonify({'success': False, 'error': 'Network error during upload'}), 500
    except Exception as e:
        print(f"Unexpected error uploading file: {e}")
        return jsonify({'success': False, 'error': 'Unexpected error during upload'}), 500


@app.route('/download/<path:image_url>')
def download_image(image_url):
    try:
        response = requests.get(image_url, stream=True)
        response.raise_for_status()
        image_name = image_url.split('/')[-1]
        
        # Determine the correct MIME type and file extension
        content_type = response.headers.get('content-type', '').lower()
        
        # Map content types to file extensions
        extension_map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/bmp': '.bmp',
            'image/webp': '.webp'
        }
        
        # Check if the filename already has a valid image extension
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        has_extension = any(image_name.lower().endswith(ext) for ext in valid_extensions)
        
        # If no extension or invalid extension, add the correct one based on content-type
        if not has_extension:
            if content_type in extension_map:
                extension = extension_map[content_type]
                mimetype = content_type
            else:
                # Default to .jpg if content-type is unknown
                extension = '.jpg'
                mimetype = 'image/jpeg'
            
            # Remove any existing extension and add the correct one
            base_name = image_name.split('.')[0] if '.' in image_name else image_name
            download_filename = f"{base_name}{extension}"
        else:
            # Use the existing filename and determine mimetype from extension
            download_filename = image_name
            file_ext = image_name.lower().split('.')[-1]
            mime_type_map = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
            }
            mimetype = mime_type_map.get(file_ext, 'image/jpeg')
        
        return send_file(
            io.BytesIO(response.content),
            mimetype=mimetype,
            as_attachment=True,
            download_name=download_filename
        )
    except Exception as e:
        print(f"Error downloading image: {e}")
        return "Error downloading image", 500

if __name__ == '__main__':
    load_blocked_ips()
    print("=" * 50)
    print("Image Generation Server Starting")
    print(f"Loaded {len(blocked_ips)} manually blocked IPs.")
    print("Processing Model: Concurrent Batch of 5")
    print("IP Rate Limiting: 3 Requests/Minute per IP")
    print("Security: Timing Analysis Enabled")
    print("Security: VPN/Proxy/Tor Blocking is ENABLED.")
    
    if TELEGRAM_BOT_AVAILABLE:
        print("Telegram Bot: ENABLED")
        print(f"Telegram Group ID: {TELEGRAM_GROUP_ID}")
        print("Auto-sending generated images to Telegram group")
    else:
        print("Telegram Bot: DISABLED (module not available)")
        print("Images will not be sent to Telegram")
    
    print("=" * 50)
    app.run(host='0.0.0.0', port=1218, debug=False)