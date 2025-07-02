from flask import Flask, request, jsonify
from flask_cors import CORS
from core import Document, Core, PostProcessing
from dotenv import load_dotenv
from termcolor import colored
from utils import Utility
import redis
import json
import os

load_dotenv()

app = Flask(__name__)
cors = CORS(app)
app.config["CORS_HEADERS"] = "Content-Type"
status = "active"

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT")

redis_client = redis.Redis(
    host=redis_host, port=redis_port, db=0, decode_responses=True
)


@app.route("/")
def hello_world():
    return jsonify(
        {
            "status": status,
            "Value": "surfmind server running successfully",
            "Version": 1.5,
        }
    )


@app.route("/save-data", methods=["POST"])
def save_data():
    success = False
    try:
        data = request.json
        user_id = data.get("userId")
        history = data.get("data")  # this should be a list of dicts
        # print("got userId", user_id)
        if not user_id or not isinstance(history, list):
            return jsonify({"error": "Invalid input"}), 400

        # Convert the data to JSON string and save in Redis
        redis_client.set(user_id, json.dumps(history), ex=3600)
        return jsonify({"success": True, "message": "Data saved successfully"}), 200
    except Exception as e:
        print(colored(f"Error saving data: {str(e)}", "red"))
        return jsonify({"error": str(e), "success": success}), 500


@app.route("/search", methods=["POST"])
def search():
    data = request.json
    user_id = data.get("userId")

    user_data = redis_client.get(user_id)
    history = json.loads(user_data)
    # history = data.get("data")
    ques = data.get("query")
    flag = data.get("flag")
    _, llm_gemini = Utility.llm()
    core = Core(llm_gemini)
    docs = []
    for x in history:
        if flag == "history":
            doc = Document(
                x["content"],
                {
                    "source": x["url"],
                    "date": x["date"],
                    "title": x.get("title", ""),
                },
            )
        else:
            doc = Document(
                x["content"],
                {
                    "source": x["url"],
                    "date": x.get("date", "Unknown"),
                    "title": x.get("title", ""),
                },
            )
        docs.append(doc)
    process_docs, db = core.makeDocs(docs)
    # chain = core.LLMResponse()
    docs = process_docs.invoke(ques)
    docs_other = core.makeDocs_other(db, ques)
    post_processing = PostProcessing()
    context = docs[0].page_content
    url = docs[0].metadata["source"]
    date = docs[0].metadata["date"]
    result, model = core.safe_invoke_llm_response(core, context, date, url, flag)
    pchain = core.structure()
    finalOutput = pchain.invoke({"content": result})
    final_docs = post_processing.post_process(ques, url, docs, docs_other)
    res = jsonify(
        {
            "success": True,
            "result": result,
            "format": finalOutput,
            "model": model,
            "docs": final_docs,
        }
    )
    return res


if __name__ == "__main__":
    app.run(debug=False, port=8000)
