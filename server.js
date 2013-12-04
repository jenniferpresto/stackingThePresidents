// var http = require('http');
var util = require('util');
var connect = require('connect');
var port = process.env.PORT || 5000;

var app = connect.createServer(
	connect.static(__dirname + '/public')
	).listen(port);

util.log('server running at port: ' + port);

var io = require('socket.io').listen(app);

var numConnections = 0;
var numPlayers = 0;
var player1Name;
var player2Name;
var users = []; // will store all user information
var gameOver = false;

io.set('log level', 2);
io.sockets.on('connection', function(clientmessage) {
	util.log('the user ' + clientmessage.id + ' has just connected');
	numConnections++;

	// if Player 1 has already signed up by the time
	// Player 2 connects, give Player 1's name to Player 2
	// this also works if Player 1 hits refresh before Player 2 starts
	if (numPlayers == 1) {
		clientmessage.emit('player one assigned', users[0].name);
	}

	// when one of the clients hits the button
	clientmessage.on('player name', function(data) {
		numPlayers++;
		// save user information as an object
		users.push({number: numPlayers, id: clientmessage.id, name: data.name});
		util.log('there are ' + numPlayers + ' users ready');
		util.log(data.name + ' just pushed the button');

		// sent that player's number back to him/her immediately
		clientmessage.emit('assign number', numPlayers);

		// if player 2 is already connected, but hasn't yet pressed the button,
		// send player 1's name back to him/her
		if (numPlayers == 1) {
			clientmessage.broadcast.emit('player one assigned', data.name);
		}

		// if the first player, send that player number back to the player who pushed the button
		if (users.length == 1) {
			player1Name = data.name;
		} else if (users.length == 2) {
			player2Name = data.name;
			// if this is the second player, send both names to both players
			io.sockets.emit('both names', {
				name1: player1Name, 
				name2: player2Name
			})
		}
	})

	clientmessage.on('game data', function(data) {
		// let's send it right back to the other player
		clientmessage.broadcast.emit('enemy data', data);
	})

	clientmessage.on('i won', function(number) {
		util.log('player ' + number + ' just won!');
		clientmessage.broadcast.emit('you lose', number); // number not really even necessary
		gameOver = true;
	})

	clientmessage.on('first rematch request', function() {
		// send rematch message to the other player 
		clientmessage.broadcast.emit('rematch requested');
	})

	clientmessage.on('rematch accepted', function() {
		clientmessage.broadcast.emit('start new game');
		gameOver = false;
	})

	// Below is a partial fix to a potential refresh problem;
	// corrects if player 1 signs in, submits name, then refreshes before Player 2 submits his/her name
	// Consider how to protect against mid-game refreshing once both players have signed in
	clientmessage.on('disconnect', function() {
		// note: refresh disconnects that user then connects with another id
		util.log('disconnecting ' + clientmessage.id + '!');
		numConnections--;
		if (numConnections == 0) {
			resetGame();
		}
		// if no one's pressed the button, no problem -- skip users.length == 0
		if (users.length == 1) {
			if (users[0].id == clientmessage.id) {
				util.log('same one is disconnecting');
				users.length = 0; // clear the users array
				numPlayers = 0; // reset number of players to 0
			}			
		}
		// if one player disconnects when the game is over,
		// refresh everything
		if (gameOver) {
			clientmessage.broadcast.emit('your enemy quit');
			resetGame();
		}
	})

	clientmessage.on('i quit', function() {
		clientmessage.broadcast.emit('your enemy quit');
		resetGame();
	})
})

function resetGame() {
	numPlayers = 0;
	users.length = 0;
	player1Name = ' ';
	player2Name = ' ';
	gameOver = false;
}