import os
import json
import requests
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv


load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['JSON_ENSURE_ASCII'] = False

# 🔧 LM Studio URL (OpenAI-compatible API)
LM_STUDIO_URL = os.getenv('LM_STUDIO_URL', 'http://localhost:1234/v1/chat/completions')

SYSTEM_PROMPT = """"""


def get_loaded_models():
    """Gets list of models from LM Studio"""
    try:
        models_url = LM_STUDIO_URL.replace('/chat/completions', '/models')
        resp = requests.get(models_url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = []
            for m in data.get("data", []):
                # Skip embedding models
                if "embedding" not in m.get("id", "").lower():
                    models.append({"id": m["id"], "name": m["id"]})
            return models if models else [{"id": "local-model", "name": "Local Model"}]
    except Exception:
        pass
    return [{"id": "local-model", "name": "Local Model (LM Studio)"}]


@app.route('/')
def index():
    models = get_loaded_models()
    return render_template('index.html', models=models)


@app.route('/api/models')
def api_models():
    return jsonify(get_loaded_models())


def build_headers():
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer lm-studio",  # LM Studio accepts any token
    }


@app.route('/api/chat', methods=['POST'])
def chat():
    """Regular chat — returns full response (without streaming)"""
    try:
        raw = request.get_data()
        data = json.loads(raw.decode('utf-8'))
        messages = data.get('messages', [])
        model = data.get('model', 'local-model')

        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

        payload = {
            "model": model,
            "messages": full_messages,
            "stream": False,
            "temperature": 0.7,
            "max_tokens": 2048
        }

        response = requests.post(
            LM_STUDIO_URL,
            headers=build_headers(),
            data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
            timeout=120
        )

        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content']
            return jsonify({
                'success': True,
                'response': content,
                'usage': result.get('usage', {}),
                'model': result.get('model', model)
            })
        else:
            return jsonify({
                'success': False,
                'error': f"LM Studio Error: {response.status_code} - {response.text}"
            }), response.status_code

    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': "Failed to connect to LM Studio. Make sure the server is running on port 1234."
        }), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """Streaming chat — streams content and reasoning_content in real-time"""
    raw = request.get_data()
    print("RAW REQUEST:", raw)
    data = json.loads(raw.decode('utf-8'))
    print("DECODED:", data)
    messages = data.get('messages', [])
    model = data.get('model', 'local-model')

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    payload = {
        "model": model,
        "messages": full_messages,
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 2048  # Important for reasoning models
    }

    def generate():
        response = None
        try:
            encoded = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            print("SENDING TO LM STUDIO:", encoded)
            response = requests.post(
                LM_STUDIO_URL,
                headers=build_headers(),
                data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                stream=True,
                timeout=180  # Increased for long "reasoning" phases
            )

            for line in response.iter_lines():
                if not line:
                    continue
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data_str = line[6:].strip()
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        if chunk.get('choices'):
                            delta = chunk['choices'][0].get('delta', {})
                            
                            # 🔧 Send final response (content)
                            if delta.get('content'):
                                yield f"data: {json.dumps({'type': 'content', 'data': delta['content']}, ensure_ascii=False)}\n\n"
                            
                            # 🔧 Send model's "thoughts" (reasoning_content)
                            if delta.get('reasoning_content'):
                                yield f"data: {json.dumps({'type': 'reasoning', 'data': delta['reasoning_content']}, ensure_ascii=False)}\n\n"
                                
                    except json.JSONDecodeError:
                        continue

            yield "data: [DONE]\n\n"

        except GeneratorExit:
            if response and hasattr(response, 'close'):
                response.close()
            raise
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'type': 'error', 'data': 'No connection to LM Studio'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


@app.route('/api/health')
def health():
    """Check connection status with LM Studio"""
    try:
        models_url = LM_STUDIO_URL.replace('/chat/completions', '/models')
        resp = requests.get(models_url, timeout=3)
        lm_status = "ok" if resp.status_code == 200 else "error"
        models_count = len(resp.json().get("data", [])) if resp.status_code == 200 else 0
    except:
        lm_status = "unreachable"
        models_count = 0
    
    return jsonify({
        "status": "ok",
        "lm_studio": lm_status,
        "models_count": models_count
    })


if __name__ == '__main__':
    print("Starting Flask server for LM Studio...")
    print(f"LM Studio: {LM_STUDIO_URL}")
    print("Available at:")
    print("     Local: http://localhost:5000")
    
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        print(f"    From phone: http://{local_ip}:5000")
    except:
        print(" From phone: http://<YOUR_IP>:5000")
    
    print("\nMake sure LM Studio is running and a model is loaded!")
    print("Reasoning models (Qwen 3.5) will show the thought process in real-time")
    
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)