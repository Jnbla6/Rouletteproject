from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_key_change_this'
socketio = SocketIO(app)

players = []

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        if not username:
            return redirect(url_for('login'))
        
        session['username'] = username
        
        if username.lower() == 'admin':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('user_dashboard'))
            
    return render_template('login.html')

@app.route('/admin')
def admin_dashboard():
    if session.get('username') != 'admin':
        return redirect(url_for('login'))
    return render_template('dashboard.html', user_type='admin', username='Admin', players=players)

@app.route('/user')
def user_dashboard():
    username = session.get('username')
    if not username or username == 'admin':
        return redirect(url_for('login'))
    
    if username not in players:
        players.append(username)
        socketio.emit('update_players', {'players': players})
        
    return render_template('dashboard.html', user_type='normal', username=username, players=players)

# --- WebSocket Events ---

@socketio.on('spin_wheel')
def handle_spin():
    if len(players) > 0:
        winning_index = random.randint(0, len(players) - 1)
        winner_name = players[winning_index]
        emit('spin_result', {'index': winning_index, 'winner': winner_name}, broadcast=True)

@socketio.on('reset_game')
def handle_reset():
    global players
    players = []
    emit('update_players', {'players': players}, broadcast=True)

@socketio.on('connect')
def handle_connect():
    emit('update_players', {'players': players})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)