prereqs:
1. https://nodejs.org/en/     (tested on version v8.11.3)
2. https://sqlitebrowser.org/ (optional database viewer)
3. http://pm2.keymetrics.io/  (optional process manager)

setup:
1. in one of the bot's folders make a copy of config_example.json and name it config.json
2. edit config.json with the details of your bot( userid can be found in account-> referrals )
3. in a terminal navigate to one of the bot's folders.
4. type 'npm install'
5. type 'node nameofbot.js' to launch the bot

if using pm2:
6. (optional) 'pm2 start nameofbot.js' start your bot and give it to pm2
7. (optional) 'pm2 list' shows all your bots
8. (optional) 'pm2 logs 1' view logs of your bot ( list shows the id ex: 1, 2, 3... )
