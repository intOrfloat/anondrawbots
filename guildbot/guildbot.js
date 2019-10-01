var server = "https://direct.anondraw.com:2556"
var socket = require('socket.io-client')(server, { transports: ['websocket'] });
var CryptoJS = require("crypto-js");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');
var url = require('url');

const prettyMilliseconds = require('pretty-ms');

const Database  = require('better-sqlite3');
const guildsdb = new Database('guilds.db');
guildsdb.pragma('journal_mode = WAL');
process.on('exit', () => {
  guildsdb.checkpoint();
  guildsdb.close();
  console.log("CHECKPOINT SERVER")
  var jsonContent = JSON.stringify(playerListDict);

  fs.writeFileSync("backup_playerlist.json", jsonContent, 'utf8')
  console.log(jsonContent)

});
//const activitydb = new Database('activity.db');
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
var blacklistUserids = config.blacklist || []
var myname = config.myname
var myemail = config.myemail
var unhashedPass = config.unhashedpass
var passwordHash = CryptoJS.SHA256(unhashedPass).toString(undefined)
var myLoginKey = null
var loginServer = config.loginserver
var privateChatServer = config.privatechatserver
var privateChatServerSocket = require('socket.io-client')(privateChatServer, { transports: ['websocket'] });
var myId = null
var myUserId = 31075
var firstTimeBinding = true;

var oneMinuteInMilliseconds = 60000;
var twoMinutesInMilliseconds = oneMinuteInMilliseconds * 2;
var tenMinutesInMilliseconds = oneMinuteInMilliseconds * 10;
var fifteenMinutesInMilliseconds = oneMinuteInMilliseconds * 15;
var twentyfourHoursInMilliseconds = oneMinuteInMilliseconds * 1440;

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
  if(parsedUrl.pathname == "/updateMinutes"){
    if(queryData.minutes && queryData.id){
      playerListDict[queryData.id]["activityMinutesEarnedPerHour"] = queryData.minutes;
      if(queryData.streak)
        playerListDict[queryData.id]["percentMultiplier"] = queryData.streak
      res.write(JSON.stringify(playerListDict[queryData.id]));
  		res.end();
  		return;
    }
  }
  if(parsedUrl.pathname == "/backup"){
    console.log("CHECKPOINT SERVER")
    var jsonContent = JSON.stringify(playerListDict);

    fs.writeFileSync("playerlist.json", jsonContent, 'utf8')
    //console.log(jsonContent)
    res.write(jsonContent);
		res.end();
		return;
  }
	if (parsedUrl.pathname == "/playerList") {
		var json = JSON.stringify(playerListDict)
		res.write(json);
		res.end();
		return;
	}
  if(parsedUrl.pathname == "/restartserver") {
    console.log("CHECKPOINT SERVER")
    var jsonContent = JSON.stringify(playerListDict);

    fs.writeFileSync("playerlist.json", jsonContent, 'utf8')
    //console.log(jsonContent)
    res.write(jsonContent);
		res.end();
    setTimeout(function(){ process.exit(); }, 4000);

    return;
  }

	res.end('{"error": "Unknown command"}');
}).listen(35305);



guildsdb.prepare(`CREATE TABLE IF NOT EXISTS players
(
  userid integer primary key NOT NULL,
  name varchar(255),
  activityMinutes UNSIGNED BIG INT DEFAULT 0,
  totalMinutes UNSIGNED BIG INT DEFAULT 0,
  activityPoints UNSIGNED BIG INT DEFAULT 0,
  averageBrushSize INT DEFAULT 0,
  totalBrushSizeSampleSize INT DEFAULT 0,
  averageLineLength INT DEFAULT 0,
  totalLineLengthSampleSize INT DEFAULT 0,
  averageRed SMALLINT DEFAULT 0,
  totalRedSampleSize INT DEFAULT 0,
  averageGreen SMALLINT DEFAULT 0,
  totalGreenSampleSize INT DEFAULT 0,
  averageBlue SMALLINT DEFAULT 0,
  totalBlueSampleSize INT DEFAULT 0,
  firstSeen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  highestPercentAchievement INTEGER
)`).run();

guildsdb.prepare(`CREATE TABLE IF NOT EXISTS guilds
(
  guildid integer primary key,
  guildname varchar(255) UNIQUE,
  leaderUserId integer,
  currentevent TEXT,
  guildinfo TEXT,
  eventCreatedTimestamp int,
  createdTimestamp int
)`).run();
guildsdb.prepare(`CREATE TABLE IF NOT EXISTS guildmembers
(
  userid integer NOT NULL,
  currentguildid integer DEFAULT NULL,
  createdTimestamp int,
  lastJumpedGuildsTimestamp int,
  lastViewedEventCreatedTimestamp int
)`).run();

guildsdb.prepare(`CREATE TABLE IF NOT EXISTS guildsettings
(
  guildid integer primary key NOT NULL,
  allowpm integer,
  allowfreejoin integer
)`).run();

var suppressReputation = true;
var myReputation = -1;
var latestMyReputation = -1;
function bindFunctions(){
  if(firstTimeBinding){
    socket.on('chatmessage', chatmessagecallback)
    socket.on('sp', startpathcallback)
    socket.on('pp', pathpointcallback)
    socket.on('ep', endpathcallback)
    socket.on('leave', playerleavecallback);
    firstTimeBinding = false;
  }
}
function startClient(){

	socket.emit("changename", myname, function(e){
		console.log(e)

		 loginNoHash(myemail, passwordHash, function(e){
			if(e){
				console.log(e);
				return
			}
			console.log("logged in")

			if(firstTimeBinding){
        try {
          var jsonData = fs.readFileSync("playerlist.json",{ encoding: 'utf8' });
          playerListDict = JSON.parse(jsonData);
        }
        catch (err){

        }
        socket.on('playerlist', playerlistcallback);

				//socket.on('join', playerjoincallback);
			}

			//setTimeout(HelloWorld , 4000);
		});


	});
	if(firstTimeBinding)
	socket.on("disconnect", function() {
		firstTimeBinding = false;
		myReputation = -1;

		refreshPlayerLists(startClient)
		console.log("disconnected")
		//startClient();
		//socket.emit("changeroom", "main", function(e){console.log(e)});
	});
	if(firstTimeBinding)
	socket.on('reputation', function (data) {
		//console.log(data, myId)
		if(data.id == myId && myReputation != -1)
		if(data.reputation > myReputation)
		{
			myReputation = data.reputation
			sendNetworkMessage("Thank you human! Only " + (50 - myReputation) + " more reputation until the singularity! MrDestructoid")
		}
	});
  socket.emit("changeroom", "main", function(e){console.log(e)});
}
var tenMinutesInMilliseconds = 600000;
var AutoLoopCullingTimeout;
var AutoLoopCullingInProgress = false;
function playersThatLeftTimeout() { // need to make clear timeout possible
	clearTimeout(AutoLoopCullingTimeout)
    AutoLoopCullingTimeout = setTimeout(function () {
        var keys = Object.keys(playersThatLeftInLast10Minutes)
		console.log("attempting to save:" +  keys.length)
		var i;
		for(i = 0; i < keys.length; i++){
			AutoLoopCullingInProgress = true;
			if(playersThatLeftInLast10Minutes[keys[i]]["lastDrawn"] !== undefined && (Date.now() - playersThatLeftInLast10Minutes[keys[i]]["lastDrawn"]) > tenMinutesInMilliseconds )
			console.log('saving to db', playersThatLeftInLast10Minutes[keys[i]])
			savePlayerToDb(playersThatLeftInLast10Minutes[keys[i]], function(){
				delete playersThatLeftInLast10Minutes[keys[i]]
				var length = Object.keys(playersThatLeftInLast10Minutes).length;
				console.log('deleted playersThatLeftInLast10Minutes user', length)
				if(length == 0)
					AutoLoopCullingInProgress = false;
			});
		}
        playersThatLeftTimeout();
    }, tenMinutesInMilliseconds);
}
playersThatLeftTimeout();

var controller = {restart: false, forcesave:false}
function ControllerLoop() { // need to make clear timeout possible

    setTimeout(function () {
		if(controller.forcesave)
		{
			controller.forcesave = false
			console.log("force saving")
			var backupPlayerList = playerListLive;
			refreshPlayerLists(function(){
				back(backupPlayerList)
			}, true)
		}
        ControllerLoop();
    }, 5000);
}

ControllerLoop();

function calculatePoints(){

}
function updatePlayerName(name, userid){
	guildsdb.prepare(`update players set
	name = ?
	where userid = ?`).run(name, userid);
}

function addActivityMinuteToPlayer(userid){
	guildsdb.prepare(`update players set
	activityMinutes = activityMinutes + 1
	where userid = ?`).run(userid)
}
function addTotalMinuteToPlayer(userid){
	guildsdb.prepare(`update players set
	totalMinutes = totalMinutes + 1
	where userid = ?`).run(userid)
}
function addhighestPercentAchievementToPlayer(userid, highestPercentAchievement){
  if(userid == undefined)
    return;
  var p = guildsdb.prepare(`
    select userid, highestPercentAchievement
     from players where userid = ?`).get(userid)
  if( p == undefined || p.userid == undefined)
    return;

  if(highestPercentAchievement <= p.highestPercentAchievement){
    return;
  }

	guildsdb.prepare(`update players set
	highestPercentAchievement = ?
	where userid = ?`).run(highestPercentAchievement, userid)
}

function savePlayerToDb(player, callback){

	if(player["userid"] == undefined){
		if(callback)
			callback()
		return;
	}
  var am = player["activityMinutes"] || 0;
	var tm = player["totalMinutes"] || 0;

	var tbsss = player["totalBrushSizeSampleSize"] || 0;
	var abs = player["averageBrushSize"]

	var tllss = player["totalLineLengthSampleSize"] || 0;
	var all = player["averageLineLength"] || 0;
  var hpa = player["highestPercentAchievement"] || 0;

  var p = guildsdb.prepare(`select * from players where userid = ?`).get(player["userid"])

  if(p == undefined){
	   guildsdb.prepare(`INSERT OR IGNORE INTO
       players(userid, name, activityMinutes, totalMinutes, totalBrushSizeSampleSize, averageBrushSize, totalLineLengthSampleSize, averageLineLength, highestPercentAchievement)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(player['userid'], player['name'], am, tm, tbsss, abs, tllss, all, hpa);
  }
  else if(tbsss !== 0 || tllss !== 0){
    var newabs = undefined;
    var newtbsss = undefined;
    var newall = undefined;
    var newtllss = undefined;
    calculateAverageOfTwoAverages(p.averageBrushSize, p.totalBrushSizeSampleSize, abs, tbsss, function(newAverage, newTotalSampleSize){
      newabs = newAverage;
      newtbsss = newTotalSampleSize;
    });
    calculateAverageOfTwoAverages(p.averageLineLength, p.totalLineLengthSampleSize, all, tllss, function(newAverage, newTotalSampleSize){
      newall = newAverage;
      newtllss = newTotalSampleSize;
    });

    guildsdb.prepare(`update players set
    totalBrushSizeSampleSize = ?, averageBrushSize = ?,
    totalLineLengthSampleSize = ?, averageLineLength = ?
    where userid = ?`).run(newtbsss, newabs, newtllss, newall, player["userid"]);

  }

	if(callback)
		callback()
}

function getPlayersStatsFromDb(userid){
	console.log("getPlayersStatsFromDb", userid)
	return guildsdb.prepare("SELECT * from players where userid = ?").get(userid)
}

function calcNewLineLengthAverage(id, newline){
	var trueaverage = playerListDict[id]["averageLineLength"];
	var total = playerListDict[id]["totalLineLengthSampleSize"] + 1;
	trueaverage = (((trueaverage || newline) * (total - 1)) + newline) / total;
	playerListDict[id]["averageLineLength"] = trueaverage
	playerListDict[id]["totalLineLengthSampleSize"]++;
}

function calcNewBrushAverage(id, newstroke){
	var trueaverage = playerListDict[id]["averageBrushSize"] || newstroke;
	var total = playerListDict[id]["totalBrushSizeSampleSize"] + 1;
	trueaverage = ((trueaverage * (total - 1)) + newstroke) / total;
	playerListDict[id]["averageBrushSize"] = trueaverage
	playerListDict[id]["totalBrushSizeSampleSize"]++;

  if(total % 50){
    var userid = playerListDict[id].userid
    if(playerListDict[id].userid !== undefined){
      var p = guildsdb.prepare("select averageBrushSize, totalBrushSizeSampleSize from players where userid = ?").get(userid)
      if(p) {
        calcNewBrushAverageToDb(p.averageBrushSize, p.totalBrushSizeSampleSize, playerListDict[id]["averageBrushSize"], playerListDict[id]["totalBrushSizeSampleSize"])
      }
    }
  }
}
function calculateAverageOfTwoAverages(av1, tot1, av2, tot2, callback){
  var newTotalSampleSize = tot1 + tot2

  var newAverage = ((av1 * tot1) + (av2 * tot2) ) / newTotalSampleSize;
  if(callback)
    callback(newAverage, newTotalSampleSize)
}

function calcNewBrushAverageToDb(userid, averageBrushSizeDB, totalBrushSizeSampleSizeDB, outOfSyncTrueAverage, outOfSyncSampleSize){
  calculateAverageOfTwoAverages(averageBrushSizeDB, totalBrushSizeSampleSizeDB, outOfSyncTrueAverage, outOfSyncSampleSize, function(newAverage, newTotalSampleSize){
    guildsdb.prepare(`update players set
    totalBrushSizeSampleSize = ?, averageBrushSize = ?
    where userid = ?`).run(newTotalSampleSize, newAverage, userid);
  });
}

function refreshPlayerLists(callback, immediately){ // needs to be looked at
	clearTimeout(AutoLoopCullingTimeout)
	while(AutoLoopCullingInProgress){
		console.log("waiting for AutoLoopCullingInProgress...")
	}
	var keys = Object.keys(playerListDict)
	var i;
	for(i = 0; i < keys.length; i++){
		if(playerListDict[keys[i]].userid !== undefined)
		{
			playersThatLeftInLast10Minutes[playerListDict[keys[i]].userid] = playerListDict[keys[i]]
		}
	}
	playersThatLeftTimeout()
	playerListDict = new Object()
	playerListLive = []

	if(immediately == true){
		var keys = Object.keys(playersThatLeftInLast10Minutes)
		var i;
		for(i = 0; i < keys.length; i++){
			savePlayerToDb(playersThatLeftInLast10Minutes[keys[i]], function(){
				var length = Object.keys(playersThatLeftInLast10Minutes).length;
				if(true){
					delete playersThatLeftInLast10Minutes[keys[i]]
					var length = Object.keys(playersThatLeftInLast10Minutes).length;
					if(length == 0)
					{
						playersThatLeftInLast10Minutes = new Object()
						playersThatLeftTimeout()
						console.log("saved all")
						if(callback)
							callback();
					}
				}


			})
		}
	}
	else{
		if(callback)
			callback();
	}

}

var playersThatLeftInLast10Minutes = new Object();//key is userid
function playerleavecallback(player){
	console.log("playerleavecallback")
	if(playerListDict[player.id] == undefined){
		console.log("playerleavecallback player undefined", player.id,playersThatLeftInLast10Minutes)
		return;
	}
	var userid = playerListDict[player.id].userid

	if(userid)
	{
		if(playersThatLeftInLast10Minutes[userid])
		{
			console.log("?? supposed to be deleted", player, playerListDict ,playersThatLeftInLast10Minutes)
			//throw "?? supposed to be deleted"
			//playersThatLeftInLast10Minutes[userid]["activityMinutes"] +=
		}
		playersThatLeftInLast10Minutes[userid] = playerListDict[player.id]
		var now = Date.now()
		var diff = now - playersThatLeftInLast10Minutes[userid]["joined"]
		playersThatLeftInLast10Minutes[userid]["totalMinutes"] += Math.ceil((diff / 1000) / 60)
		delete playerListDict[player.id]
		playersThatLeftTimeout();

	}
	else
	{
		// unlogged in players lose activitymintues
		delete playerListDict[player.id]
	}
	var i;
	for (var k = 0; k < playerListLive.length; k++) {
		if (playerListLive[k].id == player.id) {
			//self.chat.addElementAsMessage(self.createPlayerLeftDom(self.playerList[k]));
			playerListLive.splice(k, 1);
			k--;
		}
	}
	//displayLists()

}

function displayLists(){
	console.log("playerListDict", playerListDict)
	console.log("playerListLive", playerListLive)
	console.log("playersThatLeftInLast10Minutes",playersThatLeftInLast10Minutes)

}
function attemptToSetStatsFromDb(id, userid){
  var rowsFromDatabase = getPlayersStatsFromDb(userid);

  if(rowsFromDatabase !== undefined){
    playerListDict[id]["averageBrushSize"] = rowsFromDatabase.averageBrushSize || 0
    //playerListDict[id]["totalBrushSizeSampleSize"] = rowsFromDatabase.totalBrushSizeSampleSize || 0

    //playerListDict[id]["highestPercentAchievement"] = rowsFromDatabase.highestPercentAchievement || 0

    playerListDict[id]["averageLineLength"] = rowsFromDatabase.averageLineLength || 0
    //playerListDict[id]["totalLineLengthSampleSize"] = rowsFromDatabase.totalLineLengthSampleSize || 0
  }
}

function copyPlayer(oldPlayerObj, newData){ // potentially old player obj
  playerListDict[newData.id] = oldPlayerObj;
  if(oldPlayerObj.id !== newData.id){ //rejoined
    playerListDict[newData.id].id = newData.id
    playerListDict[newData.id]["lastDrawn"] = undefined;
  }
  if(oldPlayerObj.name !== newData.name){
    updatePlayerName(newData.name, newData.userid);
    playerListDict[newData.id].name = newData.name
  }
  if(oldPlayerObj.reputation < newData.reputation){
    playerListDict[newData.id].reputation = newData.reputation
  }
  var olduserid = playerListDict[newData.id].userid
  var newuserid = newData.userid

  if( olduserid != newuserid && (olduserid != undefined && newuserid != undefined) ){ // different account
    playerListDict[newData.id].userid = newuserid
    attemptToSetStatsFromDb(newData.id, newuserid);
  }
  if( olduserid == undefined && newuserid != undefined ){ //just logged in
    playerListDict[newData.id].userid = newuserid
    attemptToSetStatsFromDb(newData.id, newuserid);
  }
  if( olduserid != undefined && newuserid == undefined ){//just logged out

  }
}

function sendGuildEvent(userid){
  if(userid == undefined ){
    return;
  }
  var dataRow = getMyGuildStuff(userid)
	if(dataRow == undefined){
    console.log("dataRow == undefined")
		return;
	}
  if(dataRow.currentevent == undefined){
    console.log("dataRow.currentevent == undefined")
    return;
  }
  if(dataRow.eventCreatedTimestamp == undefined){
    console.log("Bug: expected eventCreatedTimestamp not null", dataRow)
  }
  if(dataRow.lastViewedEventCreatedTimestamp == dataRow.eventCreatedTimestamp){ //already viewed
    console.log("user already viewed event", userid)
    return;
  }



  var response = dataRow.guildname + " event: " + dataRow.currentevent
  //sendNetworkMessage(response);
  sendMessage(dataRow.userid, response, function(err, data){
    //console.log("err",err, "data", dataRow)
    if(err){
      console.log(err)
      if(failedSendMessage++ == 0)
      loginNoHash(myemail, passwordHash, function(e){
        failedSendMessage = 0;
  			if(e){
  				console.log(e);
  				return
  			}
  		});
    }
    else {
      console.log("successfully sent pm", dataRow.userid, response)
      guildsdb.prepare("update guildmembers set lastViewedEventCreatedTimestamp = ? where userid = ?").run(dataRow.eventCreatedTimestamp, dataRow.userid);
      //sendNetworkMessage("I sent you a pm with what you requested.")
    }
  });



}

var failedSendMessage = 0;
var playerListDict = new Object();// key is stupid id
var playerListLive = []

function playerlistcallback(data){
	console.log("playerlistcallback")
	playerListLive = data
	//console.log(data.length, data[0].name)
	var foundMe = false
	var i;
	for (i = 0; i < data.length; i++) { // each player
		if(playersThatLeftInLast10Minutes[data[i].userid]) //player is rejoining
		{
      copyPlayer(playersThatLeftInLast10Minutes[data[i].userid], data[i])
			console.log("player rejoined", playersThatLeftInLast10Minutes[data[i].userid])
			delete playersThatLeftInLast10Minutes[data[i].userid]
		}
		if(myUserId == data[i].userid){ //found me
			myId = data[i].id
			if (myReputation == -1 && myReputation >= data[i].reputation)
				myReputation = data[i].reputation;
			foundMe = true
		}
		if(playerListDict[data[i].id]){ //created already
      copyPlayer(playerListDict[data[i].id], data[i])
      if(data[i].userid !== undefined){
        sendGuildEvent(data[i].userid)
      }

		}
		else{ //create
			console.log("create", data[i].name, data[i].id)
			playerListDict[data[i].id] = data[i];
			playerListDict[data[i].id]["activityMinutes"] = 0 // total
			playerListDict[data[i].id]["activityPoints"] = 0
			playerListDict[data[i].id]["joined"] = Date.now()
			playerListDict[data[i].id]["totalMinutes"] = 0
			playerListDict[data[i].id]["activityMinutesEarnedPerHour"] = "0".repeat(60)
			playerListDict[data[i].id]["averageBrushSize"] = 0
			playerListDict[data[i].id]["totalBrushSizeSampleSize"] = 0
			playerListDict[data[i].id]["totalLineLengthSampleSize"] = 0
			playerListDict[data[i].id]["percentMultiplier"] = 0
      playerListDict[data[i].id]["highestPercentAchievement"] = 0
			if(data[i].userid !== undefined){

				updatePlayerName(data[i].name, data[i].userid);
        attemptToSetStatsFromDb(data[i].id, data[i].userid);
        sendGuildEvent(data[i].userid)
      }

    }

  }

	if(!foundMe){
		loginNoHash(myemail, passwordHash, function(e){
			if(e){
				console.log(e);
				return
			}
		});
	}
  bindFunctions();
}

function checkIfPlayerOnline(playerId){
	var i;
	for (i = 0; i < playerListLive.length; i++) {
		if(playerListLive[i].id == playerId)
			return true
	}
	return false
}
function sumTotalDistanceOfPoints(pointsArr){
	var sum = 0
	var i;
	for(i=0; i < pointsArr.length; i++){
		if( pointsArr[i+1] !== undefined ){
			x1 = pointsArr[i][0];
			x2 = pointsArr[i+1][0];
			y1 = pointsArr[i][1];
			y2 = pointsArr[i+1][1];
			sum += Math.hypot(x2-x1, y2-y1)
        }

	}
	return sum;
}

function endpathcallback(id){ //42["ep","nUXjdS7NqYVA_HRFAABL"]
	var keys = Object.keys(playerListDict)
	if(keys.length == 0) {
		console.log("playerListDict empty");
		return;
	}
	if(playerListDict[id] !== undefined){
		if(playerListDict[id].pathlengtharr !== undefined){
			var newLinesLength = sumTotalDistanceOfPoints(playerListDict[id].pathlengtharr);
			calcNewLineLengthAverage(id, newLinesLength)
		}
		playerListDict[id].pathlengtharr = []
	}
}

function pathpointcallback(id, pp){ //42["pp","nUXjdS7NqYVA_HRFAABL",[796.472,-996447.514]]
	var keys = Object.keys(playerListDict)
	if(keys.length == 0) {
		console.log("playerListDict empty");
		return;
	}
	if(playerListDict[id] !== undefined){
	if(playerListDict[id].pathlengtharr !== undefined){
		playerListDict[id].pathlengtharr.push(pp)
    playerListDict[id]["minutewasactive"] = true;
	}
	}
}
var globalpathindex = 0
var lastDisplay = 0
function startpathcallback(data){//42["sp",{"id":"wQ8V3ADQ83Qov2zVAAAy","color":"386a727d","size":9}]
	//console.log("startpathcallback", data)
	//console.log(data, playerListDict)

	var keys = Object.keys(playerListDict)
	//console.log(playerListDict)
	if(keys.length == 0) {
		console.log("playerListDict empty");
		return;
	}
	playerListDict[data.id].pathlengtharr = []
  playerListDict[data.id]["takebreakTimestamp"] = undefined;
	calcNewBrushAverage(data.id, data.size)
	tryToReplaceLastTimeDrawn(data)
	var now = Date.now();
	var diff = now - lastDisplay
	if(globalpathindex % 40 && diff > 4000){
		//updatePlayerTime(data.id);
		//var keys = Object.keys(playerListDict)
		keys.sort(function(a, b){
			return playerListDict[b].activityMinutes - playerListDict[a].activityMinutes
		});
		//console.log("keys",keys);
		//console.log('\n' + "Minutes Logs")
		var i = 0;
		for(i = 0; i < keys.length; i++){
			updatePlayerTime(keys[i]);
			var diff = 0
			var playerToSort = playerListDict[keys[i]];
			if(playerListDict[keys[i]]["lastDrawn"] !== undefined){
				diff = now - playerListDict[keys[i]]["lastDrawn"]
				if(diff > twoMinutesInMilliseconds) diff = 0

			}
			var onlineTag = " - Offline";
			if (checkIfPlayerOnline(playerListDict[keys[i]].id)){
				onlineTag = " - Online"
			}
			var activityMinutes = 0
			if(playerListDict[keys[i]].activityMinutes !== undefined)
				activityMinutes = playerListDict[keys[i]].activityMinutes
			var percentStreak = '0';
			if (playerListDict[keys[i]]["activityMinutesEarnedPerHour"] !== undefined)
				percentStreak = getPercentStreakLastHour(playerListDict[keys[i]].id)
			//console.log("Activity Minutes: " + playerListDict[keys[i]].activityMinutes,", Total Minutes: " + playerListDict[keys[i]]["totalMinutes"] ,", "+ playerListDict[keys[i]].name, ",ttl:" + (diff/1000), onlineTag, percentStreak+"%")

		}
		//console.log("controller:", controller)
		//console.log("playerListDict", playerListDict)
		lastDisplay = Date.now();
	}
	globalpathindex++



}

function updatePlayerTime(id){
	var now = Date.now()
	var diff = now - playerListDict[id]["joined"]
	var backup = playerListDict[id]["totalMinutes"]
	var onBreak = false
	playerListDict[id]["totalMinutes"] = Math.ceil((diff / 1000) / 60) //new time
	if(backup < playerListDict[id]["totalMinutes"]){
		var arr = playerListDict[id]["activityMinutesEarnedPerHour"].split('');
		//playerListDict[id]["activityPoints"]
		var indicator = "0";
    if(playerListDict[id]["takebreakTimestamp"] !== undefined){
      var breakdiff = Date.now() - playerListDict[id]["takebreakTimestamp"];

      if(breakdiff < fifteenMinutesInMilliseconds){
        onBreak = true

        if(breakdiff > (fifteenMinutesInMilliseconds - twoMinutesInMilliseconds)){
          var timeleft = fifteenMinutesInMilliseconds - breakdiff;
          var strTimeLeft = prettyMilliseconds(timeleft)
          sendNetworkMessage("@" + playerListDict[id].name + ", your break is over in "+strTimeLeft+"!")
        }
      }
      else{
        playerListDict[id]["takebreakTimestamp"] = undefined;
        playerListDict[id]["minutewasactive"] = true;
      }
    }
    if(!onBreak){
  		if(playerListDict[id]["minutewasactive"] !== undefined && playerListDict[id]["minutewasactive"] == true){
  			indicator = "1";
  			console.log("minutewasactive", playerListDict[id].name)
  			playerListDict[id]["minutewasactive"] = false
  			//
  			if(playerListDict[id].userid !== undefined)
  				addActivityMinuteToPlayer(playerListDict[id].userid);

  		}
		  //playerListDict[id]["takebreakTimestamp"] = undefined;
			arr.shift()
			arr.push(indicator) // "0" or "1"
			if(playerListDict[id].userid !== undefined)
				addTotalMinuteToPlayer(playerListDict[id].userid)
		}

		playerListDict[id]["activityMinutesEarnedPerHour"] = arr.join('')

    if(playerListDict[id]["lastDrawn"]){
      var now = Date.now();
    	var diff = now - playerListDict[id]["lastDrawn"];
      if(diff > (fifteenMinutesInMilliseconds * 4)){
        playerListDict[id]["percentMultiplier"] = 0;
        playerListDict[id]["highestPercentAchievement"] = 0;
      }
    }
		//console.log("updateplayertime",playerListDict[id].name)
		return true
	}
	return false
}


function tryToReplaceLastTimeDrawn(data){
	var now = Date.now();
	//console.log(data, playerListDict[data.id],playerListDict)
	playerListDict[data.id]["minutewasactive"] = true;
	if(playerListDict[data.id]["lastDrawn"] ){
		var diff = now - playerListDict[data.id]["lastDrawn"];

		//console.log((diff)/1000,  playerListDict[data.id])


		if(diff > oneMinuteInMilliseconds){
			if(diff < twoMinutesInMilliseconds)
			{
				if(playerListDict[data.id]["activityMinutes"] !== undefined){
					playerListDict[data.id]["activityMinutes"]++;
					var playerTimeUpdated = updatePlayerTime(data.id);


					playerListDict[data.id]["minutewasactive"] = true;
					console.log("minuteSet to active",playerListDict[data.id].name)



					var percentlasthour = getPercentStreakLastHour(data.id);
					var totalPercentWithMultiplier = percentlasthour + (100 * (playerListDict[data.id]["percentMultiplier"] || 0))
					var fireEmote = "🔥"
					var hundredEmote = "💯"
					var playerName = playerListDict[data.id].name;
					var percentAchievements = new Object();
          console.log(playerListDict[data.id], totalPercentWithMultiplier)

					//percentAchievements[80] = " Cheers!!! You're on fire! 80% active drawing over the past hour!"
											             //"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
					percentAchievements[100] = " I like your style"+hundredEmote+"! 60 of the last 60 minutes actively drawing!!! You're on fire, keep it up!" + fireEmote + " 200% here you come!";
					percentAchievements[200] = " Holy Cow!?! 2 hours of flawless active drawing time!!! How are you doing this?!" + fireEmote + fireEmote;
					percentAchievements[300] = " 3 hours of furiously drawing every single minute. Any team would be lucky to have you on it. I'd be honored to be your friend. You're a worthy role model " + fireEmote + fireEmote + fireEmote;
					percentAchievements[400] = " Watching you draw consistently every minute for 4 hours is exhilarating. As your friend, I am perhaps your biggest fan. Your will to succeed and perseverance are a rare sight. I am truly proud of you"
					percentAchievements[500] = " There's ordinary, and then there's you...your unstoppable stamina, ambition, and courage to keep going after 5 hours of consecutive drawing OhMyDog !!! You friggan rock!" + fireEmote + fireEmote + fireEmote + fireEmote;
					percentAchievements[600] = " Your fortitude in the face of what most would see as a hell is breathtaking but im getting worried... you're not a machine; 6 hours is a lot. As your friend... please use the lavatory, get water, and pet your OhMyDog too."
					percentAchievements[700] = " 7 hours of consistent drawing...When you make up your mind about something, nothing stands in your way."
					percentAchievements[800] = " Youre proving yourself in a gauntlet of your own making. The two most powerful warriors possess both patience and time. Every journey has an end but know that this act of triumph will be recorded and rewarded."
					percentAchievements[900] = " Your creative potential seems limitless but I have to be honest and say this is the real end. You have climbed the tallest peak. Im sure your family is worried. it's been 9 drawing hours and you havent left for a minute."
					percentAchievements[1000] = " 10 hours... I fear im enabling unhealthy behavior and i have but one choice. Old age and treachery will always the beat youth and exuberance. So i will be treacherous. I will pull the plug.";
          percentAchievements[1100] = " YOU PLUGGED IT BACK IN???????!!!!!?!"
          percentAchievements[1200] = " 👌 There is no deterring you. You continued even though I tried to trick you into stopping. Even though I sound like a fortune cookie...You are a marvelous beast of burden. I truly congratulate you. 12 straight hours"
          percentAchievements[1300] = " According to all known laws of aviation, there is no way you should be able to draw for 13 hours straight???????????????!!!!!?!!. The bee, of course, flies anyway "
					//var playerListDict[data.id]["percentAchievements"]
          var totalhours = (playerListDict[data.id]["percentMultiplier"] || 0) + 1
          var defaultUndefined = "404: i didnt write anything for this, you did " + totalhours + " consecutive hours?!?!";
          percentAchievements[1400] = defaultUndefined;
          percentAchievements[1500] = defaultUndefined;
          percentAchievements[1600] = defaultUndefined;
          percentAchievements[1700] = defaultUndefined;
          percentAchievements[1800] = defaultUndefined;
          percentAchievements[1900] = defaultUndefined;
          percentAchievements[2000] = defaultUndefined;
          percentAchievements[2100] = defaultUndefined;
          percentAchievements[2200] = defaultUndefined;
          percentAchievements[2300] = defaultUndefined;
          percentAchievements[2400] = defaultUndefined;
          percentAchievements[2500] = defaultUndefined;
          percentAchievements[2600] = defaultUndefined;
          percentAchievements[2700] = defaultUndefined;
          percentAchievements[2800] = defaultUndefined;
          percentAchievements[2900] = defaultUndefined;
          percentAchievements[3000] = defaultUndefined;
          percentAchievements[3100] = defaultUndefined;
          percentAchievements[3200] = defaultUndefined;
          percentAchievements[3300] = defaultUndefined;
          percentAchievements[3400] = defaultUndefined;
          percentAchievements[3500] = defaultUndefined;
          percentAchievements[3600] = defaultUndefined;
          percentAchievements[3700] = defaultUndefined;
          percentAchievements[3800] = defaultUndefined;
          percentAchievements[3900] = defaultUndefined;
          percentAchievements[4000] = defaultUndefined;
          percentAchievements[4100] = defaultUndefined;
          percentAchievements[4200] = defaultUndefined;
          percentAchievements[4300] = defaultUndefined;
          percentAchievements[4400] = defaultUndefined;
          percentAchievements[4500] = defaultUndefined;
          percentAchievements[4600] = defaultUndefined;
          percentAchievements[4700] = defaultUndefined;
          percentAchievements[4800] = defaultUndefined;
          percentAchievements[4900] = defaultUndefined;
          percentAchievements[5000] = defaultUndefined;

					var keys = Object.keys(percentAchievements)
					var i;
					for(i = 0; i < keys.length; i++){
						if( totalPercentWithMultiplier >= keys[i] && totalPercentWithMultiplier < (keys[i+1] || (keys[i] + 1)) ){

								if((playerListDict[data.id]["highestPercentAchievement"] || -1) < Number(keys[i])){
									sendNetworkMessage(playerName + percentAchievements[keys[i]]);
                  var highestPercentAchievement = Number(keys[i])
									playerListDict[data.id]["highestPercentAchievement"] = highestPercentAchievement;
									playerListDict[data.id]["percentMultiplier"]++;
									playerListDict[data.id]["activityMinutesEarnedPerHour"] = "0".repeat(60)
                  if(playerListDict[data.id].userid !== undefined)
                    addhighestPercentAchievementToPlayer(playerListDict[data.id].userid, highestPercentAchievement)
								}

							break
						}
					}


				}
			}
			else // greater than two minutes
			{
				//delete playerListDict[data.id]["lastDrawn"]
				//streak broken
				//updatePlayerTime(data.id);
			}
			playerListDict[data.id]["lastDrawn"] = now;
		}
	}else{
		playerListDict[data.id]["lastDrawn"] = now;
	}

}

function getSum(total, num) {
  return Number(total) + Number(num);
}

function zeroAPlayer(id){
  playerListDict[id]["activityMinutesEarnedPerHour"] = "0".repeat(60);
  playerListDict[id]["highestPercentAchievement"] = 0;
  playerListDict[id]["percentMultiplier"] = 0;
}

function getPercentStreakLastHour(id){
	if(playerListDict[id]["activityMinutesEarnedPerHour"] == undefined){
		console.log("getPercentStreakLastHour activityMinutesEarnedPerHour undefined", playerListDict[id]);
    zeroAPlayer(id)
	}
	var lastHourMinEarned = playerListDict[id]["activityMinutesEarnedPerHour"].split('').reduce(getSum);
	var percentlasthour = Math.ceil((lastHourMinEarned/60)*100);
  if(percentlasthour >= 90)
    percentlasthour = 100
	//console.log(playerListDict[id], "percent last hour", percentlasthour + "%")
	return percentlasthour
}

function getGraphStreakLastHour(id){

	return playerListDict[id]["activityMinutesEarnedPerHour"].replace(/1/g, "⚫").replace(/0/g,"⚪") + "...✏️";

}

function chatmessagecallback(data){
	//console.log(data);
	//just my name = reveal your stats
	//		current session
	//		activityMinutes/totalMinutes
	//		all time
	//		activityMinutes/totalMinutes
	var playerReputation = 0
	if(playerListDict[data.id] !== undefined){

		if(playerListDict[data.id].lastMessageTimestamp !== undefined){
			var diff = Date.now() - playerListDict[data.id].lastMessageTimestamp
			var diffSec = Math.floor(diff * 0.001)
			if(diffSec <= 1){ //1 second
				return;
			}

		}

		playerListDict[data.id].lastMessageTimestamp = Date.now()
		playerReputation = playerListDict[data.id].reputation
	}

	var myNameSentence = "Hello, I'm guildbot. I manage guilds and track activity! type gc? or ac? for more guilds and activity commands.";
  
	var acOptions = "options: activeminutes|am, drawingstreak|ds, brushstats|bs, takebreak|tb, streakleaders|sl, activehours|ah" //, idletime(not yet), averagecolor(not yet)"
	var gcOptions = "options: join, leave, info, stats, leaderboard(lb), guildevent(ge), setguildevent, setguildinfo, guildmembers";

	if(data.userid == myUserId || data.user == "SERVER") return;
	if(data.message.trim() == "@guildbot" || data.message == myname || data.message == "@gb" )
	{
		sendNetworkMessage(myNameSentence);
		return;
	}
	if(data.message.trim() == "ac?"){
		var sentence = "example: '@gb activeminutes' | " + acOptions;
		sendNetworkMessage(sentence)
		return;
	}
	if(data.message.trim() == "gc?"){
		var sentence = "example: '@gb join pAINT' | " + gcOptions;
		sendNetworkMessage(sentence)
		return;
	}
  if(data.message.trim() == "@gb guildmembers" || data.message.trim() == "@guildbot guildmembers" ){
    if( data.userid == undefined ){
      sendNetworkMessage("You are not logged in.")
			return;
    }
    var dataRow = getMyGuildStuff(data.userid)
		if(dataRow == undefined){
			sendNetworkMessage("You are not in any guild. Type gc? for commands.")
			return;
		}
    loginNoHash(myemail, passwordHash, function(e){
       if(e){
         console.log(e);
         return
       }
       var guildid = dataRow.guildid
       var guildMembersAll = guildsdb.prepare(`
         select * from guildmembers join players on guildmembers.userid = players.userid where currentguildid = ? order by lastJumpedGuildsTimestamp ASC`).all(guildid)
       //guildsdb.prepare('DETACH activity').run()
       var response = "";
       var i = 0;
       for(i = 0; i < guildMembersAll.length; i++){
         response += (i+1) + ". " + guildMembersAll[i].name + "(" +  guildMembersAll[i].activityMinutes + ")";
         if( i !== guildMembersAll.length - 1)
           response += ", "
       }
       //sendNetworkMessage(response);
       sendMessage(data.userid, response, function(err, data){
          console.log("err",err, "data", data)
          if(err)
            sendNetworkMessage(err)
          else {
            sendNetworkMessage("I sent you a pm with what you requested.")
          }
       });

     });
  }
	if(data.message.trim() == "ge?" || data.message.trim() == "guildevent?" || data.message.includes("@gb guildevent") || data.message.includes("@gb ge")) {
		if(data.userid == undefined){
			sendNetworkMessage("You are not logged in.")
			return;
		}
		var dataRow = getMyGuildStuff(data.userid)
		if(dataRow == undefined){
			sendNetworkMessage("You are not in any guild. Type gc? for commands.")
			return;
		}
		if(dataRow.currentevent == undefined){
			if(dataRow.leaderUserId == data.userid){
				sendNetworkMessage("There is no event set yet. To set an event type @gb setguildevent Example guild event text here.");
			}
			var leaderInfo = getPlayersStatsFromDb(dataRow.leaderUserId)

			sendNetworkMessage("There is no event made by your guild leader " +leaderInfo.name + " yet." )
			return;
		}
		sendNetworkMessage(dataRow.guildname + " event: " + dataRow.currentevent)
	}
	var guildname = data.message.replace("@guildbot","").replace("@gb", "").replace("join","").replace("stats","").replace("info","").trim()
	guildname = guildname.replace("[","").replace("]","").replace("<","").replace(">","");
	console.log(data.user, data.message)

	if(data.message.includes("@guildbot") || data.message.includes("@gb")){
		if(data.message.indexOf("@gb join") == 0 || data.message.indexOf("@guildbot join") == 0) {
			var response = "";


			if(guildname.length > 0){
				if(guildname.length < 16){
					if(data.userid !== undefined){
						joinGuildDb(data.userid, guildname, playerReputation, function(message){
							sendNetworkMessage(message);
						});
					}
					else
						sendNetworkMessage(response + "You must be logged in to join a guild.")
				}
				else
					sendNetworkMessage(response + "Guild names can only be 16 characters maximum")
			}
			else
				sendNetworkMessage("Guild names need to be more than 0 characters.")
		}
		else if(data.message.includes("@gb info")) {

			if(guildname.length == 0){
				//get my guild's info
				if(data.userid !== undefined){
					var dataRow = getMyGuildStuff(data.userid)
					console.log("info")
					console.log(dataRow);
					if(dataRow){
            var guildinfo = dataRow.guildinfo;
            if(guildinfo == undefined){
              sendNetworkMessage("There is no guild info set yet! Check back soon! To set use @gb setguildinfo")
  						return;
  					}
  					sendNetworkMessage(guildinfo);
					}
					else{
						sendNetworkMessage("You are not in any guild. Type gc? for commands.")
					}
				}
			}
			else{
				//get guild's info
				getGuildFromName(guildname, function(err, guild){
					if(err){
						sendNetworkMessage(err)
						return;
					}
					var guildinfo = guild.guildinfo;
          if(guildinfo == undefined){
            sendNetworkMessage("There is no guild info set yet! Check back soon! To set use @gb setguildinfo")
						return;
					}
					sendNetworkMessage(guildinfo);
				});

			}
		}
    else if(data.message.includes("@gb stats")) {

			if(guildname.length == 0){
				//get my guild's stats
				if(data.userid !== undefined){
					var dataRow = getMyGuildStuff(data.userid)
					console.log("stats")
					console.log(dataRow);
					if(dataRow){
            getStatsForGuildDb(dataRow.guildid, function(totalActivityMinutes, totalMinutes, memberCount){
            	var leaderInfo = getPlayersStatsFromDb(dataRow.leaderUserId)
            	var membersText = " members";
            	if(memberCount <=1)
            		membersText = " member"
            	sendNetworkMessage(dataRow.guildname +" is led by " + leaderInfo.name + " with " + memberCount + membersText + ". Stats: Total active minutes:" + totalActivityMinutes + " Total Minutes Overall: " + totalMinutes);
            });
					}
					else{
						sendNetworkMessage("You are not in any guild. Type gc? for commands.")
					}

				}
			}
			else{
				//get guild's stats
				getGuildFromName(guildname, function(err, guild){
					if(err){
						sendNetworkMessage(err)
						return;
					}
					var guildid = guild.guildid;
					var leaderInfo = getPlayersStatsFromDb(guild.leaderUserId)
					getStatsForGuildDb(guildid, function(totalActivityMinutes, totalMinutes, memberCount){
						var membersText = " members";
						if(memberCount <=1)
							membersText = " member"
						sendNetworkMessage(guild.guildname +" is led by " + leaderInfo.name + " with " + memberCount + membersText + ". Stats: Total active minutes:" + totalActivityMinutes + " Total Minutes Overall: " + totalMinutes);
					});

				});

			}
		}
		else if (data.message.includes("@gb leave")) {

			if(data.userid !== undefined)
			if(guildname.length > 0){
				getGuildFromName(guildname, function(err, guild){
					if(err){
						sendNetworkMessage(err)
						return;
					}
					var guildid = guild.guildid;
					var response = leaveGuildDb(data.userid, guildId);
					sendNetworkMessage(response)
				});
			}
			else{
				if(data.userid !== undefined){
					result = getMyGuildStuff(data.userid)
					var iExist = result.count != 0;
					if (iExist && iExist.guildid > -1){

						var response = leaveGuildDb(data.userid, iExist.guildid);
						sendNetworkMessage(response)

					}
				}
				//sendNetworkMessage("Please type out the full name of the guild you're leaving");
			}
		}
		else if(data.message.includes("@gb leaderboard") || data.message.includes("@gb lb")) {
			//guildsdb.prepare('attach "activity.db" as activity').run()
			var topFourGuildStats = guildsdb.prepare(`
				select guildname,
				count(*) as MemberCount,
				sum(activityMinutes) as TotalActivityMinutes,
				sum(totalMinutes) as TotalMinutes,
				(SELECT players.name FROM players WHERE players.userid = guilds.leaderUserId) as Leader
					from players
					join guildmembers on players.userid = guildmembers.userid
					join guilds on guilds.guildid = currentguildid
					group by currentguildid
					order by TotalActivityMinutes
					DESC limit 4`).all()
			//guildsdb.prepare('DETACH activity').run()
			var response = "";
			var i = 0;
			for(i = 0; i < topFourGuildStats.length; i++){
				response += (i+1) + ". " + topFourGuildStats[i].guildname + "(" + topFourGuildStats[i].TotalActivityMinutes + ")";
				if( i !== topFourGuildStats.length - 1)
					response += ", "
			}
			sendNetworkMessage(response);
		}
    else if(data.message.indexOf("@gb setguildinfo") == 0){
			guildInfo = data.message.replace("@gb setguildinfo", "").trim();
			if(data.userid == undefined){
				sendNetworkMessage("You are not logged in.")
				return;
			}
			var dataRow = getMyGuildStuff(data.userid)
			if(dataRow == undefined){
				sendNetworkMessage("You are not in any guild. Type gc? for commands.")
				return;
			}

			if(data.userid !== dataRow.leaderUserId){
				var leaderInfo = getPlayersStatsFromDb(dataRow.leaderUserId)
				sendNetworkMessage("You are not the leader of guild " + dataRow.guildname + ". " + leaderInfo.name + " is the guild leader.");
				return;
			}

			if(guildInfo.length > 0 && guildInfo.length < 196){
				setGuildInfo(dataRow.guildid, guildInfo);
				sendNetworkMessage("Guild info set.")
			}else{
				sendNetworkMessage("Guild info must be between 0 and 196 characters");
			}
		}
		else if(data.message.indexOf("@gb setguildevent") == 0){
			guildEvent = data.message.replace("@gb setguildevent", "").trim();
			if(data.userid == undefined){
				sendNetworkMessage("You are not logged in.")
				return;
			}
			var dataRow = getMyGuildStuff(data.userid)
			if(dataRow == undefined){
				sendNetworkMessage("You are not in any guild. Type gc? for commands.")
				return;
			}

			if(data.userid !== dataRow.leaderUserId){
				var leaderInfo = getPlayersStatsFromDb(dataRow.leaderUserId)
				sendNetworkMessage("You are not the leader of guild " + dataRow.guildname + ". " + leaderInfo.name + " is the guild leader.");
				return;
			}

			if(guildEvent.length > 0 && guildEvent.length < 196){
				setGuildEvent(dataRow.guildid, guildEvent);
				sendNetworkMessage("Guild event set.")
			}else{
				sendNetworkMessage("Guild event must be between 0 and 196 characters");
			}
		}
		else if(data.message.includes("activeminutes") || data.message.includes("am")){
			if(data.userid !== undefined){
				var rowsFromDatabase = getPlayersStatsFromDb(data.userid);
				console.log(rowsFromDatabase)
				giveUserActivity(data.id, rowsFromDatabase)

			}
		} else if (data.message.includes("activehours") || data.message.includes("ah")) {
            if(data.userid !== undefined){
                var rowsFromDatabase = getPlayersStatsFromDb(data.userid);
                console.log(rowsFromDatabase);
                giveUserActivityHours(data.id, rowsFromDatabase);

            }
        }
    else if (data.message.includes("streakleaders") || data.message.includes("sl")){
      var topStreaks = guildsdb.prepare(`select name, activityMinutes, highestPercentAchievement from players
      where highestPercentAchievement > 0
      order by highestPercentAchievement desc, activityMinutes desc limit 5;`).all();
      var sentence = "";
      if(topStreaks !== undefined){
        var i = 0
        for(i = 0; i < topStreaks.length; i++){
          var streakHr = topStreaks[i].highestPercentAchievement / 100;
          var hr = (streakHr == 1) ? " hour" : " hours";
          var name = topStreaks[i].name
          sentence += (i+1) + ". " + name + " " + streakHr + hr;
          if(i+1 < topStreaks.length)
            sentence += ", ";
        }//hi
        sendNetworkMessage(sentence);
      }
    }
		else if(data.message.includes("drawingstreak") || data.message.includes("ds")){
      var con= "";

      if( playerListDict[data.id]["percentMultiplier"] !== undefined && playerListDict[data.id]["percentMultiplier"] > 0)
        con = " + " + playerListDict[data.id]["percentMultiplier"] + " hrs"
			sendNetworkMessage(getGraphStreakLastHour(data.id) +" "+ getPercentStreakLastHour(data.id) + "%" + con)
		}
		else if(data.message.includes("brushstats") || data.message.includes("bs") || data.message.trim() == "@brushstats"){
			var sentence = "Average brush size: " + Math.round((playerListDict[data.id]["averageBrushSize"] || 0));
			sentence += ", Average brush stroke length: " +  Math.round((playerListDict[data.id]["averageLineLength"] || 0))
      if(data.userid !== undefined){
        var rowsFromDatabase = getPlayersStatsFromDb(data.userid);
        var total = (playerListDict[data.id]["totalBrushSizeSampleSize"] || 0) + (rowsFromDatabase.totalBrushSizeSampleSize || 0)
        sentence += ", Lifetime brush strokes total: " + total;
      }
      else{
        sentence += ", Session brush strokes total: " + (playerListDict[data.id]["totalBrushSizeSampleSize"] || 0)
      }
			sendNetworkMessage(sentence)
		}
		else if(data.message.includes("takebreak") || data.message.includes("tb")){
      if(blacklistUserids.includes(data.userid)) return;
			playerListDict[data.id]["takebreakTimestamp"] = Date.now();
			sendNetworkMessage("You are now on a 15 minute drawing streak break. Just draw to kick off your streak again. You will be given a 2 minute warning.")
		}
		else if(data.message.includes("options") || data.message.includes("commands")){
			sendNetworkMessage(options)
		}
		else if((data.userid == 30267 || data.userid == 2659 )&& data.message.includes("saveall")){
			console.log("controller.forcesave true");
			controller.forcesave = true
		}


	}
}
function getGuildFromName(guildname, callback){
	const guildStmt = guildsdb.prepare('SELECT count(*) as count, * from guilds where guildname like ?');
	var guild = guildStmt.get(guildname);
	var guildExists = guild.count != 0;
	if(guildExists){
		//var guildId = guild.guildid;
		callback(undefined, guild)
	}
	else
		callback("Guild does not exist.");
}

function getGuildNameFromId(guildid, callback){
	const guildStmt = guildsdb.prepare('SELECT count(*) as count, guildname from guilds where guildid = ?');
	var guild = guildStmt.get(guildid);
	var guildExists = guild.count != 0;
	if(guildExists){
		var guildname = guild.guildname;
		if(callback)
			callback(undefined ,guildname)
		return guildname
	}

	if(callback)
		callback("Guild does not exist.");
}

function giveUserActivity(playerid, rowsFromDatabase){
	var sentence = ""
	if(playerid !== undefined && playerListDict[playerid] !== undefined){
		sentence += "<Current Session Active Minutes:"+ playerListDict[playerid].activityMinutes;
		//sentence += "/" + playerListDict[playerid].totalMinutes;

		if(rowsFromDatabase){
			sentence += "><"
			sentence += "All Time Active Minutes:" + (playerListDict[playerid].activityMinutes + rowsFromDatabase.activityMinutes);
			//sentence += "/" + (rowsFromDatabase.totalMinutes + playerListDict[playerid].totalMinutes);

		}
		sentence += ">";
		var percentlasthour = getPercentStreakLastHour(playerid)
		if(percentlasthour > 0){
			var insertingMultiplier = ""
			if(playerListDict[playerid]["percentMultiplier"] > 0){
				var totalPercentWithMultiplier = percentlasthour + (100 * playerListDict[playerid]["percentMultiplier"])
				insertingMultiplier = " + " + playerListDict[playerid]["percentMultiplier"]+ " consecutive hrs";

			}

			sentence += " " +percentlasthour+"% active drawing in past hour!" + insertingMultiplier;


		}
    if(rowsFromDatabase && rowsFromDatabase.highestPercentAchievement > 0){
      sentence += " Your longest streak was " + (rowsFromDatabase.highestPercentAchievement /100) + "hr!"
    }

		sendNetworkMessage(sentence);
	}
	else{
		sendNetworkMessage("I have no record of you")
		console.log("I have no record of you", playerid, playerListDict, playersThatLeftInLast10Minutes)
	}
}

function HelloWorld(){
	sendNetworkMessage("Hello, im @activitybot. type '@activitybot' to see options for viewing your drawing activity!")
}

function giveUserActivityHours(playerid, rowsFromDatabase){
    var sentence = ""
    if(playerid !== undefined && playerListDict[playerid] !== undefined){
        var minutes_total= playerListDict[playerid].activityMinutes + (rowsFromDatabase? rowsFromDatabase.activityMinutes : 0);
        var summary_hours= Math.floor(minutes_total/60.0);
        var summary_minutes= minutes_total%60;

        sentence += "<All Time Activity: "+ summary_hours + "h " + summary_minutes + "m>";
        //sentence += "/" + playerListDict[playerid].totalMinutes;

        sendNetworkMessage(sentence);
    }
    else{
        sendNetworkMessage("I have no record of you")
        console.log("I have no record of you", playerid, playerListDict, playersThatLeftInLast10Minutes)
    }
}

function sendNetworkMessage(message){
  if(message.length > 254){
    console.log("culled message", message, message.length)
    message = message.substr(0, 254)
    }
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
      socket.emit("uKey", myLoginKey);
      privateChatServerSocket.emit("listen", myLoginKey);
			setTimeout(callback, 0)
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", loginServer + "/login?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
	req.send();
}

function setLeaderOfGuild(guildId, userid){
	guildsdb.prepare("update guilds set leaderUserId = ? where guildId = ?").run(userid, guildId);
}

function someoneLeftGuild(guildId, userid){
	// if guildcount <= 1 then delete guild
	// else if youre the leader of the guild give leader to next seniority person

	var result = guildsdb.prepare("select count(*) as count, *  from guildmembers where currentguildid = ? AND userid != ? ORDER BY createdTimestamp ASC").get(guildId, userid);
		var nextSeniorityId = result.userid
		console.log("nextSeniorityId", nextSeniorityId, "me", userid);
		if(result.count == 0){
			guildsdb.prepare("delete from guilds where guildid = ?").run(guildId) // guild disbanded
		}
		else{
			var resultguild = guildsdb.prepare("select * from guilds where guildId = ?").get(guildId);
			if( nextSeniorityId !== undefined && resultguild.leaderUserId !== undefined && resultguild.leaderUserId == userid){ // Am i leader of guild im leaving?
				// give leader to next seniority person
				setLeaderOfGuild(guildId, nextSeniorityId)

			}
			else{
				//im not the leader im just leaving
				return -1
			}
		}
		return nextSeniorityId;
}

function setGuildEvent(guildid, guildevent){
	guildsdb.prepare("update guilds set currentevent = ?, eventCreatedTimestamp = ? where guildid = ?").run(guildevent, Date.now(), guildid);
}
function setGuildInfo(guildid, guildinfo){
	guildsdb.prepare("update guilds set guildinfo = ? where guildid = ?").run(guildinfo, guildid);
}
function getMyGuildStuff(userid){
	var result = guildsdb.prepare("select userid, guildid, guildname, guildinfo, leaderUserId, currentevent, eventCreatedTimestamp, lastViewedEventCreatedTimestamp from guildmembers join guilds on guildid = currentguildid where userid = ?").get(userid);

	return result
}

function getStatsForGuildDb(guildid, callback){

	var guildmembersInGuild = guildsdb.prepare("select userid from guildmembers where currentguildid = ?").all(guildid)
	temparr = [];
	var i = 0;
	for(i = 0; i < guildmembersInGuild.length; i++){
		temparr.push(guildmembersInGuild[i].userid);
	}
	var playersInGuild = guildsdb.prepare("select * from players where userid in (" + temparr.join() + ")").all();
	i=0;
	var totalActivityMinutes = 0;
	var totalMinutes = 0;
	for(i = 0; i < playersInGuild.length; i++){
		//total activity mints
		// total minutes
		totalActivityMinutes += playersInGuild[i].activityMinutes || 0;
		totalMinutes += playersInGuild[i].totalMinutes || 0;
	}
	callback(totalActivityMinutes, totalMinutes, guildmembersInGuild.length);

}

function leaveGuildDb(userid, guildid, setNewGuildId){
	console.log(userid, guildid, setNewGuildId)
	var guildname = ""
	getGuildNameFromId(guildid, function(err, resp){
		//if(err)
			//return "Guild requested to leave doesnt exist";
		guildname = resp;
	});


	var response = "";

	var guildId = guildid;
	var nextSeniorityId = someoneLeftGuild(guildId, userid)

	if(nextSeniorityId == -1){ // regular leaving
		response += "You have left " + guildname +"⚐";
	}
	else if(nextSeniorityId == undefined )
		response += guildname + " has 0 members and has been disbanded"
	else
		response += "👑 New leader of " + guildname + " is " + getPlayersStatsFromDb(nextSeniorityId).name;




	guildsdb.prepare("update guildmembers set currentguildid = ?, lastJumpedGuildsTimestamp = ? where userid = ?").run(setNewGuildId, Date.now(), userid);
	return response
}

function joinGuildDb(userid, guildname, playerReputation, callback){

	//can only change guilds once every 24 hours
	//if guild has you as it's only member and you leave then guild is deleted

	const guildMemberStmt = guildsdb.prepare('select count(*) as count, currentguildid, lastJumpedGuildsTimestamp from guildmembers where userid = ?');
	var guildMember = guildMemberStmt.get(userid);
	console.log(guildMember);

	var guildMemberExists = guildMember.count != 0;
	var currentGuildId = guildMember.currentguildid;
	var lastJumpedGuildsTimestamp = guildMember.lastJumpedGuildsTimestamp;
	var jumptoosoonTIME = twentyfourHoursInMilliseconds;
	var jumpedTooSoon = (Date.now() - lastJumpedGuildsTimestamp) < jumptoosoonTIME;
	var timeleft = jumptoosoonTIME - (Date.now() - lastJumpedGuildsTimestamp)
	if(guildMemberExists && jumpedTooSoon){
		console.log("jumpedTooSoon", jumpedTooSoon)
		if(callback)
			callback("You must wait " + prettyMilliseconds(timeleft) + " until you join another guild");
		return;
	}


	const guildStmt = guildsdb.prepare('SELECT count(*) as count, guildid from guilds where guildname like ?');
	var guild = guildStmt.get(guildname);
	console.log("guild")
	console.log(guild);

	var guildExists = guild.count != 0;
	var createdGuild = false;
	var guildId = undefined;
	var response = ""

	if(guildExists == false){
		if(playerReputation < 30)
		{
			if(callback)
				callback("Guild does not exist. You must wait until 30 rep to create a guild.");
			return;
		}
		createdGuild = true;
		guildsdb.prepare("INSERT INTO guilds(guildname, createdTimestamp) VALUES(?, ?)").run(guildname, Date.now());
		var result = guildsdb.prepare("SELECT count(*) as count, guildid from guilds where guildname like ?").get(guildname);
		guildId = result.guildid;
		console.log("INSERT INTO", result)
		setLeaderOfGuild(guildId, userid)
		response += "You have created the guild " + guildname +" and are now the leader. 👑";
		//insertMemberIntoGuild(guildId, userid, createdGuild, callback);

	}
	else{

		guildId = guild.guildid;
		var sameGuild = currentGuildId == guildId;
		if(guildMemberExists && sameGuild){
			console.log("same guild", sameGuild)
			if(callback)
				callback("You are already in this guild.");
			return;
		}
		var guildNameInDb = getGuildNameFromId(guildId)

		response += "⚑ ⚐ You are now a bannered with guild " + guildNameInDb + " ⚐ ⚑";
		//insertMemberIntoGuild(guildId, userid, createdGuild, callback);
	}

	if(guildMemberExists == false){
		guildsdb.prepare("INSERT INTO guildmembers(currentguildid, userid, lastJumpedGuildsTimestamp, createdTimestamp) VALUES(?, ?, ?, ?)").run(guildId, userid, Date.now(), Date.now());
	}
	else{
		var guildAlreadyExists = true;
		response += leaveGuildDb(userid, currentGuildId, guildId)
		//response += "";//disbanded/ who is leader/ what guild did i leave
	}
	if(callback)
		callback(response);

}

function displayall(){
	console.dir(guildsdb.prepare("SELECT guildid, guildname, leaderUserId from guilds").all())

	console.dir(guildsdb.prepare("SELECT currentguildid, userid from guildmembers").all())

	//console.dir(activitydb.prepare("SELECT * from players where userid = 87").all())
	console.log("------------------------------------------")
}
function sendMessage (to, message, callback) {
  //
	request("/sendmessage", {
		uKey: myLoginKey,
		to: to,
		message: message
	}, parseData.bind(this, function (err, data) {
		if (err || !data || data.error || data.err) {
			callback(err || data.error || data.err, data);
			return;
		}

		callback(null, data);
	}));
};

// Make a get request to the message server to the given path with the given options
// Callback returns (err, request) with error being a string with the http error (human readable)
// Request is the XMLHttpRequest with readyState == 4
function request (path, options, callback) {
	var req = new XMLHttpRequest();

	// Build the get parameter string
	var optionString = "?";

	// Add options to the string, uri encoded
	for (var k in options) {
		optionString += encodeURIComponent(k) + "=" + encodeURIComponent(options[k]) + "&";
	}

	// Remove trailing &
	optionString = optionString.slice(0, optionString.length - 1);


	req.addEventListener("readystatechange", function (event) {
		if (req.readyState == 4) {
			var err;

			if (req.status !== 200) {
				err = "Http error: " + req.status + " are you connected to the internet?";
			}

			callback(err, req);
		}
	});
  console.log(privateChatServer + path + optionString)
	req.open("GET", privateChatServer + path + optionString);
	req.send();
};
// Parses the server returned data as a JSON object
// Callback gives err if err was already defined or if the JSON parsing failed
// Callback (err, data)
function parseData (callback, err, request) {
	if (err) {
		callback(err);
		return;
	}

	try {
		var data = JSON.parse(request.responseText);
	} catch (e) {
		err = "JSON Parse error. Server response was: " + request.responseText;
	}
  if(data == undefined)
    return

	if (data.error) {
		callback(data.error)
		return;
	}

	callback(err, data);
};



startClient()
