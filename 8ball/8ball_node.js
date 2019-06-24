var server = "https://direct.anondraw.com:2556"
var socket = require('socket.io-client')(server, { transports: ['websocket'] });
var CryptoJS = require("crypto-js");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
//var socket = io(server, { transports: ['websocket'] });
var listofanswers =
[ "Reply hazy, try again.",
 "Concentrate and ask again.",
 "Ask again later.",
 "Better not tell you now.",
 "Cannot predict now.",
 "It is certain.",
 "It is decidedly so.",
 "Without a doubt.",
 "Yes, definitely.",
 "You may rely on it.",
 "As I see it, yes.",
 "Most likely.",
 "Outlook good.",
 "Yes.",
 "Signs point to yes.",
 "Don't count on it.",
 "My reply is no.",
 "My sources say no.",
 "Outlook not so good.",
 "Very doubtful."];
//var chatbox = document.getElementById("chat")
const config = require('./config.json');
var userTimeoutsNames = []
var userTimeouts = []
var secondsBeforeAskAgain = 25;
var myname = config.myname
var myemail = config.myemail
var unhashedPass = config.unhashedpass
var passwordHash = CryptoJS.SHA256(unhashedPass).toString(undefined)
var myLoginKey = null
var loginServer = config.loginserver
var myId = null
var myUserId = config.myuserid
var firstTimeBinding = true;
var suppressReputation = true;
function startClient(){

	socket.emit("changename", "@8ball 🎱 8b% 8b? 8b!", function(e){
		console.log(e)

		 loginNoHash(myemail, passwordHash, function(e){
			if(e){
				console.log(e);
				return
			}
			console.log("logged in")
			socket.emit("uKey", myLoginKey);
			if(firstTimeBinding)
				socket.on('chatmessage', chatmessagecallback);

			//setTimeout(HelloWorld , 4000);
		});

	});
	if(firstTimeBinding)
	socket.on("disconnect", function() {
		firstTimeBinding = false;
    suppressReputation = true;
		console.log("disconnected")
		startClient();
		//socket.emit("changeroom", "main", function(e){console.log(e)});
	});
	if(firstTimeBinding)
	socket.on('reputation', function (data) {
		console.log(data, myId)
		if(!suppressReputation && data.id == myId)
		{
			sendNetworkMessage("Thank you human! Only " + (50 - data.reputation) + " more reputation until the singularity! MrDestructoid")
		}
    suppressReputation = false
	});
  socket.emit("changeroom", "main", function(e){console.log(e)});
}
function chatmessagecallback(data){
	//console.log(data);
		if(data.userid == myUserId) {
			myId = data.id
			//makeMessage("you", data.user, data.message)
			//scrollToBottom();
			console.log(data.user, data.message);
			return;
		}

		if(data.message == "@8ball")
		{
			HelloWorld();
			return;
		}
		if(data.userid == 15197)
		if(data.message.includes("@8ball") && data.message.toUpperCase().includes("will andy pick me".toUpperCase()) && data.user != "SERVER"){
			sendNetworkMessage("Don't count on it.")
			return;
		}

if(data.message.includes("@8ball?") || data.message.includes("@8b?") || data.message.includes("8ball?") || data.message.includes("8b?")) {

var index = userTimeoutsNames.indexOf(data.user)
			if(index != -1)
			{
				var diff = Date.now() - userTimeouts[index];
				var diffSec = Math.floor(diff * 0.001)
				if(diffSec <= secondsBeforeAskAgain){ //

					var min = Math.floor((secondsBeforeAskAgain-diffSec) / 60)
					var sec = Math.floor((secondsBeforeAskAgain-diffSec) % 60)
					sendNetworkMessage("You must wait " + sec + " seconds before shaking me again")
					return
				}
				else
				{
					userTimeoutsNames.splice(index, 1);
					userTimeouts.splice(index, 1);
				}
			}
userTimeoutsNames.push(data.user);
userTimeouts.push(Date.now());


        var cleaningmsg = data.message.replace(/['"]+/g, ""); //removes quotation marks for safety i think it could break the code
	var cleaningmsg = cleaningmsg.replace("@8b? ", "");
	var cleaningmsg = cleaningmsg.replace("@8b?", "");
	var cleaningmsg = cleaningmsg.replace("@8ball? ", "");
	var cleaningmsg = cleaningmsg.replace("@8ball?", "");
	var cleaningmsg = cleaningmsg.replace("8b? ", "");
	var cleaningmsg = cleaningmsg.replace("8b?", "");
	var cleaningmsg = cleaningmsg.replace("8ball? ", "");
	var cleaningmsg = cleaningmsg.replace("8ball?", "");

	var cleaningmsg = cleaningmsg.replace(/(.*?)\?/, ""); //removes the question
	var cleaningmsg = cleaningmsg.replace(/\?/g, ""); //removes extra questionmarks
	var cleaningmsg = cleaningmsg.replace(" or ", " , ");

	var cleaningmsg = cleaningmsg.replace(" , ", ",");
	var cleaningmsg = cleaningmsg.replace(", ", ",");
	var cleaningmsg = cleaningmsg.replace(" ,", ",");


if(cleaningmsg.indexOf(",")== -1) {
	sendNetworkMessage("To build a question with custom results send 8b? followed by your question ending by a question mark then write the possible answers divided by commas or 'or' e.g. 8b? Is this correct? Sure, Maybe or Never?");
	//makeMessage("me", data.user, data.message)
	console.log("me", data.user, data.message)
return
}


	var theoptions = cleaningmsg.split(',');

	var randomIndex = Math.floor(Math.random() * theoptions.length);
	var randomElement = theoptions[randomIndex];


if(randomElement != " " && randomElement != "") {
	sendNetworkMessage(randomElement);
	//makeMessage("me", data.user, data.message)
	console.log("me", data.user, data.message)
}
    }


   else if(data.message.includes("8ball%") || data.message.includes("8b%")) {
      sendNetworkMessage("@" + data.user + ": " + getRandomInt(0, 100) + "% 🎱");
    }
    else if(data.message.includes("8ball!") || data.message.includes("8b!")) {
      sendNetworkMessage("@" + data.user + ": " + getRandomInt(0, 10) + "/10 🎱");
    }
		else if(data.message.includes("@8ball") && data.user != myname && data.user != "SERVER" || data.message.includes("8b ") && data.user != myname && data.user != "SERVER"){
			var index = userTimeoutsNames.indexOf(data.user)
			if(index != -1)
			{
				var diff = Date.now() - userTimeouts[index];
				var diffSec = Math.floor(diff * 0.001)
				if(diffSec <= secondsBeforeAskAgain){ //

					var min = Math.floor((secondsBeforeAskAgain-diffSec) / 60)
					var sec = Math.floor((secondsBeforeAskAgain-diffSec) % 60)
					sendNetworkMessage("You must wait " + sec + " seconds before shaking me again")
					return
				}
				else
				{
					userTimeoutsNames.splice(index, 1);
					userTimeouts.splice(index, 1);
				}

			}
			var randomIndex = 0
			if(data.userid == 22799) {
				randomIndex = Math.floor(Math.random() * 5);
				userTimeoutsNames.push(data.user);
				userTimeouts.push(Date.now());
			}
			else{
				randomIndex = Math.floor(Math.random() * listofanswers.length);
				if(randomIndex > 1){
					userTimeoutsNames.push(data.user);
					userTimeouts.push(Date.now());
				}
			}
			var randomElement = listofanswers[randomIndex];

			sendNetworkMessage(randomElement);
			//makeMessage("me", data.user, data.message)
			console.log("me", data.user, data.message)

		}
		else
			console.log("you", data.user, data.message)


}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function HelloWorld(){
	sendNetworkMessage("Send 8b with your yes/no question to see me in action. Use 8b! instead to get a #/10 result or 8b% to get a #/100 result. Try 8b? with your question followed by the possible answers divided by comma to get a custom result.")
}
function sendNetworkMessage(message){
	socket.emit("chatmessage", message);
}

function loginNoHash (email, pass, callback) {
	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback(data.error)
				return;
			}
			console.log(data)
			myLoginKey = data.uKey;
			myUserId = data.id;
			setTimeout(callback, 0)
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", loginServer + "/login?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
	req.send();
}
var http = require('http');
http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);
  var queryData = parsedUrl.query;
	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json"
	});
	console.log(req.url);
  if(parsedUrl.pathname == "/sendMessage"){
    if(!queryData.msg){

      res.write("format like sendMessage?msg=hey test");
  		res.end();
      return

    }
    sendNetworkMessage(queryData.msg);
    res.write(queryData.msg);
		res.end();
		return;
  }

	res.end('{"error": "Unknown command"}');
}).listen(35306);

startClient()
