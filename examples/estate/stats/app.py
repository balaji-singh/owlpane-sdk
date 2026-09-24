import logging, random, time
from flask import Flask, jsonify
app = Flask(__name__)
log = logging.getLogger("stats")
logging.basicConfig(level=logging.INFO)

@app.get("/stats/<int:player_id>")
def stats(player_id):
    time.sleep(random.uniform(0.01, 0.09))
    if player_id % 11 == 0:
        log.error("stats model unavailable for player %s", player_id)
        return jsonify(error="model unavailable"), 503
    log.info("computed career stats for player %s", player_id)
    return jsonify(player=player_id, average=round(30 + player_id % 25 + random.random(), 2), innings=40 + player_id % 60)

app.run(port=5102)
