from flask import Flask, request, jsonify
from flask_cors import CORS
from core import Document, Core
from dotenv import load_dotenv
load_dotenv()
import os


app = Flask(__name__)
cors=CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
status = "active"

os.environ['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')


@app.route('/')
def hello_world():
    return jsonify({"status":status,"Value":'surfmind server running successfully',"Version":1.0})


@app.route('/search', methods=['POST'])
def search():
    data = request.json
    history = data.get('data')
    ques = data.get('query')
    core=Core()
    docs=[]
    for x in history:
        doc = Document(x["content"],{'source': x['url'], 'date':x['date']})
        docs.append(doc)
    process_docs = core.makeDocs(docs)
    chain = core.LLMResponse()
    docs = process_docs.invoke(ques)
    context = docs[0].page_content
    url = docs[0].metadata['source']
    date= docs[0].metadata['date']
    result = chain.invoke([context,date,url])
    pchain = core.structure()
    finalOutput = pchain.invoke({"content":result})
    res = jsonify({"success":True,"result":result,"format":finalOutput})
    return res


if __name__ == '__main__':
    app.run(debug=False, port=8000)