import os
import json
import requests
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)

# LM Studio запускает локальный сервер, совместимый с OpenAI API
LM_STUDIO_URL = os.getenv('LM_STUDIO_URL', 'http://localhost:1234/v1/chat/completions')

SYSTEM_PROMPT = """Ты - полезный ассистент. Отвечай на том же языке, на котором задан вопрос. Если вопрос на русском - отвечай на русском. Не добавляй лишних приветствий, подписей и повторений. Отвечай кратко и по существу."""

# Список моделей подтягивается динамически из LM Studio
def get_loaded_models():
    try:
        resp = requests.get(
            LM_STUDIO_URL.replace('/chat/completions', '/models'),
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            return [{"id": m["id"], "name": m["id"]} for m in data.get("data", [])]
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
        # LM Studio не требует авторизации, но принимает любой Bearer-токен
        "Authorization": "Bearer lm-studio",
    }


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        messages = data.get('messages', [])
        model = data.get('model', 'local-model')

        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

        payload = {
            "model": model,
            "messages": full_messages,
        }

        response = requests.post(
            LM_STUDIO_URL,
            headers=build_headers(),
            json=payload,
            timeout=120          # локальные модели могут думать дольше
        )

        if response.status_code == 200:
            result = response.json()
            return jsonify({
                'success': True,
                'response': result['choices'][0]['message']['content'],
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
            'error': "Не удалось подключиться к LM Studio. Убедитесь, что сервер запущен на порту 1234."
        }), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.json
    messages = data.get('messages', [])
    model = data.get('model', 'local-model')

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    payload = {
        "model": model,
        "messages": full_messages,
        "stream": True
    }

    def generate():
        response = None
        try:
            response = requests.post(
                LM_STUDIO_URL,
                headers=build_headers(),
                json=payload,
                stream=True,
                timeout=120
            )

            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data_str)
                            if chunk.get('choices'):
                                delta = chunk['choices'][0].get('delta', {})
                                if 'content' in delta and delta['content']:
                                    yield f"data: {json.dumps({'content': delta['content']})}\n\n"
                        except json.JSONDecodeError:
                            continue

            yield "data: [DONE]\n\n"

        except GeneratorExit:
            if response:
                response.close()
            raise
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'Нет соединения с LM Studio'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


if __name__ == '__main__':
    app.run(debug=True, port=5000)