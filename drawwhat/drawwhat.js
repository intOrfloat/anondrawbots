var server = "https://direct.anondraw.com:2556"
var socket = require('socket.io-client')(server, { transports: ['websocket'] });
var CryptoJS = require("crypto-js");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

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
var lastestmsgtime =  Date.now();
var blacklist = [];
var playerListLive = []
var daily = undefined
var whitelist = "18145,10890,15197,2659,30698"; //exclusive for dd
var ddline = "";


const Database  = require('better-sqlite3');
dwdb = new Database('dw.db');
dwdb.prepare(`CREATE TABLE IF NOT EXISTS players
(
  userid integer primary key NOT NULL,
  name varchar(255),
	blacklisted INT default 1,
	firstseen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();
dwdb.prepare(`CREATE TABLE IF NOT EXISTS submissions
(
  subid integer primary key NOT NULL,
	subtype varchar(32),
  submissiontext varchar(255),
	userid integer,
	added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run(); // subtype is nsfw and sfw
dwdb.prepare(`CREATE TABLE IF NOT EXISTS report
(
  reportid integer primary key NOT NULL,
  subid integer,
	userid integer,
	added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();
dwdb.prepare(`CREATE TABLE IF NOT EXISTS dailydare
(
  dareid integer primary key NOT NULL,
  daretitle varchar(255),
  coords varchar(255),
  userid integer,
  added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();
dwdb.prepare(`CREATE TABLE IF NOT EXISTS contest
(
    contestid integer primary key NOT NULL,
    contesttitle varchar(255),
    coords varchar(255),
    userid integer,
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();

function startClient(){

  socket.on('playerlist', function(data){
    playerListLive = data;
  });
	socket.emit("changename", myname, function(e){
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
  var backupPlayerList = playerListLive;
  if(data.userid == myUserId) {
    myId = data.id
    return;
  }
  var currenttime = Date.now();
  if (currenttime - lastestmsgtime < 1000)
    return;
  if(data.user == "SERVER")
    return;
  else if (data.message == "contest?"){
    var contestdb = getContest()
    if(contestdb){
      sendNetworkMessage(contestdb.contesttitle + " " + contestdb.coords + " 🦊");
    }else{
      sendNetworkMessage("No Contest on record")
    }
  }
  else if (/contest\+/.test(data.message) && data.user != myname && data.user != "SERVER"){
    if(!whitelist.includes(data.userid)) { //if not whitelisted cant use this command
      return;
    }
    var cleaningmsg = data.message.replace(/['"]+/g, ""); //removes quotation marks for safety i think it could break the code
    var cleaningmsg = cleaningmsg.replace("contest+ ", "");
    var cleaningmsg = cleaningmsg.replace("contest+", "");

    if (cleaningmsg !== "" && cleaningmsg.includes("++")){
      var title = cleaningmsg.replace(/\+\+(.*)$/, "");
      var coords = cleaningmsg.replace(/^(.*)\+\+/, "");
      addContest(data.userid, title, coords)
      sendNetworkMessage( title + " " + coords + " 🦊");

    }

  }
  else if (data.message == "@dailydare" || data.message == "dd?" || data.message == "@dd?") {
    var dailydb = getDailyDare();
    if(dailydb){
      sendNetworkMessage(dailydb.daretitle + " " + dailydb.coords + " 🦊");
    }else{
      sendNetworkMessage("No daily dare on record")
    }

  }
  else if (/@dailydare\+|dd\+|@dd\+/.test(data.message) && data.user != myname && data.user != "SERVER"){
    if(!whitelist.includes(data.userid)) { //if not whitelisted cant use this command
    	return;
    }

    var cleaningmsg = data.message.replace(/['"]+/g, ""); //removes quotation marks for safety i think it could break the code
    var cleaningmsg = cleaningmsg.replace("@dailydare+ ", "");
    var cleaningmsg = cleaningmsg.replace("@dailydare+", "");
    var cleaningmsg = cleaningmsg.replace("@dd+ ", "");
    var cleaningmsg = cleaningmsg.replace("@dd+", "");
    var cleaningmsg = cleaningmsg.replace("dd+ ", "");
    var cleaningmsg = cleaningmsg.replace("dd+", "");

    if (cleaningmsg !== "" && cleaningmsg.includes("++")){

      var title = cleaningmsg.replace(/\+\+(.*)$/, "");
      var coords = cleaningmsg.replace(/^(.*)\+\+/, "");
      daily = {title:title, coords:coords};
      addDailyDare(data.userid, title, coords)
      sendNetworkMessage( title + " " + coords + " 🦊");
      ddline = title + " " + coords + " 🦊";

    }
  }
  else if( data.message == "@xxxdw?" || data.message == "@xxx?" || data.message == "xxx?" || data.message == "@drawwhat?" || data.message == "@dw?" || data.message == "dw?" ) {
      if(blacklist.includes(data.userid)) {
        return;
      }
      if(data.userid === undefined){
        var currenttime = Date.now();
        sendNetworkMessage("sorry but you need do be logged in order to use the bot! 💡");
        return;
      }
      var type = 'sfw';
      if(data.message.includes('xxx')) type = 'nsfw';

      var randomdb = getRandomSubmission(type);
      var randomElement = randomdb.submissiontext + (type == 'nsfw' ? " 🔞" : "");
      if (randomElement.length > 255 - data.user.length - 3) {
        sendNetworkMessage(randomElement);
      } else {
        sendNetworkMessage("@" + data.user + ": " + randomElement);
      }

  }
  else if (data.message == "@xxxdw-" || data.message == "@xxx-" || data.message == "xxx-" || data.message == "@drawwhat-" || data.message == "@dw-" || data.message == "dw-") {
    if(blacklist.includes(data.userid)) {
      return;
    }
    if(data.userid === undefined){
      var currenttime = Date.now();
      sendNetworkMessage("sorry but you need do be logged in order to use the bot! 💡");
      return;
    }
    var type = 'sfw';
    if(data.message.includes('xxx')) type = 'nsfw';

    var latestentry = getLatestSubmission(data.userid, type)
    if(latestentry == ""){
      sendNetworkMessage("you have no entries in this category.")
      return;
    }
    removeLatestSubmission(data.userid, type);
    sendNetworkMessage("@" + data.user + ": "+ (type == 'nsfw'?"🔞":"") +" Your lastest entry "+(latestentry ==undefined ? "" : "("+latestentry+")")+" is removed");
  }
  else if (data.message == "@xxxdw+" || data.message == "@xxx+" || data.message == "xxx+" || data.message == "@drawwhat+" || data.message == "@dw+" || data.message == "dw+") {
    if(blacklist.includes(data.userid)) {
      return;
    }
    if(data.userid === undefined){
      var currenttime = Date.now();
      sendNetworkMessage("sorry but you need do be logged in order to use the bot! 💡");
      return;
    }
    var type = 'sfw';
    if(data.message.includes('xxx')) type = 'nsfw';

    if(type == 'sfw'){
      sendNetworkMessage("@" + data.user + ": 💡 The proper way to add ideas is dw+ your suggestion");
    }
    else {
      sendNetworkMessage("Send xxx? to retrieve random NSFW ideas for drawing. To input NSFW ideas instead, send xxx+ your idea (troll = blacklist). 🔞");
    }
  }
	else if ( ( /@xxxdw\+|@xxx\+|xxx\+/.test(data.message) || /@drawwhat\+|@dw\+|dw\+/.test(data.message) ) && data.user != myname && data.user != "SERVER") {
    var cleaningmsg = data.message.replace(/ +(?= )/g,''); //remove multiple spaces
    //var cleaningmsg = cleaningmsg.replace(/,/g, ""); //remove commas
    //var cleaningmsg = cleaningmsg.replace(/\?/g, "");
    //var cleaningmsg = cleaningmsg.replace(/\!/g, "");
    //var cleaningmsg = cleaningmsg.replace(/\./g, "");
    var cleaningmsg = cleaningmsg.replace(/\s+$/, ''); //remove spaces in the end
    var cleaningmsg = cleaningmsg.replace(/['"]+/g, "'");	//remove quotation marks using ' instead
    var cleaningmsg = cleaningmsg.replace("@xxxdw+ ", "");
    var cleaningmsg = cleaningmsg.replace("@xxxdw+", "");
    var cleaningmsg = cleaningmsg.replace("xxx+ ", "");
    var cleaningmsg = cleaningmsg.replace("xxx+", "");
	  var cleaningmsg = cleaningmsg.replace("dw+ ", "");
    var cleaningmsg = cleaningmsg.replace("dw+", "");
    var cleaningmsg = cleaningmsg.replace(/(?:^(the|a|an) +)/i,""); //remove 'the' 'a' and 'an' from the start to avoid duplicates
    var playerobj = backupPlayerList.find(x => x.userid === data.userid);
		if (playerobj.reputation<10) {
		    sendNetworkMessage("sorry but you need at least 10rep to add values! 💡");
    }
    var type = 'sfw';
    if(data.message.includes('xxx')) type = 'nsfw';
    console.log("message:", cleaningmsg)

    console.log(data);
    submitSubmition(data.userid, type, cleaningmsg, data.user)
    var message = "@" + data.user + ": User entry #" + getSubmissionCount(data.userid, type) + " added to ";
    if(type == 'nsfw')
      message += getTotalNSFWSubmissionsCount() + " xxx ideas. Thanks! 🔞"
    else
      message += getTotalSFWSubmissionsCount() +" ideas. Thanks!"
    sendNetworkMessage(message);
  }
}
function addContest(userid, title, coords){
  dwdb.prepare("insert into contest (contesttitle, coords, userid) values (?, ?, ?)").run(title, coords, userid);
}
function getContest(){
  return dwdb.prepare("select * from contest order by added desc limit 1").get()
}
function addDailyDare(userid, title, coords){
  dwdb.prepare("insert into dailydare (daretitle, coords, userid) values (?, ?, ?)").run(title, coords, userid);
}
function getDailyDare(){
  return dwdb.prepare("select * from dailydare order by added desc limit 1").get()
}

const randNsfwStmt = dwdb.prepare("SELECT submissiontext FROM submissions where subtype = 'nsfw' ORDER BY RANDOM() LIMIT 1");
const randSfwStmt  = dwdb.prepare("SELECT submissiontext FROM submissions where subtype = 'sfw' ORDER BY RANDOM() LIMIT 1");
const countStmt    = dwdb.prepare("SELECT count(*) as count from submissions");
const countNSFWStmt    = dwdb.prepare("SELECT count(*) as count from submissions where subtype = 'nsfw'");
const countSFWStmt    = dwdb.prepare("SELECT count(*) as count from submissions where subtype = 'sfw'");

function getSubmissionCount(userid, type){
  return dwdb.prepare("SELECT count(*) as count from submissions where userid = ? and subtype = ?").get(userid, type).count;
}
function getTotalSubmissionsCount(){
  return countStmt.get().count;
}
function getTotalNSFWSubmissionsCount(){
  return countNSFWStmt.get().count;
}
function getTotalSFWSubmissionsCount(){
  return countSFWStmt.get().count;
}
function getRandomSubmission(type){
  if(type == "nsfw"){
    return randNsfwStmt.get()
  }else {
    return randSfwStmt.get()
  }
}
function getLatestSubmission(userid, type){
  var result = dwdb.prepare("select submissiontext from submissions where userid = ? and subtype = ? order by added desc limit 1").get(userid,type)
  if(result) return result.submissiontext;
  return "";
}
function removeLatestSubmission(userid, type){
  dwdb.prepare("delete from submissions where subtype = ? and userid = ? order by added desc limit 1").run(type, userid);
}

function submitSubmition(userid, type, subtext, username){
  attemptAddPlayer(userid, username);
  dwdb.prepare("insert into submissions (subtype, submissiontext, userid) values (?, ?, ?)").run(type, subtext, userid);
}

function attemptAddPlayer(userid, username){
  dwdb.prepare("insert or ignore into players (userid, name) values (?, ?)").run(userid, username);
  updatePlayerName(userid, username);
}

function updatePlayerName(userid, username){
  dwdb.prepare(`update players set
	name = ?
	where userid = ?`).run(username, userid);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function HelloWorld(){
	sendNetworkMessage("Hello, im 8ball bot. type @8ball with your yes/no question to see me in action")
}
function sendNetworkMessage(message){
	socket.emit("chatmessage", message);
  lastestmsgtime = Date.now();
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

startClient()
